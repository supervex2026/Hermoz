use std::sync::Mutex;

use crate::ai::health::HealthTracker;
use crate::storage::settings::AppSettings;

/// Everything Hermoz needs to stay itself no matter which AI provider is
/// currently answering. Per the product spec: memory, personality, and
/// conversation state belong to the application, never to a provider's
/// chat history.
pub struct AppState {
    pub settings: Mutex<AppSettings>,
    pub health: Mutex<HealthTracker>,
    pub http: reqwest::Client,
}

impl AppState {
    pub fn new(settings: AppSettings) -> Self {
        let mut health = HealthTracker::default();
        health.set_configured(crate::ai::types::ProviderId::Groq, settings.has_groq_key);
        health.set_configured(
            crate::ai::types::ProviderId::OpenRouter,
            settings.has_open_router_key,
        );
        health.set_configured(
            crate::ai::types::ProviderId::Gemini,
            settings.has_gemini_key,
        );

        Self {
            settings: Mutex::new(settings),
            health: Mutex::new(health),
            http: reqwest::Client::builder()
                .timeout(std::time::Duration::from_secs(30))
                .build()
                .expect("failed to build HTTP client"),
        }
    }
}
