use crate::audio::tts;

#[tauri::command]
pub fn tts_speak(text: String, volume: f32, rate: f32) -> Result<(), String> {
    if text.trim().is_empty() {
        return Ok(());
    }
    tts::speak(text, volume, rate);
    Ok(())
}
