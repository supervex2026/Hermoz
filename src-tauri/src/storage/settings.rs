use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use tauri::Manager;

use crate::ai::types::{CompanionStyle, PersonalityConfig, Proactivity, Seriousness};

#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct WindowPosition {
    pub x: f64,
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettings {
    pub personality: PersonalityConfig,
    pub always_on_top: bool,
    pub click_through: bool,
    pub launch_at_startup: bool,
    pub tts_enabled: bool,
    pub tts_volume: f32,
    pub tts_speed: f32,
    #[serde(default = "default_pitch")]
    pub tts_pitch: f32,
    #[serde(default)]
    pub selected_voice: Option<String>,
    #[serde(default)]
    pub mute_momo: bool,
    pub speak_proactive_messages: bool,
    pub speak_chat_responses: bool,
    pub proactive_cooldown_seconds: u32,
    pub window_position: Option<WindowPosition>,
    pub has_groq_key: bool,
    pub has_open_router_key: bool,
    #[serde(default)]
    pub has_gemini_key: bool,
    #[serde(default = "default_provider_priority")]
    pub provider_priority: Vec<String>,
    #[serde(default)]
    pub workspace_folder: Option<String>,
    #[serde(default = "default_max_agent_steps")]
    pub max_agent_steps: u32,
    #[serde(default = "default_true")]
    pub exclude_from_capture: bool,
}

fn default_pitch() -> f32 {
    1.0
}

fn default_true() -> bool {
    true
}

fn default_max_agent_steps() -> u32 {
    25
}

fn default_provider_priority() -> Vec<String> {
    vec!["groq".into(), "openrouter".into(), "gemini".into()]
}

impl Default for AppSettings {
    fn default() -> Self {
        Self {
            personality: PersonalityConfig {
                roast_level: 2,
                proactivity: Proactivity::Medium,
                seriousness: Seriousness::Balanced,
                style: CompanionStyle::Friendly,
            },
            always_on_top: true,
            click_through: false,
            launch_at_startup: false,
            tts_enabled: true,
            tts_volume: 0.8,
            tts_speed: 1.0,
            tts_pitch: 1.0,
            selected_voice: None,
            mute_momo: false,
            speak_proactive_messages: true,
            speak_chat_responses: true,
            proactive_cooldown_seconds: 120,
            window_position: None,
            has_groq_key: false,
            has_open_router_key: false,
            has_gemini_key: false,
            provider_priority: default_provider_priority(),
            workspace_folder: None,
            max_agent_steps: 25,
            exclude_from_capture: true,
        }
    }
}

fn settings_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("could not resolve app data dir: {e}"))?;
    fs::create_dir_all(&dir).map_err(|e| format!("could not create app data dir: {e}"))?;
    Ok(dir.join("settings.json"))
}

/// Loads settings from disk, falling back to defaults if the file is
/// missing, unreadable, or corrupt (rather than failing to start).
pub fn load(app: &tauri::AppHandle) -> AppSettings {
    let Ok(path) = settings_path(app) else {
        return AppSettings::default();
    };
    match fs::read_to_string(&path) {
        Ok(contents) => serde_json::from_str(&contents).unwrap_or_else(|e| {
            log::warn!("settings.json was unreadable ({e}); using defaults");
            AppSettings::default()
        }),
        Err(_) => AppSettings::default(),
    }
}

pub fn save(app: &tauri::AppHandle, settings: &AppSettings) -> Result<(), String> {
    let path = settings_path(app)?;
    let json = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| format!("could not write settings.json: {e}"))
}
