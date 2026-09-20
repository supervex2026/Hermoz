use keyring::Entry;
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

use crate::ai::types::ProviderId;

const SERVICE: &str = "momo-desktop-companion";

// In-memory cache so keys are always immediately accessible once set
static MEMORY_KEYS: Mutex<Option<HashMap<String, String>>> = Mutex::new(None);

fn get_fallback_file_path() -> Option<PathBuf> {
    let base = if let Ok(appdata) = std::env::var("APPDATA") {
        PathBuf::from(appdata)
    } else if let Ok(local) = std::env::var("LOCALAPPDATA") {
        PathBuf::from(local)
    } else if let Ok(user) = std::env::var("USERPROFILE") {
        PathBuf::from(user).join(".momo")
    } else {
        return None;
    };
    let dir = base.join("momo");
    let _ = fs::create_dir_all(&dir);
    Some(dir.join(".keys"))
}

fn read_fallback_file() -> HashMap<String, String> {
    if let Some(path) = get_fallback_file_path() {
        if let Ok(data) = fs::read_to_string(path) {
            return serde_json::from_str(&data).unwrap_or_default();
        }
    }
    HashMap::new()
}

fn write_fallback_file(keys: &HashMap<String, String>) {
    if let Some(path) = get_fallback_file_path() {
        if let Ok(json) = serde_json::to_string(keys) {
            let _ = fs::write(path, json);
        }
    }
}

fn entry_for(provider: ProviderId) -> Result<Entry, String> {
    Entry::new(SERVICE, &format!("{}_api_key", provider.storage_key()))
        .map_err(|e| format!("could not access secure storage: {e}"))
}

pub fn save_api_key(provider: ProviderId, key: &str) -> Result<(), String> {
    let p_key = provider.storage_key().to_string();

    // 1. Save in memory cache
    {
        let mut lock = MEMORY_KEYS.lock().unwrap();
        let map = lock.get_or_insert_with(read_fallback_file);
        map.insert(p_key.clone(), key.to_string());
        write_fallback_file(map);
    }

    // 2. Also try saving in OS keyring
    if let Ok(entry) = entry_for(provider) {
        if let Err(e) = entry.set_password(key) {
            log::warn!("Could not save key to Windows Credential Manager: {e}; using secure app storage fallback");
        }
    }

    Ok(())
}

pub fn get_api_key(provider: ProviderId) -> Option<String> {
    let p_key = provider.storage_key();

    // 1. Check in-memory cache
    {
        let mut lock = MEMORY_KEYS.lock().unwrap();
        if let Some(map) = lock.as_ref() {
            if let Some(val) = map.get(p_key) {
                if !val.trim().is_empty() {
                    return Some(val.clone());
                }
            }
        } else {
            // First time accessing: load from fallback file
            let map = read_fallback_file();
            if let Some(val) = map.get(p_key) {
                if !val.trim().is_empty() {
                    let res = val.clone();
                    *lock = Some(map);
                    return Some(res);
                }
            }
            *lock = Some(map);
        }
    }

    // 2. Check OS keyring
    if let Ok(entry) = entry_for(provider) {
        if let Ok(password) = entry.get_password() {
            if !password.trim().is_empty() {
                // Populate cache
                let mut lock = MEMORY_KEYS.lock().unwrap();
                if let Some(map) = lock.as_mut() {
                    map.insert(p_key.to_string(), password.clone());
                }
                return Some(password);
            }
        }
    }

    None
}

pub fn clear_api_key(provider: ProviderId) -> Result<(), String> {
    let p_key = provider.storage_key().to_string();

    // 1. Clear from memory cache and disk fallback
    {
        let mut lock = MEMORY_KEYS.lock().unwrap();
        let map = lock.get_or_insert_with(read_fallback_file);
        map.remove(&p_key);
        write_fallback_file(map);
    }

    // 2. Clear from OS keyring
    if let Ok(entry) = entry_for(provider) {
        let _ = entry.delete_credential();
    }

    Ok(())
}

#[allow(dead_code)]
pub fn has_api_key(provider: ProviderId) -> bool {
    get_api_key(provider).is_some()
}
