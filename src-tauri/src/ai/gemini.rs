use serde_json::{json, Value};

use super::error::ProviderError;
use super::types::HistoryMessage;

const ENDPOINT_BASE: &str = "https://generativelanguage.googleapis.com/v1beta/models";
const DEFAULT_MODEL: &str = "gemini-3.6-flash";

pub async fn call(
    client: &reqwest::Client,
    api_key: &str,
    system_prompt: &str,
    history: &[HistoryMessage],
    user_message: &str,
    image_base64: Option<&str>,
) -> Result<String, ProviderError> {
    let url = format!("{ENDPOINT_BASE}/{DEFAULT_MODEL}:generateContent?key={api_key}");

    let mut contents = Vec::new();

    // 1. Prior history turns
    for h in history {
        let role = if h.role == "assistant" || h.role == "momo" {
            "model"
        } else {
            "user"
        };
        contents.push(json!({
            "role": role,
            "parts": [{ "text": h.content }]
        }));
    }

    // 2. Current user message parts
    let mut user_parts = Vec::new();
    if let Some(raw_b64) = image_base64 {
        // Strip data:image/...;base64, prefix if present
        let clean_b64 = if let Some(idx) = raw_b64.find(',') {
            &raw_b64[idx + 1..]
        } else {
            raw_b64
        };
        user_parts.push(json!({
            "inline_data": {
                "mime_type": "image/jpeg",
                "data": clean_b64
            }
        }));
    }
    user_parts.push(json!({ "text": user_message }));

    contents.push(json!({
        "role": "user",
        "parts": user_parts
    }));

    let body = json!({
        "system_instruction": {
            "parts": [{ "text": system_prompt }]
        },
        "contents": contents,
        "generationConfig": {
            "temperature": 0.85,
            "maxOutputTokens": 600,
            "responseMimeType": "application/json"
        }
    });

    let resp = client
        .post(&url)
        .json(&body)
        .send()
        .await
        .map_err(|e| ProviderError::Network(e.to_string()))?;

    let status = resp.status();

    if status.as_u16() == 429 {
        let retry_after = resp
            .headers()
            .get("retry-after")
            .and_then(|v| v.to_str().ok())
            .and_then(|v| v.parse::<u64>().ok());
        return Err(ProviderError::RateLimited {
            retry_after_secs: retry_after,
        });
    }

    if status.as_u16() == 400 || status.as_u16() == 401 || status.as_u16() == 403 {
        let text = resp.text().await.unwrap_or_default();
        if text.contains("API_KEY_INVALID") || text.contains("PERMISSION_DENIED") || status.as_u16() == 401 || status.as_u16() == 403 {
            return Err(ProviderError::Auth);
        }
        return Err(ProviderError::ServerError(format!("HTTP {status}: {text}")));
    }

    if status.is_server_error() {
        return Err(ProviderError::ServerError(format!("HTTP {status}")));
    }

    if !status.is_success() {
        let text = resp.text().await.unwrap_or_default();
        return Err(ProviderError::ServerError(format!("HTTP {status}: {text}")));
    }

    let parsed: Value = resp
        .json()
        .await
        .map_err(|e| ProviderError::Malformed(e.to_string()))?;

    // Extract text from candidates[0].content.parts[0].text
    parsed["candidates"][0]["content"]["parts"][0]["text"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| ProviderError::Malformed("missing candidates[0].content.parts[0].text in Gemini response".into()))
}
