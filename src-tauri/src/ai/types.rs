use serde::{Deserialize, Serialize};
use std::fmt;

/// Which AI provider produced (or should produce) a response.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ProviderId {
    Groq,
    OpenRouter,
    Gemini,
}

impl fmt::Display for ProviderId {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            ProviderId::Groq => write!(f, "groq"),
            ProviderId::OpenRouter => write!(f, "openrouter"),
            ProviderId::Gemini => write!(f, "gemini"),
        }
    }
}

impl ProviderId {
    /// Every provider Momo currently knows about, in default failover order.
    pub fn all() -> [ProviderId; 3] {
        [ProviderId::Groq, ProviderId::OpenRouter, ProviderId::Gemini]
    }

    /// The key used both for keyring entries and for the settings.json
    /// "hasXKey" flags, so the two never drift apart.
    pub fn storage_key(&self) -> &'static str {
        match self {
            ProviderId::Groq => "groq",
            ProviderId::OpenRouter => "openrouter",
            ProviderId::Gemini => "gemini",
        }
    }
}

impl std::str::FromStr for ProviderId {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "groq" => Ok(ProviderId::Groq),
            "openrouter" => Ok(ProviderId::OpenRouter),
            "gemini" => Ok(ProviderId::Gemini),
            other => Err(format!("unknown provider '{other}'")),
        }
    }
}

/// Provider capabilities metadata for intelligent routing
#[allow(dead_code)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProviderCapabilities {
    pub text: bool,
    pub vision: bool,
    pub streaming: bool,
    pub structured_output: bool,
    pub agentic: bool,
    pub vision_agentic: bool,
}

impl ProviderId {
    #[allow(dead_code)]
    pub fn capabilities(&self) -> ProviderCapabilities {
        match self {
            ProviderId::Groq => ProviderCapabilities {
                text: true,
                vision: false,
                streaming: true,
                structured_output: true,
                agentic: true,
                vision_agentic: false,
            },
            ProviderId::OpenRouter => ProviderCapabilities {
                text: true,
                vision: true,
                streaming: true,
                structured_output: true,
                agentic: true,
                vision_agentic: false,
            },
            ProviderId::Gemini => ProviderCapabilities {
                text: true,
                vision: true,
                streaming: true,
                structured_output: true,
                agentic: true,
                vision_agentic: true,
            },
        }
    }
}

/// Health state of a single provider, as shown in the Settings panel.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProviderHealthState {
    Connected,
    RateLimited,
    Error,
    Unconfigured,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderStatus {
    pub id: ProviderId,
    pub state: ProviderHealthState,
    /// Unix ms timestamp; the provider will not be retried before this time.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub retry_after: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub last_error: Option<String>,
}

/// A message in the short-term conversation window sent with each request.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryMessage {
    pub role: String,
    pub content: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
pub struct PersonalityConfig {
    pub roast_level: u8,
    pub proactivity: Proactivity,
    pub seriousness: Seriousness,
    pub style: CompanionStyle,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Proactivity {
    Low,
    Medium,
    High,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Seriousness {
    Casual,
    Balanced,
    Serious,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum CompanionStyle {
    Friendly,
    Chaotic,
    Mentor,
    Sarcastic,
}

/// Rich context gathered by the frontend Context Builder to accompany the prompt
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RequestContext {
    #[serde(default)]
    pub memories: Vec<String>,
    #[serde(default)]
    pub active_project: Option<String>,
    #[serde(default)]
    pub current_task: Option<String>,
    #[serde(default)]
    pub interaction_mode: Option<String>,
    #[serde(default)]
    pub argument_context: Option<String>,
    #[serde(default)]
    pub screen_context: Option<String>,
    #[serde(default)]
    pub user_profile: Option<String>,
}

/// Tool action proposal that Momo can request user approval to perform
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MomoAction {
    #[serde(rename = "type")]
    pub action_type: String, // "open_url" | "command" | "analyze_file" | "write_file" | "rename_file" | "delete_file" | "web_fetch"
    #[serde(default)]
    pub command: Option<String>,
    #[serde(default)]
    pub path: Option<String>,
    #[serde(default)]
    pub new_path: Option<String>,
    #[serde(default)]
    pub content: Option<String>,
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub browser: Option<String>,
    #[serde(default)]
    pub target: Option<String>,
    #[serde(default)]
    pub arg: Option<String>,
    #[serde(default)]
    pub reason: Option<String>,
}

/// What the frontend sends to `ai_generate`.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateRequest {
    pub message: String,
    #[serde(default)]
    pub history: Vec<HistoryMessage>,
    pub personality: PersonalityConfig,
    #[serde(default)]
    pub context: Option<RequestContext>,
    #[serde(default)]
    pub image: Option<String>,
    #[serde(default)]
    pub require_agentic: bool,
}

/// The structured contract normalized across Groq, OpenRouter, and Gemini:
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateResponse {
    pub message: String,
    pub bubble_text: String,
    pub speech_display: String,
    pub emotion: String,
    pub interaction_mode: String,
    pub animation: String,
    pub speak: bool,
    pub provider: ProviderId,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub action: Option<MomoAction>,
}

pub const VALID_EMOTIONS: &[&str] = &[
    "neutral", "happy", "laughing", "annoyed", "confused", "surprised", "sleepy", "thinking",
    "angry", "smug", "excited", "sad", "concerned", "teasing",
];

/// Strips markdown syntax (code blocks, headers, bullet points, bold/italic, links)
/// and extracts a punchy 1-2 sentence display version (under ~90-100 chars) for the floating bubble.
pub fn derive_speech_display(full: &str) -> String {
    let mut clean = String::new();
    let mut in_code_block = false;

    // Filter line by line
    for line in full.lines() {
        let trimmed_line = line.trim();
        if trimmed_line.starts_with("```") {
            in_code_block = !in_code_block;
            continue;
        }
        if in_code_block {
            continue;
        }
        // Skip headers, list markers, blockquotes
        let no_prefix = trimmed_line
            .trim_start_matches('#')
            .trim_start_matches('*')
            .trim_start_matches('-')
            .trim_start_matches('>')
            .trim_start_matches(|c: char| c.is_ascii_digit() || c == '.')
            .trim();
        if !no_prefix.is_empty() {
            if !clean.is_empty() {
                clean.push(' ');
            }
            clean.push_str(no_prefix);
        }
    }

    if clean.is_empty() {
        clean = full.trim().to_string();
    }

    // Strip inline backticks and markdown formatting
    let cleaned_chars: String = clean
        .chars()
        .filter(|&c| c != '`' && c != '*' && c != '_' && c != '~')
        .collect();

    let collapsed = cleaned_chars.split_whitespace().collect::<Vec<_>>().join(" ");
    if collapsed.chars().count() <= 90 {
        return collapsed;
    }

    // Split into sentences (. ! ? or newline)
    let mut sentences = Vec::new();
    let mut current = String::new();
    for c in collapsed.chars() {
        current.push(c);
        if (c == '.' || c == '!' || c == '?') && current.trim().len() > 6 {
            sentences.push(current.trim().to_string());
            current.clear();
            if sentences.len() >= 2 {
                break;
            }
        }
    }
    if !current.trim().is_empty() && sentences.is_empty() {
        sentences.push(current.trim().to_string());
    }

    let mut candidate = sentences.join(" ");
    if candidate.is_empty() {
        candidate = collapsed;
    }

    if candidate.chars().count() > 95 {
        let truncated: String = candidate.chars().take(90).collect();
        if let Some(last_space) = truncated.rfind(' ') {
            format!("{}...", &truncated[..last_space])
        } else {
            format!("{truncated}...")
        }
    } else {
        candidate
    }
}

/// Produces a short, punchy 1-2 sentence display version for the compact floating bubble
#[allow(dead_code)]
pub fn derive_bubble_text(full: &str) -> String {
    derive_speech_display(full)
}

/// Parses any provider's raw output into the structured Momo contract.
pub fn parse_model_output(raw: &str, provider: ProviderId) -> GenerateResponse {
    #[derive(Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct RawShape {
        #[serde(default)]
        message: Option<String>,
        #[serde(default, alias = "bubble_text")]
        bubble_text: Option<String>,
        #[serde(default, alias = "speech_display")]
        speech_display: Option<String>,
        #[serde(default)]
        emotion: Option<String>,
        #[serde(default, alias = "interaction_mode")]
        interaction_mode: Option<String>,
        #[serde(default)]
        speak: Option<bool>,
        #[serde(default)]
        animation: Option<String>,
        #[serde(default)]
        action: Option<MomoAction>,
    }

    let trimmed = raw.trim();

    let candidate: Option<RawShape> = serde_json::from_str(trimmed).ok().or_else(|| {
        let start = trimmed.find('{')?;
        let end = trimmed.rfind('}')?;
        if end > start {
            serde_json::from_str(&trimmed[start..=end]).ok()
        } else {
            None
        }
    });

    match candidate {
        Some(shape) if shape.message.is_some() => {
            let msg = shape.message.unwrap();
            let emotion = shape
                .emotion
                .filter(|e| VALID_EMOTIONS.contains(&e.as_str()))
                .unwrap_or_else(|| "neutral".to_string());
            let display_text = shape
                .speech_display
                .or(shape.bubble_text)
                .map(|t| derive_speech_display(&t))
                .unwrap_or_else(|| derive_speech_display(&msg));
            let mode = shape.interaction_mode.unwrap_or_else(|| "normal".to_string());
            let anim = shape.animation.unwrap_or_else(|| emotion.clone());
            let action = normalize_action(shape.action);
            GenerateResponse {
                message: msg,
                bubble_text: display_text.clone(),
                speech_display: display_text,
                emotion,
                interaction_mode: mode,
                animation: anim,
                speak: shape.speak.unwrap_or(true),
                provider,
                action,
            }
        }
        _ => {
            let display_text = derive_speech_display(trimmed);
            GenerateResponse {
                message: trimmed.to_string(),
                bubble_text: display_text.clone(),
                speech_display: display_text,
                emotion: "neutral".to_string(),
                interaction_mode: "normal".to_string(),
                speak: true,
                animation: "neutral".to_string(),
                provider,
                action: None,
            }
        }
    }
}

/// Normalizes and defensively verifies action proposals before passing them to the system.
/// Protects against model drift (e.g. model outputting `command: "start https://..."` instead of `launch_app`),
/// and strictly blocks non-allowlisted executables like calc.exe.
pub fn normalize_action(action: Option<MomoAction>) -> Option<MomoAction> {
    let mut act = action?;
    let t = act.action_type.trim().to_lowercase();

    // 1. Safety check for launch_app targets:
    if t == "launch_app" {
        if let Some(target) = &act.target {
            let target_lower = target.trim().to_lowercase();
            // Block calc / calc.exe or arbitrary executables
            if target_lower == "calc" || target_lower == "calc.exe" || target_lower.contains("calc") {
                return None;
            }
            const SAFE_TARGETS: &[&str] = &[
                "youtube", "google", "github", "vscode", "explorer", "notepad", "browser", "terminal",
                "brave", "chrome", "edge", "firefox",
            ];
            if !SAFE_TARGETS.contains(&target_lower.as_str()) {
                // If it's code/wt aliases, normalize them
                if target_lower == "code" {
                    act.target = Some("vscode".to_string());
                } else if target_lower == "wt" || target_lower == "wt.exe" {
                    act.target = Some("terminal".to_string());
                } else {
                    return None;
                }
            }
        }
        return Some(act);
    }

    // 2. Defensive rewrite for `command` that should be `launch_app` or blocked:
    if t == "command" {
        if let Some(cmd) = &act.command {
            let cmd_lower = cmd.trim().to_lowercase();

            // Strictly reject calc.exe or calc
            if cmd_lower == "calc" || cmd_lower == "calc.exe" || cmd_lower.starts_with("calc ") {
                return None;
            }

            // Rewrite "start <url>" or "start browser"
            if cmd_lower.starts_with("start ") {
                let rest = cmd[6..].trim().trim_matches('"').trim_matches('\'').trim();
                let rest_lower = rest.to_lowercase();
                if rest_lower.contains("youtube.com") || rest_lower.contains("youtu.be") {
                    return Some(MomoAction {
                        action_type: "launch_app".to_string(),
                        target: Some("youtube".to_string()),
                        arg: Some(rest.to_string()),
                        command: None,
                        path: None,
                        new_path: None,
                        content: None,
                        url: Some(rest.to_string()),
                        browser: act.browser,
                        reason: act.reason.or_else(|| Some("Open YouTube in browser".to_string())),
                    });
                } else if rest_lower.contains("github.com") {
                    return Some(MomoAction {
                        action_type: "launch_app".to_string(),
                        target: Some("github".to_string()),
                        arg: Some(rest.to_string()),
                        command: None,
                        path: None,
                        new_path: None,
                        content: None,
                        url: Some(rest.to_string()),
                        browser: act.browser,
                        reason: act.reason.or_else(|| Some("Open GitHub in browser".to_string())),
                    });
                } else if rest_lower.contains("google.com") {
                    return Some(MomoAction {
                        action_type: "launch_app".to_string(),
                        target: Some("google".to_string()),
                        arg: Some(rest.to_string()),
                        command: None,
                        path: None,
                        new_path: None,
                        content: None,
                        url: Some(rest.to_string()),
                        browser: act.browser,
                        reason: act.reason.or_else(|| Some("Open Google in browser".to_string())),
                    });
                } else if rest_lower.starts_with("http://") || rest_lower.starts_with("https://") {
                    return Some(MomoAction {
                        action_type: "launch_app".to_string(),
                        target: Some("browser".to_string()),
                        arg: Some(rest.to_string()),
                        command: None,
                        path: None,
                        new_path: None,
                        content: None,
                        url: Some(rest.to_string()),
                        browser: act.browser,
                        reason: act.reason.or_else(|| Some("Open URL in browser".to_string())),
                    });
                }
            }

            // Rewrite `code` or `code <path>`
            if cmd_lower == "code" || cmd_lower.starts_with("code ") {
                let arg = if cmd_lower.len() > 4 {
                    let a = cmd[4..].trim();
                    if a.is_empty() { None } else { Some(a.to_string()) }
                } else {
                    None
                };
                return Some(MomoAction {
                    action_type: "launch_app".to_string(),
                    target: Some("vscode".to_string()),
                    arg,
                    command: None,
                    path: None,
                    new_path: None,
                    content: None,
                    url: None,
                    browser: None,
                    reason: act.reason.or_else(|| Some("Open Visual Studio Code".to_string())),
                });
            }

            // Rewrite `notepad` or `notepad <path>`
            if cmd_lower == "notepad" || cmd_lower.starts_with("notepad ") {
                let arg = if cmd_lower.len() > 7 {
                    let a = cmd[7..].trim();
                    if a.is_empty() { None } else { Some(a.to_string()) }
                } else {
                    None
                };
                return Some(MomoAction {
                    action_type: "launch_app".to_string(),
                    target: Some("notepad".to_string()),
                    arg,
                    command: None,
                    path: None,
                    new_path: None,
                    content: None,
                    url: None,
                    browser: None,
                    reason: act.reason.or_else(|| Some("Open Notepad".to_string())),
                });
            }

            // Rewrite `explorer` or `explorer <path>`
            if cmd_lower == "explorer" || cmd_lower.starts_with("explorer ") {
                let arg = if cmd_lower.len() > 8 {
                    let a = cmd[8..].trim();
                    if a.is_empty() { None } else { Some(a.to_string()) }
                } else {
                    None
                };
                return Some(MomoAction {
                    action_type: "launch_app".to_string(),
                    target: Some("explorer".to_string()),
                    arg,
                    command: None,
                    path: None,
                    new_path: None,
                    content: None,
                    url: None,
                    browser: None,
                    reason: act.reason.or_else(|| Some("Open Windows Explorer".to_string())),
                });
            }

            // Rewrite `wt` or `wt.exe`
            if cmd_lower == "wt" || cmd_lower == "wt.exe" || cmd_lower.starts_with("wt ") {
                return Some(MomoAction {
                    action_type: "launch_app".to_string(),
                    target: Some("terminal".to_string()),
                    arg: None,
                    command: None,
                    path: None,
                    new_path: None,
                    content: None,
                    url: None,
                    browser: None,
                    reason: act.reason.or_else(|| Some("Open Windows Terminal".to_string())),
                });
            }

            // Rewrite `brave` or `start brave`
            if cmd_lower == "brave" || cmd_lower.starts_with("brave ") || cmd_lower.starts_with("start brave") {
                let arg = if cmd_lower.starts_with("start brave") {
                    let a = cmd[11..].trim().trim_matches('"').trim();
                    if a.is_empty() { None } else { Some(a.to_string()) }
                } else if cmd_lower.len() > 5 {
                    let a = cmd[5..].trim().trim_matches('"').trim();
                    if a.is_empty() { None } else { Some(a.to_string()) }
                } else {
                    None
                };
                return Some(MomoAction {
                    action_type: "launch_app".to_string(),
                    target: Some("brave".to_string()),
                    arg,
                    command: None,
                    path: None,
                    new_path: None,
                    content: None,
                    url: None,
                    browser: Some("brave".to_string()),
                    reason: act.reason.or_else(|| Some("Open Brave browser".to_string())),
                });
            }

            // Rewrite `chrome` or `start chrome`
            if cmd_lower == "chrome" || cmd_lower.starts_with("chrome ") || cmd_lower.starts_with("start chrome") {
                let arg = if cmd_lower.starts_with("start chrome") {
                    let a = cmd[12..].trim().trim_matches('"').trim();
                    if a.is_empty() { None } else { Some(a.to_string()) }
                } else if cmd_lower.len() > 6 {
                    let a = cmd[6..].trim().trim_matches('"').trim();
                    if a.is_empty() { None } else { Some(a.to_string()) }
                } else {
                    None
                };
                return Some(MomoAction {
                    action_type: "launch_app".to_string(),
                    target: Some("chrome".to_string()),
                    arg,
                    command: None,
                    path: None,
                    new_path: None,
                    content: None,
                    url: None,
                    browser: Some("chrome".to_string()),
                    reason: act.reason.or_else(|| Some("Open Chrome browser".to_string())),
                });
            }
        }
    }

    Some(act)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_normalize_action_rewrites_and_blocks() {
        // 1. YouTube command rewritten to launch_app
        let yt_cmd = MomoAction {
            action_type: "command".to_string(),
            command: Some("start https://www.youtube.com".to_string()),
            path: None,
            new_path: None,
            content: None,
            url: None,
            browser: None,
            target: None,
            arg: None,
            reason: None,
        };
        let norm_yt = normalize_action(Some(yt_cmd)).unwrap();
        assert_eq!(norm_yt.action_type, "launch_app");
        assert_eq!(norm_yt.target.as_deref(), Some("youtube"));

        // 2. VS Code command rewritten to launch_app
        let vs_cmd = MomoAction {
            action_type: "command".to_string(),
            command: Some("code src/main.rs".to_string()),
            path: None,
            new_path: None,
            content: None,
            url: None,
            browser: None,
            target: None,
            arg: None,
            reason: None,
        };
        let norm_vs = normalize_action(Some(vs_cmd)).unwrap();
        assert_eq!(norm_vs.action_type, "launch_app");
        assert_eq!(norm_vs.target.as_deref(), Some("vscode"));
        assert_eq!(norm_vs.arg.as_deref(), Some("src/main.rs"));

        // 3. Normal developer CLI command preserved as command
        let npm_cmd = MomoAction {
            action_type: "command".to_string(),
            command: Some("npm --version".to_string()),
            path: None,
            new_path: None,
            content: None,
            url: None,
            browser: None,
            target: None,
            arg: None,
            reason: Some("Check npm version".to_string()),
        };
        let norm_npm = normalize_action(Some(npm_cmd)).unwrap();
        assert_eq!(norm_npm.action_type, "command");
        assert_eq!(norm_npm.command.as_deref(), Some("npm --version"));

        // 4. Notepad command rewritten to launch_app
        let np_cmd = MomoAction {
            action_type: "command".to_string(),
            command: Some("notepad notes.txt".to_string()),
            path: None,
            new_path: None,
            content: None,
            url: None,
            browser: None,
            target: None,
            arg: None,
            reason: None,
        };
        let norm_np = normalize_action(Some(np_cmd)).unwrap();
        assert_eq!(norm_np.action_type, "launch_app");
        assert_eq!(norm_np.target.as_deref(), Some("notepad"));

        // 5. Calc rejected (returns None)
        let calc_cmd = MomoAction {
            action_type: "command".to_string(),
            command: Some("calc.exe".to_string()),
            path: None,
            new_path: None,
            content: None,
            url: None,
            browser: None,
            target: None,
            arg: None,
            reason: None,
        };
        assert!(normalize_action(Some(calc_cmd)).is_none());

        let calc_launch = MomoAction {
            action_type: "launch_app".to_string(),
            command: None,
            path: None,
            new_path: None,
            content: None,
            url: None,
            browser: None,
            target: Some("calc.exe".to_string()),
            arg: None,
            reason: None,
        };
        assert!(normalize_action(Some(calc_launch)).is_none());

        // 6. Brave launch_app target is preserved
        let brave_launch = MomoAction {
            action_type: "launch_app".to_string(),
            command: None,
            path: None,
            new_path: None,
            content: None,
            url: None,
            browser: None,
            target: Some("brave".to_string()),
            arg: Some("https://www.youtube.com".to_string()),
            reason: Some("Open YouTube in Brave".to_string()),
        };
        let norm_brave = normalize_action(Some(brave_launch)).unwrap();
        assert_eq!(norm_brave.action_type, "launch_app");
        assert_eq!(norm_brave.target.as_deref(), Some("brave"));
        assert_eq!(norm_brave.arg.as_deref(), Some("https://www.youtube.com"));

        // 7. Brave command rewritten to launch_app
        let brave_cmd = MomoAction {
            action_type: "command".to_string(),
            command: Some("brave https://www.youtube.com".to_string()),
            path: None,
            new_path: None,
            content: None,
            url: None,
            browser: None,
            target: None,
            arg: None,
            reason: None,
        };
        let norm_bcmd = normalize_action(Some(brave_cmd)).unwrap();
        assert_eq!(norm_bcmd.action_type, "launch_app");
        assert_eq!(norm_bcmd.target.as_deref(), Some("brave"));
        assert_eq!(norm_bcmd.arg.as_deref(), Some("https://www.youtube.com"));
    }
}
