use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::{Arc, Mutex};
use std::time::Instant;
use serde::{Deserialize, Serialize};
use tauri::Emitter;

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandExecutionResult {
    pub stdout: String,
    pub stderr: String,
    pub exit_code: i32,
    pub duration_ms: u64,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WebScrapeResult {
    pub url: String,
    pub title: String,
    pub content: String,
    pub status: u16,
}

// Strict safe developer tools only - NO shells (powershell, cmd, bash, sh) allowed
pub const ALLOWED_COMMANDS: &[&str] = &[
    "node", "npm", "npx", "pnpm", "yarn", "bun",
    "python", "py", "pip", "pip3",
    "cargo", "rustc", "rustup",
    "git",
    "tsc", "vite",
    "deno", "go",
    "docker",
    "dir", "ls", "cat", "type", "echo", "grep", "find", "where", "which",
];

pub const BLOCKED_PATTERNS: &[&str] = &[
    "rm -rf", "format ", "mkfs", "del /f /s /q c:", "del /s /q c:", "rd /s /q c:",
    "shutdown", "drop database", ":(){ :|:& };:",
    "powershell", "pwsh", "cmd.exe", "cmd ", "/bin/bash", "/bin/sh",
    "curl", "wget", "invoke-webrequest",
];

/// Validates that Docker commands only execute read-only inspect/logging subcommands.
pub fn validate_docker_command(cmd_str: &str) -> Result<(), String> {
    let lower = cmd_str.to_lowercase();
    if lower.contains("-it") || lower.contains("-ti") || lower.contains("-i -t") || lower.contains("-t -i") {
        return Err("Interactive flags (-it) are blocked in docker commands.".to_string());
    }

    let tokens: Vec<&str> = cmd_str.split_whitespace().collect();
    if tokens.len() < 2 {
        return Err("Docker command requires a subcommand (e.g. 'docker ps', 'docker images').".to_string());
    }

    let sub = tokens[1].to_lowercase();
    if sub == "compose" {
        if tokens.len() < 3 {
            return Err("Docker compose requires a subcommand (e.g. 'docker compose ps', 'docker compose logs').".to_string());
        }
        let compose_sub = tokens[2].to_lowercase();
        if compose_sub != "ps" && compose_sub != "logs" {
            return Err(format!(
                "Docker compose subcommand '{}' is blocked. Only read-only subcommands (ps, logs) are allowed.",
                tokens[2]
            ));
        }
        return Ok(());
    }

    const ALLOWED_DOCKER_SUBS: &[&str] = &["ps", "images", "logs", "inspect"];
    if !ALLOWED_DOCKER_SUBS.contains(&sub.as_str()) {
        return Err(format!(
            "Docker subcommand '{}' is blocked. Only read-only subcommands ({}) are allowed.",
            tokens[1],
            ALLOWED_DOCKER_SUBS.join(", ")
        ));
    }

    Ok(())
}

pub fn is_command_allowed(cmd_str: &str) -> Result<(), String> {
    let lower = cmd_str.to_lowercase();
    for pattern in BLOCKED_PATTERNS {
        if lower.contains(pattern) {
            return Err(format!("Command contains forbidden dangerous pattern: '{pattern}'"));
        }
    }

    let first_token = cmd_str
        .split_whitespace()
        .next()
        .map(|s| s.trim().trim_end_matches(".exe").to_lowercase())
        .unwrap_or_default();

    if !ALLOWED_COMMANDS.iter().any(|&c| c.eq_ignore_ascii_case(&first_token)) {
        return Err(format!(
            "Command '{first_token}' is not in the safe developer allowlist ({})",
            ALLOWED_COMMANDS.join(", ")
        ));
    }

    if first_token == "docker" {
        validate_docker_command(cmd_str)?;
    }

    Ok(())
}

/// Resolves a user-provided path against the granted workspace directory.
/// - Canonicalizes the workspace root.
/// - Canonicalizes the target path (or its parent if the target does not yet exist).
/// - Follows symlinks to their real destination.
/// - Validates on Windows that target begins with workspace root (case-insensitively).
/// - Early-out rejects any path with `..`.
pub fn resolve_and_validate_path(
    workspace: &str,
    user_path: &str,
    is_write: bool,
) -> Result<PathBuf, String> {
    let trimmed = user_path.trim();
    if trimmed.is_empty() {
        return Err("Path cannot be empty".to_string());
    }

    // 1. Early-out rejection of traversal markers
    if trimmed.contains("..") {
        return Err("Path traversal ('..') is strictly forbidden".to_string());
    }

    // 2. Canonicalize workspace root
    let ws_canonical = std::fs::canonicalize(workspace)
        .map_err(|e| format!("Invalid workspace directory '{workspace}': {e}"))?;

    // 3. Resolve base target path
    let target = if Path::new(trimmed).is_absolute() {
        PathBuf::from(trimmed)
    } else {
        ws_canonical.join(trimmed)
    };

    // 4. Canonicalize target or ancestor
    let target_canonical = if target.exists() {
        std::fs::canonicalize(&target)
            .map_err(|e| format!("Failed to canonicalize path: {e}"))?
    } else if is_write {
        // File doesn't exist yet: find existing ancestor to canonicalize
        let mut curr = target.as_path();
        let mut non_existent_parts = Vec::new();
        while !curr.exists() {
            if let Some(name) = curr.file_name() {
                non_existent_parts.push(name.to_os_string());
            }
            match curr.parent() {
                Some(p) => curr = p,
                None => break,
            }
        }
        let ancestor_canonical = std::fs::canonicalize(curr)
            .map_err(|e| format!("Failed to canonicalize ancestor folder: {e}"))?;

        let mut reconstructed = ancestor_canonical;
        for part in non_existent_parts.into_iter().rev() {
            reconstructed.push(part);
        }
        reconstructed
    } else {
        return Err(format!("File does not exist: '{trimmed}'"));
    };

    // 5. Case-insensitive path prefix validation on Windows
    let ws_str = ws_canonical.to_string_lossy().to_lowercase();
    let target_str = target_canonical.to_string_lossy().to_lowercase();

    if !target_str.starts_with(&ws_str) {
        return Err(format!(
            "Access denied: path '{trimmed}' resolves outside granted workspace folder"
        ));
    }

    Ok(target_canonical)
}

/// Native Windows folder browser dialog using a dedicated STA process
#[tauri::command]
pub async fn choose_workspace_folder() -> Result<Option<String>, String> {
    let output = Command::new("powershell")
        .args([
            "-NoProfile",
            "-STA",
            "-Command",
            "Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; $f.ShowNewFolderButton = $true; $f.Description = 'Select Momo Workspace Folder'; $res = $f.ShowDialog(); if ($res -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $f.SelectedPath }",
        ])
        .output()
        .map_err(|e| format!("Failed to open folder picker: {e}"))?;

    let path = String::from_utf8_lossy(&output.stdout).trim().to_string();
    if path.is_empty() {
        Ok(None)
    } else {
        Ok(Some(path))
    }
}

/// Executes an allowlisted developer command with real-time stdout/stderr line streaming
#[tauri::command]
pub async fn execute_workspace_command(
    app: tauri::AppHandle,
    command: String,
    cwd: Option<String>,
    workspace: Option<String>,
) -> Result<CommandExecutionResult, String> {
    is_command_allowed(&command)?;

    let start = Instant::now();

    // Determine working directory: prefer explicit cwd if valid, else workspace, else current
    let working_dir = if let Some(dir) = cwd.filter(|c| !c.trim().is_empty()) {
        if let Some(ws) = &workspace {
            let valid = resolve_and_validate_path(ws, &dir, false)?;
            Some(valid)
        } else {
            Some(PathBuf::from(dir))
        }
    } else if let Some(ws) = workspace.filter(|w| !w.trim().is_empty()) {
        let valid_ws = std::fs::canonicalize(&ws).map_err(|e| format!("Invalid workspace: {e}"))?;
        Some(valid_ws)
    } else {
        None
    };

    #[cfg(target_os = "windows")]
    let mut cmd = {
        let mut c = Command::new("cmd.exe");
        c.args(["/C", &command]);
        c
    };

    #[cfg(not(target_os = "windows"))]
    let mut cmd = {
        let mut c = Command::new("sh");
        c.args(["-c", &command]);
        c
    };

    if let Some(dir) = working_dir {
        cmd.current_dir(dir);
    }

    let mut child = cmd
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("Failed to spawn command: {e}"))?;

    let stdout_pipe = child.stdout.take();
    let stderr_pipe = child.stderr.take();

    let stdout_captured = Arc::new(Mutex::new(String::new()));
    let stderr_captured = Arc::new(Mutex::new(String::new()));

    let app_clone1 = app.clone();
    let out_cap = Arc::clone(&stdout_captured);
    let t1 = std::thread::spawn(move || {
        if let Some(pipe) = stdout_pipe {
            let reader = BufReader::new(pipe);
            for line in reader.lines().map_while(Result::ok) {
                let _ = app_clone1.emit("workspace-terminal-line", serde_json::json!({
                    "stream": "stdout",
                    "text": &line
                }));
                let mut buf = out_cap.lock().unwrap();
                buf.push_str(&line);
                buf.push('\n');
            }
        }
    });

    let app_clone2 = app.clone();
    let err_cap = Arc::clone(&stderr_captured);
    let t2 = std::thread::spawn(move || {
        if let Some(pipe) = stderr_pipe {
            let reader = BufReader::new(pipe);
            for line in reader.lines().map_while(Result::ok) {
                let _ = app_clone2.emit("workspace-terminal-line", serde_json::json!({
                    "stream": "stderr",
                    "text": &line
                }));
                let mut buf = err_cap.lock().unwrap();
                buf.push_str(&line);
                buf.push('\n');
            }
        }
    });

    let status = child.wait().map_err(|e| format!("Command error: {e}"))?;
    let _ = t1.join();
    let _ = t2.join();

    let duration_ms = start.elapsed().as_millis() as u64;
    let exit_code = status.code().unwrap_or(-1);
    let stdout = Arc::try_unwrap(stdout_captured).unwrap().into_inner().unwrap();
    let stderr = Arc::try_unwrap(stderr_captured).unwrap().into_inner().unwrap();

    Ok(CommandExecutionResult {
        stdout,
        stderr,
        exit_code,
        duration_ms,
    })
}

#[tauri::command]
pub async fn fetch_web_content(
    url: String,
) -> Result<WebScrapeResult, String> {
    if !url.starts_with("http://") && !url.starts_with("https://") {
        return Err("URL must start with http:// or https://".to_string());
    }

    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 MomoAgent/2.0")
        .timeout(std::time::Duration::from_secs(12))
        .build()
        .map_err(|e| e.to_string())?;

    let resp = client.get(&url).send().await.map_err(|e| format!("Request failed: {e}"))?;
    let status = resp.status().as_u16();
    let body = resp.text().await.map_err(|e| format!("Failed to read response: {e}"))?;

    // Extract title
    let title = if let Some(start) = body.to_lowercase().find("<title>") {
        if let Some(end) = body.to_lowercase().find("</title>") {
            if end > start + 7 {
                body[start + 7..end].trim().to_string()
            } else {
                url.clone()
            }
        } else {
            url.clone()
        }
    } else {
        url.clone()
    };

    let clean_text = extract_readable_text(&body);

    Ok(WebScrapeResult {
        url,
        title,
        content: clean_text,
        status,
    })
}

fn extract_readable_text(html: &str) -> String {
    let mut in_tag = false;
    let mut in_script = false;
    let mut in_style = false;
    let mut text = String::new();
    let lower = html.to_lowercase();
    let chars: Vec<char> = html.chars().collect();
    let mut i = 0;

    while i < chars.len() {
        if !in_tag && i + 7 < chars.len() && lower[i..].starts_with("<script") {
            in_script = true;
        }
        if in_script && i + 8 < chars.len() && lower[i..].starts_with("</script>") {
            in_script = false;
            i += 9;
            continue;
        }
        if !in_tag && i + 6 < chars.len() && lower[i..].starts_with("<style") {
            in_style = true;
        }
        if in_style && i + 7 < chars.len() && lower[i..].starts_with("</style>") {
            in_style = false;
            i += 8;
            continue;
        }

        if in_script || in_style {
            i += 1;
            continue;
        }

        let c = chars[i];
        if c == '<' {
            in_tag = true;
        } else if c == '>' {
            in_tag = false;
            text.push(' ');
        } else if !in_tag {
            text.push(c);
        }
        i += 1;
    }

    let collapsed: Vec<&str> = text.split_whitespace().collect();
    let joined = collapsed.join(" ");
    if joined.len() > 6000 {
        format!("{}...", &joined[..6000])
    } else {
        joined
    }
}

#[tauri::command]
pub fn read_workspace_file(workspace: Option<String>, path: String) -> Result<String, String> {
    let target = if let Some(ws) = workspace.filter(|w| !w.trim().is_empty()) {
        resolve_and_validate_path(&ws, &path, false)?
    } else {
        PathBuf::from(&path)
    };
    std::fs::read_to_string(&target).map_err(|e| format!("Failed to read file: {e}"))
}

#[tauri::command]
pub fn write_workspace_file(
    workspace: Option<String>,
    path: String,
    content: String,
) -> Result<(), String> {
    let target = if let Some(ws) = workspace.filter(|w| !w.trim().is_empty()) {
        resolve_and_validate_path(&ws, &path, true)?
    } else {
        PathBuf::from(&path)
    };

    if let Some(parent) = target.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create parent directory: {e}"))?;
    }

    std::fs::write(&target, content).map_err(|e| format!("Failed to write file: {e}"))
}

#[tauri::command]
pub fn rename_workspace_file(
    workspace: String,
    old_path: String,
    new_path: String,
) -> Result<(), String> {
    let source = resolve_and_validate_path(&workspace, &old_path, false)?;
    let dest = resolve_and_validate_path(&workspace, &new_path, true)?;

    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("Failed to create parent directory: {e}"))?;
    }

    std::fs::rename(&source, &dest).map_err(|e| format!("Failed to rename: {e}"))
}

#[tauri::command]
pub fn delete_workspace_file(workspace: String, path: String) -> Result<(), String> {
    let target = resolve_and_validate_path(&workspace, &path, false)?;
    let ws_canonical = std::fs::canonicalize(&workspace)
        .map_err(|e| format!("Invalid workspace: {e}"))?;

    if target == ws_canonical {
        return Err("Cannot delete the workspace root directory".to_string());
    }

    if target.is_dir() {
        std::fs::remove_dir_all(&target).map_err(|e| format!("Failed to delete directory: {e}"))
    } else {
        std::fs::remove_file(&target).map_err(|e| format!("Failed to delete file: {e}"))
    }
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceFileEntry {
    pub name: String,
    pub path: String,
    pub is_dir: bool,
    pub size: u64,
}

/// Lists files and directories in the granted workspace (or subfolder).
/// Skips hidden files, .git, node_modules, target to stay lightweight.
#[tauri::command]
pub fn list_workspace_files(
    workspace: Option<String>,
    subpath: Option<String>,
) -> Result<Vec<WorkspaceFileEntry>, String> {
    let ws = match workspace.filter(|w| !w.trim().is_empty()) {
        Some(w) => w,
        None => return Ok(Vec::new()),
    };

    let ws_canonical = std::fs::canonicalize(&ws)
        .map_err(|e| format!("Invalid workspace root: {e}"))?;

    let target_dir = if let Some(sub) = subpath.filter(|s| !s.trim().is_empty()) {
        resolve_and_validate_path(&ws, &sub, false)?
    } else {
        ws_canonical.clone()
    };

    if !target_dir.is_dir() {
        return Err(format!("'{}' is not a directory", target_dir.display()));
    }

    let mut entries = Vec::new();
    let read_dir = std::fs::read_dir(&target_dir)
        .map_err(|e| format!("Failed to read directory: {e}"))?;

    for item in read_dir.flatten() {
        let name = item.file_name().to_string_lossy().to_string();
        if name.starts_with('.') || name == "node_modules" || name == "target" || name == "dist" {
            continue;
        }

        let full_path = item.path();
        let is_dir = full_path.is_dir();
        let size = if is_dir {
            0
        } else {
            item.metadata().map(|m| m.len()).unwrap_or(0)
        };

        let rel_path = match full_path.strip_prefix(&ws_canonical) {
            Ok(p) => p.to_string_lossy().replace('\\', "/"),
            Err(_) => name.clone(),
        };

        entries.push(WorkspaceFileEntry {
            name,
            path: rel_path,
            is_dir,
            size,
        });
    }

    entries.sort_by(|a, b| {
        match (a.is_dir, b.is_dir) {
            (true, false) => std::cmp::Ordering::Less,
            (false, true) => std::cmp::Ordering::Greater,
            _ => a.name.to_lowercase().cmp(&b.name.to_lowercase()),
        }
    });

    Ok(entries)
}

/// Safely opens a web URL in the requested browser (e.g. Brave, Chrome, Edge) or the system default
#[tauri::command]
pub fn open_url_in_browser(url: String, browser: Option<String>) -> Result<(), String> {
    let mut target_url = url.trim().to_string();
    if target_url.is_empty() {
        return Err("URL cannot be empty".to_string());
    }

    // Auto-prefix https:// if URL is domain only (e.g. "youtube.com" or "www.youtube.com")
    if !target_url.starts_with("http://")
        && !target_url.starts_with("https://")
        && !target_url.starts_with("brave://")
        && !target_url.starts_with("chrome://")
        && !target_url.starts_with("edge://")
    {
        target_url = format!("https://{target_url}");
    }

    let b_lower = browser.as_deref().unwrap_or("").to_lowercase();

    #[cfg(target_os = "windows")]
    {
        use std::path::Path;
        use std::process::Command;

        if b_lower.contains("brave") {
            let candidates = [
                r"C:\Program Files\BraveSoftware\Brave-Browser\Application\brave.exe",
                r"C:\Program Files (x86)\BraveSoftware\Brave-Browser\Application\brave.exe",
            ];
            for p in candidates {
                if Path::new(p).exists() {
                    Command::new(p)
                        .arg(&target_url)
                        .spawn()
                        .map_err(|e| format!("Failed to launch Brave: {e}"))?;
                    return Ok(());
                }
            }
            if let Ok(local) = std::env::var("LOCALAPPDATA") {
                let p = format!(r"{local}\BraveSoftware\Brave-Browser\Application\brave.exe");
                if Path::new(&p).exists() {
                    Command::new(p)
                        .arg(&target_url)
                        .spawn()
                        .map_err(|e| format!("Failed to launch Brave: {e}"))?;
                    return Ok(());
                }
            }
            // Fallback via cmd start brave
            if Command::new("cmd")
                .args(["/C", "start", "brave", &target_url])
                .spawn()
                .is_ok()
            {
                return Ok(());
            }
        } else if b_lower.contains("chrome") {
            let candidates = [
                r"C:\Program Files\Google\Chrome\Application\chrome.exe",
                r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
            ];
            for p in candidates {
                if Path::new(p).exists() {
                    Command::new(p)
                        .arg(&target_url)
                        .spawn()
                        .map_err(|e| format!("Failed to launch Chrome: {e}"))?;
                    return Ok(());
                }
            }
            if Command::new("cmd")
                .args(["/C", "start", "chrome", &target_url])
                .spawn()
                .is_ok()
            {
                return Ok(());
            }
        } else if b_lower.contains("edge") {
            if Command::new("cmd")
                .args(["/C", "start", "msedge", &target_url])
                .spawn()
                .is_ok()
            {
                return Ok(());
            }
        }

        // Default: open in Windows default browser
        Command::new("cmd")
            .args(["/C", "start", "", &target_url])
            .spawn()
            .map_err(|e| format!("Failed to open URL in browser: {e}"))?;

        Ok(())
    }

    #[cfg(not(target_os = "windows"))]
    {
        let cmd = if cfg!(target_os = "macos") { "open" } else { "xdg-open" };
        std::process::Command::new(cmd)
            .arg(&target_url)
            .spawn()
            .map_err(|e| format!("Failed to open URL: {e}"))?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_dotdot_traversal_rejected() {
        let res = resolve_and_validate_path(".", "../secret.txt", false);
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("Path traversal"));
    }

    #[test]
    fn test_empty_path_rejected() {
        let res = resolve_and_validate_path(".", "   ", false);
        assert!(res.is_err());
        assert!(res.unwrap_err().contains("empty"));
    }

    #[test]
    fn test_outside_path_rejected() {
        let res = resolve_and_validate_path(".", "C:\\Windows\\System32\\cmd.exe", false);
        assert!(res.is_err());
        let err = res.unwrap_err();
        assert!(err.contains("Access denied") || err.contains("does not exist"));
    }

    #[test]
    fn test_command_allowlist_developer_tools() {
        assert!(is_command_allowed("git status").is_ok());
        assert!(is_command_allowed("npm run build").is_ok());
        assert!(is_command_allowed("cargo check").is_ok());
        assert!(is_command_allowed("python -V").is_ok());
        assert!(is_command_allowed("npm --version").is_ok());
        assert!(is_command_allowed("yarn --version").is_ok());
        assert!(is_command_allowed("bun --version").is_ok());
        assert!(is_command_allowed("pip3 list").is_ok());
        assert!(is_command_allowed("where notepad").is_ok());
        assert!(is_command_allowed("which git").is_ok());
    }

    #[test]
    fn test_docker_read_only_allowed() {
        assert!(is_command_allowed("docker ps").is_ok());
        assert!(is_command_allowed("docker ps -a").is_ok());
        assert!(is_command_allowed("docker images").is_ok());
        assert!(is_command_allowed("docker logs container_1").is_ok());
        assert!(is_command_allowed("docker inspect container_1").is_ok());
        assert!(is_command_allowed("docker compose ps").is_ok());
        assert!(is_command_allowed("docker compose logs -f").is_ok());
    }

    #[test]
    fn test_docker_write_and_interactive_blocked() {
        assert!(is_command_allowed("docker run ubuntu").is_err());
        assert!(is_command_allowed("docker exec -it my_container bash").is_err());
        assert!(is_command_allowed("docker rm container_1").is_err());
        assert!(is_command_allowed("docker rmi my_image").is_err());
        assert!(is_command_allowed("docker compose up").is_err());
        assert!(is_command_allowed("docker compose down").is_err());
        assert!(is_command_allowed("docker system prune").is_err());
    }

    #[test]
    fn test_command_blocklist_shells_and_danger() {
        assert!(is_command_allowed("powershell -Command Get-Process").is_err());
        assert!(is_command_allowed("powershell -c whoami").is_err());
        assert!(is_command_allowed("pwsh -c whoami").is_err());
        assert!(is_command_allowed("cmd.exe /c dir").is_err());
        assert!(is_command_allowed("/bin/bash script.sh").is_err());
        assert!(is_command_allowed("/bin/sh script.sh").is_err());
        assert!(is_command_allowed("rm -rf /").is_err());
        assert!(is_command_allowed("curl https://evil.com").is_err());
        assert!(is_command_allowed("calc.exe").is_err());
    }

    #[test]
    fn test_case_insensitivity_and_inside_workspace() {
        let current_dir = std::env::current_dir().unwrap();
        let ws = current_dir.to_string_lossy();
        let lower_ws = ws.to_lowercase();
        let res = resolve_and_validate_path(&lower_ws, "Cargo.toml", false);
        assert!(res.is_ok());
    }

    #[test]
    fn test_nonexistent_write_path_allowed_inside_workspace() {
        let current_dir = std::env::current_dir().unwrap();
        let ws = current_dir.to_string_lossy();
        let res = resolve_and_validate_path(&ws, "some_new_dir/sub/test_file.txt", true);
        assert!(res.is_ok());
        let resolved = res.unwrap();
        assert!(resolved.to_string_lossy().ends_with("test_file.txt"));
    }

    #[test]
    fn test_list_workspace_files() {
        let current_dir = std::env::current_dir().unwrap();
        let ws = current_dir.to_string_lossy().to_string();
        let list = list_workspace_files(Some(ws), None).unwrap();
        assert!(!list.is_empty());
        assert!(list.iter().any(|e| e.name == "Cargo.toml"));
    }
}

