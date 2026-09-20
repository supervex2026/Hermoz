use tauri::State;

use crate::ai::types::ProviderId;
use crate::ai::whisper;
use crate::state::AppState;
use crate::storage::keys::get_api_key;

#[tauri::command]
pub async fn transcribe_audio(
    audio_data: Vec<u8>,
    format: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    if audio_data.is_empty() {
        return Err("No audio data provided".to_string());
    }

    let key = get_api_key(ProviderId::Groq).ok_or_else(|| {
        "Voice transcription requires a Groq API key. Please configure one in Settings.".to_string()
    })?;

    whisper::transcribe(&state.http, &key, audio_data, &format)
        .await
        .map_err(|e| e.to_string())
}
