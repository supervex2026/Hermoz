use std::str::FromStr;
use tauri::State;
use tauri_plugin_autostart::ManagerExt;

use crate::ai::types::ProviderId;
use crate::state::AppState;
use crate::storage::{keys, settings};

#[tauri::command]
pub fn get_settings(state: State<'_, AppState>) -> settings::AppSettings {
    state.settings.lock().unwrap().clone()
}

/// The frontend always sends the *full* settings object back (it keeps its
/// own copy in sync locally), so this just validates, applies immediate
/// side effects to the live window, and persists.
#[tauri::command]
pub fn update_settings(
    new_settings: settings::AppSettings,
    window: tauri::Window,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let _ = window.set_always_on_top(new_settings.always_on_top);
    let _ = window.set_ignore_cursor_events(new_settings.click_through);

    if new_settings.launch_at_startup {
        if let Err(e) = app.autolaunch().enable() {
            log::warn!("could not enable launch at startup: {e}");
        }
    } else if let Err(e) = app.autolaunch().disable() {
        log::warn!("could not disable launch at startup: {e}");
    }

    settings::save(&app, &new_settings)?;
    *state.settings.lock().unwrap() = new_settings;
    Ok(())
}

#[tauri::command]
pub fn save_api_key(
    provider: String,
    key: String,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let id = ProviderId::from_str(&provider)?;
    if key.trim().is_empty() {
        return Err("key cannot be empty".into());
    }
    keys::save_api_key(id, key.trim())?;

    let mut s = state.settings.lock().unwrap();
    match id {
        ProviderId::Groq => s.has_groq_key = true,
        ProviderId::OpenRouter => s.has_open_router_key = true,
        ProviderId::Gemini => s.has_gemini_key = true,
    }
    settings::save(&app, &s)?;
    state.health.lock().unwrap().set_configured(id, true);
    Ok(())
}

#[tauri::command]
pub fn clear_api_key(
    provider: String,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let id = ProviderId::from_str(&provider)?;
    keys::clear_api_key(id)?;

    let mut s = state.settings.lock().unwrap();
    match id {
        ProviderId::Groq => s.has_groq_key = false,
        ProviderId::OpenRouter => s.has_open_router_key = false,
        ProviderId::Gemini => s.has_gemini_key = false,
    }
    settings::save(&app, &s)?;
    state.health.lock().unwrap().set_configured(id, false);
    Ok(())
}
