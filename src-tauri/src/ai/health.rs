use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

use super::error::ProviderError;
use super::types::{ProviderHealthState, ProviderId, ProviderStatus};

#[derive(Debug, Clone)]
struct HealthEntry {
    state: ProviderHealthState,
    /// Unix ms; None means "no cooldown, available now".
    retry_after_ms: Option<u64>,
    last_error: Option<String>,
}

impl Default for HealthEntry {
    fn default() -> Self {
        Self {
            state: ProviderHealthState::Unconfigured,
            retry_after_ms: None,
            last_error: None,
        }
    }
}

/// Tracks per-provider health so the router can skip providers that are
/// currently rate-limited or erroring, and so Settings can show live status.
/// This is intentionally simple (in-memory only, reset on restart) - a
/// provider that failed five minutes ago gets a clean slate next launch.
#[derive(Debug, Default)]
pub struct HealthTracker {
    entries: HashMap<ProviderId, HealthEntry>,
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

impl HealthTracker {
    pub fn set_configured(&mut self, id: ProviderId, configured: bool) {
        let entry = self.entries.entry(id).or_default();
        if !configured {
            *entry = HealthEntry {
                state: ProviderHealthState::Unconfigured,
                retry_after_ms: None,
                last_error: None,
            };
        } else {
            // Optimistic: reset any prior cooldown or error state so new keys take effect immediately
            entry.state = ProviderHealthState::Connected;
            entry.retry_after_ms = None;
            entry.last_error = None;
        }
    }

    /// Is this provider worth trying right now?
    pub fn is_available(&self, id: ProviderId) -> bool {
        match self.entries.get(&id) {
            None => true,
            Some(e) => match e.state {
                ProviderHealthState::Unconfigured => false,
                _ => e.retry_after_ms.map(|t| now_ms() >= t).unwrap_or(true),
            },
        }
    }

    pub fn record_success(&mut self, id: ProviderId) {
        self.entries.insert(
            id,
            HealthEntry {
                state: ProviderHealthState::Connected,
                retry_after_ms: None,
                last_error: None,
            },
        );
    }

    pub fn record_failure(&mut self, id: ProviderId, err: &ProviderError) {
        let state = match err {
            ProviderError::RateLimited { .. } => ProviderHealthState::RateLimited,
            ProviderError::NotConfigured => ProviderHealthState::Unconfigured,
            _ => ProviderHealthState::Error,
        };
        self.entries.insert(
            id,
            HealthEntry {
                state,
                retry_after_ms: Some(now_ms() + err.cooldown_secs() * 1000),
                last_error: Some(err.to_string()),
            },
        );
    }

    pub fn snapshot(&self) -> Vec<ProviderStatus> {
        ProviderId::all()
            .into_iter()
            .map(|id| {
                let entry = self.entries.get(&id).cloned().unwrap_or_default();
                ProviderStatus {
                    id,
                    state: entry.state,
                    retry_after: entry.retry_after_ms,
                    last_error: entry.last_error,
                }
            })
            .collect()
    }
}
