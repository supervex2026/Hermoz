use thiserror::Error;

/// Failure modes a provider call can hit. The router uses these to decide
/// whether to fail over to the next provider and how long to back off.
#[derive(Debug, Error)]
pub enum ProviderError {
    #[error("no API key configured")]
    NotConfigured,

    #[error("rate limited")]
    RateLimited { retry_after_secs: Option<u64> },

    #[error("authentication failed - check the API key")]
    Auth,

    #[error("provider returned a server error: {0}")]
    ServerError(String),

    #[error("network error: {0}")]
    Network(String),

    #[error("provider returned an unexpected response: {0}")]
    Malformed(String),
}

impl ProviderError {
    /// How long to wait before trying this provider again, in seconds.
    pub fn cooldown_secs(&self) -> u64 {
        match self {
            ProviderError::NotConfigured => 5,
            ProviderError::RateLimited { retry_after_secs } => retry_after_secs.unwrap_or(20),
            ProviderError::Auth => 10,
            ProviderError::ServerError(_) => 15,
            ProviderError::Network(_) => 8,
            ProviderError::Malformed(_) => 5,
        }
    }
}
