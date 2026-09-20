use tauri::State;

use crate::ai::router;
use crate::ai::types::{GenerateRequest, GenerateResponse, ProviderStatus};
use crate::state::AppState;

#[tauri::command]
pub async fn ai_generate(
    request: GenerateRequest,
    state: State<'_, AppState>,
) -> Result<GenerateResponse, String> {
    router::generate(&state, request).await
}

#[tauri::command]
pub fn get_provider_status(state: State<'_, AppState>) -> Result<Vec<ProviderStatus>, String> {
    Ok(state.health.lock().unwrap().snapshot())
}
