use tauri::{LogicalSize, State};

use crate::state::AppState;
use crate::storage::settings::WindowPosition;

/// Grows or shrinks the (otherwise chrome-less) window to fit whichever
/// panel is currently open. Position is left untouched by the caller so
/// Momo doesn't appear to jump.
#[tauri::command]
pub fn resize_window(window: tauri::Window, width: f64, height: f64) -> Result<(), String> {
    window
        .set_size(LogicalSize::new(width, height))
        .map_err(|e| e.to_string())
}

/// Called once a drag gesture (see `Panda.tsx`'s use of `startDragging`)
/// finishes, so the new position survives an app restart.
#[tauri::command]
pub fn save_window_position(
    window: tauri::Window,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let scale = window.scale_factor().map_err(|e| e.to_string())?;
    let physical = window.outer_position().map_err(|e| e.to_string())?;
    let logical = physical.to_logical::<f64>(scale);

    let mut settings = state.settings.lock().unwrap();
    settings.window_position = Some(WindowPosition {
        x: logical.x,
        y: logical.y,
    });
    crate::storage::settings::save(&app, &settings)
}

/// Dedicated Rust command to minimize window (bypasses JS API permission restrictions)
#[tauri::command]
pub fn minimize_window(window: tauri::Window) -> Result<(), String> {
    window.minimize().map_err(|e| e.to_string())
}

/// Dedicated Rust command to toggle maximize window
#[tauri::command]
pub fn toggle_maximize_window(window: tauri::Window) -> Result<bool, String> {
    let is_max = window.is_maximized().map_err(|e| e.to_string())?;
    if is_max {
        window.unmaximize().map_err(|e| e.to_string())?;
        Ok(false)
    } else {
        window.maximize().map_err(|e| e.to_string())?;
        Ok(true)
    }
}

/// Dedicated Rust command to close the window
#[tauri::command]
pub fn close_window(window: tauri::Window) -> Result<(), String> {
    window.close().map_err(|e| e.to_string())
}

/// Excludes or includes Momo's window in screen captures (WDA_EXCLUDEFROMCAPTURE = 0x00000011 vs WDA_NONE = 0).
/// Persists the choice into settings and applies affinity live.
#[tauri::command]
pub fn set_exclude_from_capture(
    window: tauri::Window,
    app: tauri::AppHandle,
    state: State<'_, AppState>,
    enabled: bool,
) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::ffi::c_void;
        let hwnd = window.hwnd().map_err(|e| e.to_string())?;
        extern "system" {
            fn SetWindowDisplayAffinity(hwnd: *mut c_void, dwAffinity: u32) -> i32;
        }
        const WDA_NONE: u32 = 0x00000000;
        const WDA_EXCLUDEFROMCAPTURE: u32 = 0x00000011;
        let affinity = if enabled {
            WDA_EXCLUDEFROMCAPTURE
        } else {
            WDA_NONE
        };
        let res = unsafe { SetWindowDisplayAffinity(hwnd.0 as *mut c_void, affinity) };
        if res == 0 {
            log::warn!("SetWindowDisplayAffinity({affinity}) returned 0; older Windows build or limitation.");
        } else {
            log::info!("Live window affinity updated to {affinity} (enabled={enabled}).");
        }
    }

    let mut settings = state.settings.lock().unwrap();
    settings.exclude_from_capture = enabled;
    crate::storage::settings::save(&app, &settings)
}

/// Returns the current state of exclude_from_capture from settings
#[tauri::command]
pub fn get_exclude_from_capture(state: State<'_, AppState>) -> Result<bool, String> {
    let settings = state.settings.lock().unwrap();
    Ok(settings.exclude_from_capture)
}

/// Helper command for backwards compatibility
#[tauri::command]
pub fn exclude_from_capture(window: tauri::Window) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::ffi::c_void;
        let hwnd = window.hwnd().map_err(|e| e.to_string())?;
        extern "system" {
            fn SetWindowDisplayAffinity(hwnd: *mut c_void, dwAffinity: u32) -> i32;
        }
        const WDA_EXCLUDEFROMCAPTURE: u32 = 0x00000011;
        unsafe {
            SetWindowDisplayAffinity(hwnd.0 as *mut c_void, WDA_EXCLUDEFROMCAPTURE);
        }
    }
    Ok(())
}

