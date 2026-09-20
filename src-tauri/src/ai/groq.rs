use serde_json::{json, Value};

use super::error::ProviderError;
use super::types::HistoryMessage;

const ENDPOINT: &str = "https://api.groq.com/openai/v1/chat/completions";
const TEXT_MODEL: &str = "openai/gpt-oss-120b";

pub async fn call(
    client: &reqwest::Client,
    api_key: &str,
    system_prompt: &str,
    history: &[HistoryMessage],
    user_message: &str,
    image_base64: Option<&str>,
) -> Result<String, ProviderError> {
    if image_base64.is_some() {
        return Err(ProviderError::Network("Groq does not support vision models in current tier; routing to vision provider".to_string()));
    }

    let mut messages = vec![json!({ "role": "system", "content": system_prompt })];
    for h in history {
        messages.push(json!({ "role": h.role, "content": h.content }));
    }

    let model = TEXT_MODEL;

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

    let mut body_map = serde_json::Map::new();
    body_map.insert("model".into(), json!(model));
    body_map.insert("messages".into(), json!(messages));
    body_map.insert("temperature".into(), json!(0.85));
    body_map.insert("max_tokens".into(), json!(500));
    // Text model on Groq supports json_object response format
    if image_base64.is_none() {
        body_map.insert("response_format".into(), json!({ "type": "json_object" }));
    }

    let body = Value::Object(body_map);

    let resp = client
        .post(ENDPOINT)
        .bearer_auth(api_key)
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
        .ok_or_else(|| ProviderError::Malformed("missing choices[0].message.content in Groq response".into()))
}
