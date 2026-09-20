use reqwest::multipart::{Form, Part};
use serde_json::Value;

use super::error::ProviderError;

const ENDPOINT: &str = "https://api.groq.com/openai/v1/audio/transcriptions";
const MODEL: &str = "whisper-large-v3-turbo";

/// Transcribes audio bytes using Groq's fast Whisper API.
pub async fn transcribe(
    client: &reqwest::Client,
    api_key: &str,
    audio_bytes: Vec<u8>,
    format: &str,
) -> Result<String, ProviderError> {
    let file_name = match format {
        "wav" => "audio.wav",
        "mp3" => "audio.mp3",
        "m4a" => "audio.m4a",
        _ => "audio.webm",
    };

    let mime_type = match format {
        "wav" => "audio/wav",
        "mp3" => "audio/mpeg",
        "m4a" => "audio/m4a",
        _ => "audio/webm",
    };

    let file_part = Part::bytes(audio_bytes)
        .file_name(file_name)
        .mime_str(mime_type)
        .map_err(|e| ProviderError::Malformed(e.to_string()))?;

    let form = Form::new()
        .text("model", MODEL)
        .text("response_format", "json")
        .part("file", file_part);

    let resp = client
        .post(ENDPOINT)
        .bearer_auth(api_key)
        .multipart(form)
        .send()
        .await
        .map_err(|e| ProviderError::Network(e.to_string()))?;

    let status = resp.status();
    if status.as_u16() == 429 {
        return Err(ProviderError::RateLimited {
            retry_after_secs: Some(15),
        });
    }
    if status.as_u16() == 401 || status.as_u16() == 403 {
        return Err(ProviderError::Auth);
    }
    if !status.is_success() {
        let err_text = resp.text().await.unwrap_or_default();
        return Err(ProviderError::ServerError(format!("HTTP {status}: {err_text}")));
    }

    let parsed: Value = resp
        .json()
        .await
        .map_err(|e| ProviderError::Malformed(e.to_string()))?;

    let text = parsed["text"]
        .as_str()
        .map(|s| s.trim().to_string())
        .ok_or_else(|| ProviderError::Malformed("missing 'text' field in transcription".into()))?;

    Ok(text)
}
