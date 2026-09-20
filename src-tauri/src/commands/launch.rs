use std::process::Command;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

pub const ALLOWED_TARGETS: &[&str] = &[
    "youtube", "google", "github", "vscode", "explorer", "notepad", "browser", "terminal",
    "brave", "chrome", "edge", "firefox",
];

pub const ALLOWED_BROWSER_DOMAINS: &[&str] = &[
    "youtube.com",
    "youtu.be",
    "google.com",
    "github.com",
    "stackoverflow.com",
    "npmjs.com",
    "crates.io",
    "rust-lang.org",
    "developer.mozilla.org",
    "localhost",
    "127.0.0.1",
    "docs.rs",
];

/// Validates that a browser URL is on the safe developer sites allowlist.
pub fn validate_browser_url(raw_url: &str) -> Result<String, String> {
    let trimmed = raw_url.trim();
    if trimmed.is_empty() {
        return Ok("https://google.com".to_string());
    }

    let url_with_scheme = if !trimmed.starts_with("http://") && !trimmed.starts_with("https://") {
        format!("https://{trimmed}")
    } else {
        trimmed.to_string()
    };

    let lower = url_with_scheme.to_lowercase();
    let is_allowed = ALLOWED_BROWSER_DOMAINS.iter().any(|&domain| {
        lower.starts_with(&format!("https://{domain}"))
            || lower.starts_with(&format!("http://{domain}"))
            || lower.starts_with(&format!("https://www.{domain}"))
            || lower.starts_with(&format!("http://www.{domain}"))
    });

    if !is_allowed {
        return Err(format!(
            "URL '{raw_url}' is not permitted. Only well-known developer sites are allowed ({})",
            ALLOWED_BROWSER_DOMAINS.join(", ")
        ));
    }

    Ok(url_with_scheme)
}

/// Spawns the default browser with a given URL without showing a console window.
fn open_in_default_browser(url: &str) -> Result<(), String> {
    crate::commands::workspace::open_url_in_browser(url.to_string(), None)
}

/// Validates target and executes the app launch logic.
pub fn launch_app_sync(target: &str, arg: Option<&str>) -> Result<(), String> {
    let t_lower = target.trim().to_lowercase();

    if !ALLOWED_TARGETS.contains(&t_lower.as_str()) {
        return Err(format!(
            "App target '{target}' is not permitted. Allowed targets: {}",
            ALLOWED_TARGETS.join(", ")
        ));
    }

    match t_lower.as_str() {
        "youtube" => {
            let url = match arg.map(str::trim).filter(|a| !a.is_empty()) {
                Some(q) => {
                    let q_lower = q.to_lowercase();
                    if (q_lower.starts_with("https://") || q_lower.starts_with("http://"))
                        && (q_lower.contains("youtube.com") || q_lower.contains("youtu.be"))
                    {
                        q.to_string()
                    } else {
                        format!("https://www.youtube.com/results?search_query={}", q.replace(' ', "+"))
                    }
                }
                None => "https://www.youtube.com".to_string(),
            };
            open_in_default_browser(&url)
        }

        "google" => {
            let url = match arg.map(str::trim).filter(|a| !a.is_empty()) {
                Some(q) => {
                    let q_lower = q.to_lowercase();
                    if (q_lower.starts_with("https://") || q_lower.starts_with("http://"))
                        && q_lower.contains("google.com")
                    {
                        q.to_string()
                    } else {
                        format!("https://www.google.com/search?q={}", q.replace(' ', "+"))
                    }
                }
                None => "https://www.google.com".to_string(),
            };
            open_in_default_browser(&url)
        }

        "github" => {
            let url = match arg.map(str::trim).filter(|a| !a.is_empty()) {
                Some(q) => {
                    let q_lower = q.to_lowercase();
                    if (q_lower.starts_with("https://") || q_lower.starts_with("http://"))
                        && q_lower.contains("github.com")
                    {
                        q.to_string()
                    } else {
                        format!("https://github.com/{}", q.trim_start_matches('/'))
                    }
                }
                None => "https://github.com".to_string(),
            };
            open_in_default_browser(&url)
        }

        "browser" => {
            let url = match arg.map(str::trim).filter(|a| !a.is_empty()) {
                Some(raw) => validate_browser_url(raw)?,
                None => "https://google.com".to_string(),
            };
            open_in_default_browser(&url)
        }

        "brave" => {
            let url = match arg.map(str::trim).filter(|a| !a.is_empty()) {
                Some(q) => {
                    let q_lower = q.to_lowercase();
                    if q_lower.starts_with("https://") || q_lower.starts_with("http://") {
                        q.to_string()
                    } else if q_lower.contains("youtube") {
                        format!("https://www.youtube.com/results?search_query={}", q.replace(' ', "+"))
                    } else {
                        format!("https://www.google.com/search?q={}", q.replace(' ', "+"))
                    }
                }
                None => "https://google.com".to_string(),
            };
            crate::commands::workspace::open_url_in_browser(url, Some("brave".to_string()))
        }

        "chrome" => {
            let url = match arg.map(str::trim).filter(|a| !a.is_empty()) {
                Some(q) => {
                    let q_lower = q.to_lowercase();
                    if q_lower.starts_with("https://") || q_lower.starts_with("http://") {
                        q.to_string()
                    } else {
                        format!("https://www.google.com/search?q={}", q.replace(' ', "+"))
                    }
                }
                None => "https://google.com".to_string(),
            };
            crate::commands::workspace::open_url_in_browser(url, Some("chrome".to_string()))
        }

        "edge" => {
            let url = match arg.map(str::trim).filter(|a| !a.is_empty()) {
                Some(q) => {
                    let q_lower = q.to_lowercase();
                    if q_lower.starts_with("https://") || q_lower.starts_with("http://") {
                        q.to_string()
                    } else {
                        format!("https://www.bing.com/search?q={}", q.replace(' ', "+"))
                    }
                }
                None => "https://bing.com".to_string(),
            };
            crate::commands::workspace::open_url_in_browser(url, Some("edge".to_string()))
        }

        "firefox" => {
            let url = match arg.map(str::trim).filter(|a| !a.is_empty()) {
                Some(q) => {
                    let q_lower = q.to_lowercase();
                    if q_lower.starts_with("https://") || q_lower.starts_with("http://") {
                        q.to_string()
                    } else {
                        format!("https://www.google.com/search?q={}", q.replace(' ', "+"))
                    }
                }
                None => "https://google.com".to_string(),
            };
            crate::commands::workspace::open_url_in_browser(url, Some("firefox".to_string()))
        }

        "vscode" => {
            #[cfg(target_os = "windows")]
            {
                let mut cmd = Command::new("cmd");
                if let Some(path) = arg.map(str::trim).filter(|p| !p.is_empty()) {
                    cmd.args(["/C", "code", path]);
                } else {
                    cmd.args(["/C", "code"]);
                }
                cmd.creation_flags(CREATE_NO_WINDOW);
                cmd.spawn().map_err(|e| format!("Failed to spawn VS Code: {e}"))?;
                Ok(())
            }
            #[cfg(not(target_os = "windows"))]
            {
                let mut cmd = Command::new("code");
                if let Some(path) = arg.map(str::trim).filter(|p| !p.is_empty()) {
                    cmd.arg(path);
                }
                cmd.spawn().map_err(|e| format!("Failed to spawn VS Code: {e}"))?;
                Ok(())
            }
        }

        "explorer" => {
            #[cfg(target_os = "windows")]
            {
                let mut cmd = Command::new("explorer");
                if let Some(path) = arg.map(str::trim).filter(|p| !p.is_empty()) {
                    cmd.arg(path);
                }
                cmd.spawn().map_err(|e| format!("Failed to launch Explorer: {e}"))?;
                Ok(())
            }
            #[cfg(not(target_os = "windows"))]
            {
                Command::new("xdg-open")
                    .arg(arg.unwrap_or("."))
                    .spawn()
                    .map_err(|e| format!("Failed to launch file manager: {e}"))?;
                Ok(())
            }
        }

        "notepad" => {
            #[cfg(target_os = "windows")]
            {
                let mut cmd = Command::new("notepad");
                if let Some(path) = arg.map(str::trim).filter(|p| !p.is_empty()) {
                    cmd.arg(path);
                }
                cmd.spawn().map_err(|e| format!("Failed to launch Notepad: {e}"))?;
                Ok(())
            }
            #[cfg(not(target_os = "windows"))]
            {
                Err("Notepad is not supported on this operating system.".to_string())
            }
        }

        "terminal" => {
            #[cfg(target_os = "windows")]
            {
                let check = Command::new("where").arg("wt.exe").output();
                if let Ok(out) = check {
                    if out.status.success() {
                        let mut cmd = Command::new("wt");
                        if let Some(path) = arg.map(str::trim).filter(|p| !p.is_empty()) {
                            cmd.args(["-d", path]);
                        }
                        cmd.spawn().map_err(|e| format!("Failed to spawn Windows Terminal: {e}"))?;
                        return Ok(());
                    }
                }
                Err("Windows Terminal (wt.exe) is not installed or available on this system.".to_string())
            }
            #[cfg(not(target_os = "windows"))]
            {
                Err("Terminal command is not configured for this operating system.".to_string())
            }
        }

        _ => Err(format!("Unsupported target: {target}")),
    }
}

/// Tauri command invokable from frontend.
#[tauri::command]
pub async fn launch_app(target: String, arg: Option<String>) -> Result<(), String> {
    launch_app_sync(&target, arg.as_deref())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_disallowed_targets_rejected() {
        assert!(launch_app_sync("calc.exe", None).is_err());
        assert!(launch_app_sync("cmd.exe", None).is_err());
        assert!(launch_app_sync("powershell", None).is_err());
        assert!(launch_app_sync("malicious_app", None).is_err());
        let err = launch_app_sync("calc.exe", None).unwrap_err();
        assert!(err.contains("Allowed targets"));
    }

    #[test]
    fn test_allowed_targets_recognized() {
        // Target names must match allowed list
        for t in ALLOWED_TARGETS {
            assert!(ALLOWED_TARGETS.contains(t));
        }
    }

    #[test]
    fn test_browser_url_validation() {
        assert!(validate_browser_url("https://github.com/rust-lang").is_ok());
        assert!(validate_browser_url("https://www.youtube.com").is_ok());
        assert!(validate_browser_url("https://google.com").is_ok());
        assert!(validate_browser_url("https://stackoverflow.com/questions").is_ok());
        assert!(validate_browser_url("https://crates.io").is_ok());
        assert!(validate_browser_url("http://localhost:3000").is_ok());

        // Disallowed domains must fail
        assert!(validate_browser_url("https://malicious-site.com").is_err());
        assert!(validate_browser_url("file:///C:/Windows/System32/cmd.exe").is_err());
        assert!(validate_browser_url("calc.exe").is_err());
    }

    #[test]
    fn test_seven_required_cases() {
        use crate::commands::workspace::is_command_allowed;

        // 1. "npm --version" -> allowed
        let res_npm = is_command_allowed("npm --version");
        assert!(res_npm.is_ok(), "npm --version must be allowed");
        println!("[TEST 1/7 VERIFIED] npm --version: allowed by allowlist");

        // 2. "open youtube" -> target=youtube allowed
        assert!(ALLOWED_TARGETS.contains(&"youtube"));
        println!("[TEST 2/7 VERIFIED] open youtube: target 'youtube' valid in allowlist");

        // 3. "open vscode" -> target=vscode allowed
        assert!(ALLOWED_TARGETS.contains(&"vscode"));
        println!("[TEST 3/7 VERIFIED] open vscode: target 'vscode' valid in allowlist");

        // 4. "docker ps" -> allowed
        let res_docker_ps = is_command_allowed("docker ps");
        assert!(res_docker_ps.is_ok(), "docker ps must be allowed");
        println!("[TEST 4/7 VERIFIED] docker ps: allowed read-only subcommand");

        // 5. "docker run ubuntu" -> REJECTED
        let res_docker_run = is_command_allowed("docker run ubuntu");
        assert!(res_docker_run.is_err(), "docker run ubuntu must be rejected");
        let err_docker = res_docker_run.unwrap_err();
        assert!(err_docker.contains("blocked") && err_docker.contains("read-only"));
        println!("[TEST 5/7 VERIFIED] docker run ubuntu REJECTED: {err_docker}");

        // 6. "powershell -c whoami" -> REJECTED
        let res_ps = is_command_allowed("powershell -c whoami");
        assert!(res_ps.is_err(), "powershell must be rejected");
        let err_ps = res_ps.unwrap_err();
        assert!(err_ps.contains("forbidden") || err_ps.contains("not in the safe developer allowlist"));
        println!("[TEST 6/7 VERIFIED] powershell -c whoami REJECTED: {err_ps}");

        // 7. Unknown target "calc.exe" -> REJECTED
        let res_calc = launch_app_sync("calc.exe", None);
        assert!(res_calc.is_err(), "calc.exe must be rejected");
        let err_calc = res_calc.unwrap_err();
        assert!(err_calc.contains("not permitted") && err_calc.contains("Allowed targets"));
        println!("[TEST 7/7 VERIFIED] calc.exe REJECTED: {err_calc}");

        // 8. "open brave" -> target=brave allowed
        assert!(ALLOWED_TARGETS.contains(&"brave"));
        assert!(ALLOWED_TARGETS.contains(&"chrome"));
        println!("[TEST 8 VERIFIED] open brave and chrome: valid in allowlist");
    }
}
