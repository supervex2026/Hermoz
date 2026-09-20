use serde_json::{json, Value};

use super::error::ProviderError;
use super::types::HistoryMessage;

const ENDPOINT: &str = "https://openrouter.ai/api/v1/chat/completions";
const TEXT_MODEL: &str = "meta-llama/llama-3.3-70b-instruct";
const VISION_MODEL: &str = "inclusionai/ling-3.0-flash-vl:free";

pub async fn call(
    client: &reqwest::Client,
    api_key: &str,
    system_prompt: &str,
    history: &[HistoryMessage],
    user_message: &str,
    image_base64: Option<&str>,
) -> Result<String, ProviderError> {
    let mut messages = vec![json!({ "role": "system", "content": system_prompt })];
    for h in history {
        messages.push(json!({ "role": h.role, "content": h.content }));
    }

    let model = if image_base64.is_some() {
        VISION_MODEL
    } else {
        TEXT_MODEL
    };

    if let Some(raw_b64) = image_base64 {
        let full_url = if raw_b64.starts_with("data:") {
            raw_b64.to_string()
        } else {
            format!("data:image/jpeg;base64,{raw_b64}")
        };
        messages.push(json!({
            "role": "user",
            "content": [
                { "type": "text", "text": user_message },
                { "type": "image_url", "image_url": { "url": full_url } }
            ]
        }));
    } else {
        messages.push(json!({ "role": "user", "content": user_message }));
    }

    let body = json!({
        "model": model,
        "messages": messages,
        "temperature": 0.85,
        "max_tokens": 500,
    });

    let resp = client
        .post(ENDPOINT)
        .bearer_auth(api_key)
        .header("HTTP-Referer", "https://momo.app")
        .header("X-Title", "Momo")
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
    if status.as_u16() == 401 || status.as_u16() == 403 {
        return Err(ProviderError::Auth);
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

    parsed["choices"][0]["message"]["content"]
        .as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| ProviderError::Malformed("missing choices[0].message.content in OpenRouter response".into()))
}
