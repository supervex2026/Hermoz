use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredMessage {
    pub id: String,
    pub role: String,
    pub content: String,
    #[serde(default)]
    pub bubble_text: Option<String>,
    #[serde(default)]
    pub provider: Option<String>,
    pub timestamp: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StoredMemory {
    pub id: String,
    pub category: String,
    pub content: String,
    pub importance: String,
    pub created_at: u64,
}

#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CanonicalHermozState {
    #[serde(default)]
    pub messages: Vec<StoredMessage>,
    #[serde(default)]
    pub memories: Vec<StoredMemory>,
    #[serde(default)]
    pub conversation_summary: Option<String>,
    #[serde(default)]
    pub active_project: Option<String>,
    #[serde(default)]
    pub current_task: Option<String>,
    #[serde(default)]
    pub user_profile: Option<String>,
    #[serde(default)]
    pub interaction_mode: Option<String>,
}

fn state_file_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("could not resolve app data dir: {e}"))?;
    let _ = fs::create_dir_all(&dir);
    Ok(dir.join("hermoz_canonical_state.json"))
}

pub fn load_state(app: &tauri::AppHandle) -> CanonicalHermozState {
    let Ok(path) = state_file_path(app) else {
        return CanonicalHermozState::default();
    };
    if !path.exists() {
        return CanonicalHermozState::default();
    }
    match fs::read_to_string(&path) {
        Ok(data) => serde_json::from_str(&data).unwrap_or_default(),
        Err(_) => CanonicalHermozState::default(),
    }
}

pub fn save_state(app: &tauri::AppHandle, state: &CanonicalHermozState) -> Result<(), String> {
    let path = state_file_path(app)?;
    let json = serde_json::to_string_pretty(state).map_err(|e| e.to_string())?;
    fs::write(path, json).map_err(|e| format!("could not save state: {e}"))
}

pub fn append_message(app: &tauri::AppHandle, msg: StoredMessage) -> Result<(), String> {
    let mut state = load_state(app);
    // Keep max 200 messages in recent log to prevent unbounded growth
    if state.messages.len() > 200 {
        let drain_count = state.messages.len() - 180;
        state.messages.drain(0..drain_count);
    }
    state.messages.push(msg);
    save_state(app, &state)
}
