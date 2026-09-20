use tauri::AppHandle;

use crate::storage::state_store::{
    append_message, load_state, save_state, CanonicalMomoState, StoredMessage,
};

#[tauri::command]
pub fn get_canonical_state(app: AppHandle) -> CanonicalMomoState {
    load_state(&app)
}

#[tauri::command]
pub fn update_canonical_state(app: AppHandle, state: CanonicalMomoState) -> Result<(), String> {
    save_state(&app, &state)
}

#[tauri::command]
pub fn persist_message(app: AppHandle, message: StoredMessage) -> Result<(), String> {
    append_message(&app, message)
}
