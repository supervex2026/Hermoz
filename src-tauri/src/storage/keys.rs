use keyring::Entry;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use crate::ai::types::ProviderId;

const SERVICE: &str = "hermoz-desktop-companion";

use std::sync::OnceLock;

// Keys only live in RAM after being read from the operating system's secure
// credential store. There is intentionally no disk fallback.
static MEMORY_KEYS: OnceLock<Mutex<HashMap<String, String>>> = OnceLock::new();

fn memory_keys() -> &'static Mutex<HashMap<String, String>> {
    MEMORY_KEYS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn legacy_keys_path() -> Option<PathBuf> {
    let base = std::env::var("APPDATA").ok().map(PathBuf::from)
        .or_else(|| std::env::var("LOCALAPPDATA").ok().map(PathBuf::from))
        .or_else(|| std::env::var("USERPROFILE").ok().map(|value| PathBuf::from(value).join(".hermoz")))?;
    Some(base.join("hermoz").join(".keys"))
}

fn entry_for(provider: ProviderId) -> Result<Entry, String> {
    Entry::new(SERVICE, &format!("{}_api_key", provider.storage_key()))
        .map_err(|e| format!("could not access the operating system credential store: {e}"))
}

fn stitch_entry() -> Result<Entry, String> {
    Entry::new(SERVICE, "stitch_api_key")
        .map_err(|e| format!("could not access the operating system credential store: {e}"))
}

fn securely_remove_legacy_file(path: &PathBuf) -> Result<(), String> {
    let size = fs::metadata(path).map_err(|e| format!("could not inspect legacy key file: {e}"))?.len() as usize;
    let mut random = vec![0_u8; size];
    getrandom::fill(&mut random).map_err(|e| format!("could not securely erase legacy key file: {e}"))?;
    fs::write(path, random).map_err(|e| format!("could not overwrite legacy key file: {e}"))?;
    fs::remove_file(path).map_err(|e| format!("could not remove legacy key file: {e}"))
}

/// One-way migration for keys written by releases before secure storage was
/// mandatory. The plaintext file is removed only after every key is saved.
fn migrate_legacy_keys() -> Result<(), String> {
    let Some(path) = legacy_keys_path() else { return Ok(()); };
    if !path.exists() { return Ok(()); }
    let data = fs::read_to_string(&path).map_err(|e| format!("could not read legacy key file for migration: {e}"))?;
    let keys: HashMap<String, String> = serde_json::from_str(&data)
        .map_err(|e| format!("legacy key file is invalid and was not removed: {e}"))?;

    for (provider, key) in &keys {
        let id: ProviderId = provider.parse()?;
        entry_for(id)?.set_password(key)
            .map_err(|e| format!("could not migrate {provider} key to secure storage: {e}"))?;
    }
    securely_remove_legacy_file(&path)
}

pub fn save_api_key(provider: ProviderId, key: &str) -> Result<(), String> {
    migrate_legacy_keys()?;
    entry_for(provider)?.set_password(key)
        .map_err(|e| format!("could not save API key in the operating system credential store: {e}"))?;
    memory_keys().lock().unwrap().insert(provider.storage_key().to_string(), key.to_string());
    Ok(())
}

pub fn get_api_key(provider: ProviderId) -> Option<String> {
    if let Err(error) = migrate_legacy_keys() {
        log::warn!("API key migration failed: {error}");
        return None;
    }
    if let Some(key) = memory_keys().lock().unwrap().get(provider.storage_key()).cloned() {
        return Some(key);
    }
    match entry_for(provider).and_then(|entry| entry.get_password().map_err(|e| e.to_string())) {
        Ok(key) if !key.trim().is_empty() => {
            memory_keys().lock().unwrap().insert(provider.storage_key().to_string(), key.clone());
            Some(key)
        }
        _ => None,
    }
}

pub fn clear_api_key(provider: ProviderId) -> Result<(), String> {
    migrate_legacy_keys()?;
    memory_keys().lock().unwrap().remove(provider.storage_key());
    match entry_for(provider)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("could not remove API key from secure storage: {e}")),
    }
}

pub fn save_stitch_api_key(key: &str) -> Result<(), String> {
    migrate_legacy_keys()?;
    stitch_entry()?.set_password(key)
        .map_err(|e| format!("could not save Stitch API key in the operating system credential store: {e}"))
}

pub fn has_stitch_api_key() -> bool {
    stitch_entry().and_then(|entry| entry.get_password().map_err(|e| e.to_string()))
        .is_ok_and(|key| !key.trim().is_empty())
}

pub fn get_stitch_api_key() -> Option<String> {
    stitch_entry().and_then(|entry| entry.get_password().map_err(|e| e.to_string())).ok()
        .filter(|key| !key.trim().is_empty())
}

pub fn clear_stitch_api_key() -> Result<(), String> {
    migrate_legacy_keys()?;
    match stitch_entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(format!("could not remove Stitch API key from secure storage: {e}")),
    }
}

#[allow(dead_code)]
pub fn has_api_key(provider: ProviderId) -> bool {
    get_api_key(provider).is_some()
}
