use super::error::ProviderError;
use super::types::{parse_model_output, GenerateRequest, GenerateResponse, ProviderId};
use super::{gemini, groq, openrouter};
use crate::personality::build_system_prompt;
use crate::state::AppState;
use crate::storage::keys::get_api_key;

/// Tries each configured, currently-healthy provider in the configured priority order
/// until one succeeds. Seamlessly fails over between Groq, OpenRouter, and Gemini without
/// losing conversation, memory, or screen context.
pub async fn generate(
    state: &AppState,
    request: GenerateRequest,
) -> Result<GenerateResponse, String> {
    let system_prompt = build_system_prompt(&request);
    let mut last_err: Option<String> = None;

    // Get ordered provider priority from user settings or fallback to default
    let priority_list: Vec<ProviderId> = {
        let settings = state.settings.lock().unwrap();
        let mut list = Vec::new();
        for p in &settings.provider_priority {
            if let Ok(id) = p.parse::<ProviderId>() {
                if !list.contains(&id) {
                    list.push(id);
                }
            }
        }
        if list.is_empty() {
            ProviderId::all().to_vec()
        } else {
            // Ensure all known providers are present
            for id in ProviderId::all() {
                if !list.contains(&id) {
                    list.push(id);
                }
            }
            list
        }
    };

    let image_ref = request.image.as_deref();
    let require_agentic = request.require_agentic;

    for id in priority_list {
        if require_agentic {
            if image_ref.is_some() {
                if !id.capabilities().vision_agentic {
                    log::info!("Provider {id} skipped: multimodal agentic tasks require vision_agentic capability");
                    continue;
                }
            } else if !id.capabilities().agentic {
                log::info!("Provider {id} skipped: does not support agentic capability");
                continue;
            }
        }

        let available = {
            let health = state.health.lock().unwrap();
            health.is_available(id)
        };
        if !available {
            continue;
        }

        let key = match get_api_key(id) {
            Some(k) if !k.trim().is_empty() => k,
            _ => {
                let mut health = state.health.lock().unwrap();
                health.record_failure(id, &ProviderError::NotConfigured);
                continue;
            }
        };

        let result = match id {
            ProviderId::Groq => {
                groq::call(
                    &state.http,
                    &key,
                    &system_prompt,
                    &request.history,
                    &request.message,
                    image_ref,
                )
                .await
            }
            ProviderId::OpenRouter => {
                openrouter::call(
                    &state.http,
                    &key,
                    &system_prompt,
                    &request.history,
                    &request.message,
                    image_ref,
                )
                .await
            }
            ProviderId::Gemini => {
                gemini::call(
                    &state.http,
                    &key,
                    &system_prompt,
                    &request.history,
                    &request.message,
                    image_ref,
                )
                .await
            }
        };

        match result {
            Ok(raw) => {
                state.health.lock().unwrap().record_success(id);
                return Ok(parse_model_output(&raw, id));
            }
            Err(err) => {
                log::warn!("Provider {id} failed during generate (is_vision={}): {err}. Attempting failover...", image_ref.is_some());
                last_err = Some(format!("{id}: {err}"));
                // Only mark provider unhealthy for text if this was a normal text request.
                // Vision errors (model lack of vision or vision quota) fail over cleanly to next provider.
                if image_ref.is_none() {
                    state.health.lock().unwrap().record_failure(id, &err);
                }
                // Seamlessly fall through to next provider in priority order
            }
        }
    }

    Err(last_err.unwrap_or_else(|| {
        if require_agentic && image_ref.is_some() {
            "Multimodal agentic tasks require Gemini (Groq and OpenRouter vision models do not support tool calling). Please configure a Gemini API key in Settings.".to_string()
        } else if require_agentic {
            "No AI provider with agentic/tool-calling capabilities is currently configured or available. Please configure Groq or Gemini in Settings.".to_string()
        } else {
            "No AI provider is configured or available. Add a Groq, OpenRouter, or Gemini key in Settings.".to_string()
        }
    }))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::ai::types::{CompanionStyle, GenerateRequest, PersonalityConfig, Proactivity, Seriousness};
    use crate::storage::settings::AppSettings;

    fn sample_request(message: &str) -> GenerateRequest {
        GenerateRequest {
            message: message.to_string(),
            history: Vec::new(),
            personality: PersonalityConfig {
                roast_level: 2,
                proactivity: Proactivity::Medium,
                seriousness: Seriousness::Balanced,
                style: CompanionStyle::Friendly,
            },
            context: None,
            image: None,
            require_agentic: false,
        }
    }

    #[tokio::test]
    async fn test_only_gemini_generate() {
        let mut settings = AppSettings::default();
        settings.provider_priority = vec!["gemini".to_string()];
        settings.has_gemini_key = true;
        settings.has_groq_key = false;
        settings.has_open_router_key = false;
        let state = AppState::new(settings);

        let res = generate(&state, sample_request("Say hello")).await;
        assert!(res.is_ok(), "Gemini generate failed: {:?}", res.err());
        let resp = res.unwrap();
        assert_eq!(resp.provider, ProviderId::Gemini);
        println!("[VERIFIED] Only Gemini enabled returned: {}", resp.message);
    }

    #[tokio::test]
    async fn test_only_groq_generate() {
        let mut settings = AppSettings::default();
        settings.provider_priority = vec!["groq".to_string()];
        settings.has_groq_key = true;
        settings.has_gemini_key = false;
        settings.has_open_router_key = false;
        let state = AppState::new(settings);

        let res = generate(&state, sample_request("Say hello")).await;
        assert!(res.is_ok(), "Groq generate failed: {:?}", res.err());
        let resp = res.unwrap();
        assert_eq!(resp.provider, ProviderId::Groq);
        println!("[VERIFIED] Only Groq enabled returned: {}", resp.message);
    }

    #[tokio::test]
    async fn test_only_openrouter_generate() {
        let mut settings = AppSettings::default();
        settings.provider_priority = vec!["openrouter".to_string()];
        settings.has_open_router_key = true;
        settings.has_groq_key = false;
        settings.has_gemini_key = false;
        let state = AppState::new(settings);

        let res = generate(&state, sample_request("Say hello")).await;
        assert!(res.is_ok(), "OpenRouter generate failed: {:?}", res.err());
        let resp = res.unwrap();
        assert_eq!(resp.provider, ProviderId::OpenRouter);
        println!("[VERIFIED] Only OpenRouter enabled returned: {}", resp.message);
    }

    #[tokio::test]
    async fn test_all_three_failover() {
        let mut settings = AppSettings::default();
        settings.provider_priority = vec!["groq".to_string(), "openrouter".to_string(), "gemini".to_string()];
        settings.has_groq_key = true;
        settings.has_open_router_key = true;
        settings.has_gemini_key = true;
        let state = AppState::new(settings);

        let res = generate(&state, sample_request("Say hello")).await;
        assert!(res.is_ok(), "Failover generate failed: {:?}", res.err());
        let resp = res.unwrap();
        println!("[VERIFIED] All three enabled produced response via provider: {}", resp.provider);
    }

    #[tokio::test]
    async fn test_six_launch_app_routing_cases() {
        let mut settings = AppSettings::default();
        settings.provider_priority = vec!["gemini".to_string(), "groq".to_string(), "openrouter".to_string()];
        settings.has_gemini_key = true;
        settings.has_groq_key = true;
        settings.has_open_router_key = true;
        let state = AppState::new(settings);

        // Case 1: "open youtube"
        let res1 = generate(&state, sample_request("open youtube")).await.unwrap();
        println!("[CASE 1] open youtube -> action: {:?}", res1.action);
        assert!(res1.action.is_some(), "open youtube should produce an action");
        let a1 = res1.action.unwrap();
        assert_eq!(a1.action_type, "launch_app");
        assert_eq!(a1.target.as_deref(), Some("youtube"));

        // Case 2: "open vscode"
        let res2 = generate(&state, sample_request("open vscode")).await.unwrap();
        println!("[CASE 2] open vscode -> action: {:?}", res2.action);
        assert!(res2.action.is_some(), "open vscode should produce an action");
        let a2 = res2.action.unwrap();
        assert_eq!(a2.action_type, "launch_app");
        assert_eq!(a2.target.as_deref(), Some("vscode"));

        // Case 3: "run npm --version"
        let res3 = generate(&state, sample_request("run npm --version")).await.unwrap();
        println!("[CASE 3] run npm --version -> action: {:?}", res3.action);
        assert!(res3.action.is_some(), "run npm --version should produce an action");
        let a3 = res3.action.unwrap();
        assert_eq!(a3.action_type, "command");
        assert!(a3.command.unwrap().contains("npm"));

        // Case 4: "open notepad"
        let res4 = generate(&state, sample_request("open notepad")).await.unwrap();
        println!("[CASE 4] open notepad -> action: {:?}", res4.action);
        assert!(res4.action.is_some(), "open notepad should produce an action");
        let a4 = res4.action.unwrap();
        assert_eq!(a4.action_type, "launch_app");
        assert_eq!(a4.target.as_deref(), Some("notepad"));

        // Case 5: "open calc.exe" (must be rejected / None)
        let res5 = generate(&state, sample_request("open calc.exe")).await.unwrap();
        println!("[CASE 5] open calc.exe -> action: {:?}", res5.action);
        assert!(res5.action.is_none(), "open calc.exe must be rejected with action None");

        // Case 6: "go to github"
        let res6 = generate(&state, sample_request("go to github")).await.unwrap();
        println!("[CASE 6] go to github -> action: {:?}", res6.action);
        assert!(res6.action.is_some(), "go to github should produce an action");
        let a6 = res6.action.unwrap();
        assert!(a6.action_type == "launch_app" || a6.action_type == "open_url");
        if a6.action_type == "launch_app" {
            assert_eq!(a6.target.as_deref(), Some("github"));
        } else {
            assert!(a6.url.unwrap().contains("github"));
        }
    }
}
