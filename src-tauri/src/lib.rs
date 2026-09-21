mod ai;
mod audio;
mod commands;
mod personality;
mod state;
mod storage;

use tauri::menu::{Menu, MenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{LogicalPosition, Manager, Position};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

const TOGGLE_SHORTCUT: &str = "CmdOrCtrl+Shift+M";

fn toggle_main_window(app: &tauri::AppHandle) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };
    let visible = window.is_visible().unwrap_or(false);
    if visible {
        let _ = window.hide();
    } else {
        let _ = window.show();
        let _ = window.set_focus();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec![]),
        ))
        .plugin(
            tauri_plugin_global_shortcut::Builder::new()
                .with_handler(|app, shortcut, event| {
                    let key_str = shortcut.to_string();
                    if key_str.eq_ignore_ascii_case(TOGGLE_SHORTCUT) && event.state() == ShortcutState::Pressed {
                        toggle_main_window(app);
                    } else if key_str.eq_ignore_ascii_case("F1") {
                        use tauri::Emitter;
                        if event.state() == ShortcutState::Pressed {
                            let _ = app.emit("ptt-start", ());
                        } else if event.state() == ShortcutState::Released {
                            let _ = app.emit("ptt-stop", ());
                        }
                    }
                })
                .build(),
        )
        .setup(|app| {
            let handle = app.handle().clone();
            let settings = storage::settings::load(&handle);

            let window = app
                .get_webview_window("main")
                .expect("the 'main' window is declared in tauri.conf.json");

            // Restore where the user last left Hermoz, and the window flags
            // they had configured, before the window is ever shown.
            if let Some(pos) = settings.window_position {
                let _ = window.set_position(Position::Logical(LogicalPosition::new(pos.x, pos.y)));
            }
            let _ = window.set_always_on_top(settings.always_on_top);
            let _ = window.set_ignore_cursor_events(settings.click_through);

            let exclude_from_capture = settings.exclude_from_capture;
            app.manage(state::AppState::new(settings));

            window.show().ok();

            #[cfg(target_os = "windows")]
            {
                use std::ffi::c_void;
                if let Ok(hwnd) = window.hwnd() {
                    extern "system" {
                        fn SetWindowDisplayAffinity(hwnd: *mut c_void, dwAffinity: u32) -> i32;
                    }
                    const WDA_NONE: u32 = 0x00000000;
                    const WDA_EXCLUDEFROMCAPTURE: u32 = 0x00000011;
                    let affinity = if exclude_from_capture {
                        WDA_EXCLUDEFROMCAPTURE
                    } else {
                        WDA_NONE
                    };
                    unsafe {
                        let res = SetWindowDisplayAffinity(hwnd.0 as *mut c_void, affinity);
                        if res == 0 {
                            log::warn!("SetWindowDisplayAffinity({affinity}) returned 0 during setup.");
                        } else {
                            log::info!("Hermoz window affinity set to {affinity} on startup.");
                        }
                    }
                }
            }

            if let Err(e) = app.global_shortcut().register(TOGGLE_SHORTCUT) {
                log::warn!("could not register global shortcut {TOGGLE_SHORTCUT}: {e}");
            }
            if let Err(e) = app.global_shortcut().register("F1") {
                log::info!("Global F1 shortcut note (in-app F1 listener active): {e}");
            }

            // Tray icon so Hermoz can be quit or brought back even when
            // click-through/hidden - there are no window decorations to
            // click otherwise.
            let show_hide = MenuItem::with_id(app, "toggle", "Show / Hide Hermoz", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit Hermoz", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_hide, &quit])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().cloned().unwrap())
                .menu(&menu)
                .tooltip("Hermoz")
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "toggle" => toggle_main_window(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::ai::ai_generate,
            commands::ai::get_provider_status,
            commands::settings::get_settings,
            commands::settings::update_settings,
            commands::settings::save_api_key,
            commands::settings::clear_api_key,
            commands::window::resize_window,
            commands::window::save_window_position,
            commands::window::minimize_window,
            commands::window::toggle_maximize_window,
            commands::window::close_window,
            commands::window::exclude_from_capture,
            commands::window::set_exclude_from_capture,
            commands::window::get_exclude_from_capture,
            commands::state::get_canonical_state,
            commands::state::update_canonical_state,
            commands::state::persist_message,
            commands::tts::tts_speak,
            commands::voice::transcribe_audio,
            commands::workspace::execute_workspace_command,
            commands::workspace::fetch_web_content,
            commands::workspace::read_workspace_file,
            commands::workspace::write_workspace_file,
            commands::workspace::rename_workspace_file,
            commands::workspace::delete_workspace_file,
            commands::workspace::list_workspace_files,
            commands::workspace::choose_workspace_folder,
            commands::workspace::open_url_in_browser,
            commands::launch::launch_app,
        ])
        .run(tauri::generate_context!())
        .expect("error while running Hermoz");
}
