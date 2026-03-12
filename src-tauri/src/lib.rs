mod actions;
mod config;

use config::{load_config, save_config_to_disk, RingConfig};
use std::sync::Mutex;
use tauri::{
    image::Image,
    menu::{MenuBuilder, MenuItemBuilder},
    tray::TrayIconBuilder,
    Manager, WebviewUrl, WebviewWindowBuilder,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, Shortcut};

struct AppState {
    config: Mutex<RingConfig>,
}

#[tauri::command]
fn get_config(state: tauri::State<AppState>) -> RingConfig {
    state.config.lock().unwrap().clone()
}

#[tauri::command]
fn save_config(
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
    config: RingConfig,
) -> Result<(), String> {
    let old_shortcut = state.config.lock().unwrap().shortcut.clone();
    save_config_to_disk(&app, &config)?;

    // Re-register shortcut if it changed
    if old_shortcut != config.shortcut {
        if let Ok(old) = old_shortcut.parse::<Shortcut>() {
            app.global_shortcut().unregister(old).ok();
        }
        register_shortcut(&app, &config.shortcut);
    }

    // Update slices in ring window if it exists
    if let Some(ring) = app.get_webview_window("ring") {
        let slices_json = serde_json::to_string(&config.slices).unwrap_or_default();
        ring.eval(&format!("window.__updateSlices({})", slices_json))
            .ok();
    }

    *state.config.lock().unwrap() = config;
    Ok(())
}

#[tauri::command]
fn execute_action(state: tauri::State<AppState>, index: usize) -> Result<(), String> {
    let config = state.config.lock().unwrap();
    let slice = config.slices.get(index).ok_or("Invalid slice index")?;
    actions::execute(&slice.action)
}

#[tauri::command]
fn hide_ring(app: tauri::AppHandle) {
    if let Some(ring) = app.get_webview_window("ring") {
        ring.hide().ok();
    }
}

fn register_shortcut(app: &tauri::AppHandle, shortcut_str: &str) {
    let shortcut: Shortcut = match shortcut_str.parse() {
        Ok(s) => s,
        Err(e) => {
            eprintln!("Invalid shortcut '{}': {}", shortcut_str, e);
            return;
        }
    };

    let app_handle = app.clone();
    if let Err(e) = app
        .global_shortcut()
        .on_shortcut(shortcut, move |_app, _shortcut, event| {
            if event.state == tauri_plugin_global_shortcut::ShortcutState::Pressed {
                show_ring_at_cursor(&app_handle);
            }
        })
    {
        eprintln!("Failed to register shortcut: {}", e);
    }
}

fn show_ring_at_cursor(app: &tauri::AppHandle) {
    let ring_size: f64 = 400.0;

    // Get cursor position via CGEvent (works globally on macOS)
    let (cx, cy) = get_cursor_position();

    let x = cx - ring_size / 2.0;
    let y = cy - ring_size / 2.0;

    if let Some(ring) = app.get_webview_window("ring") {
        use tauri::{LogicalPosition, LogicalSize};
        ring.set_size(LogicalSize::new(ring_size, ring_size)).ok();
        ring.set_position(LogicalPosition::new(x, y)).ok();
        ring.show().ok();
        ring.set_focus().ok();
    }
}

#[cfg(target_os = "macos")]
fn get_cursor_position() -> (f64, f64) {
    use std::ffi::c_void;

    #[link(name = "CoreGraphics", kind = "framework")]
    extern "C" {
        fn CGEventCreate(source: *const c_void) -> *const c_void;
        fn CFRelease(cf: *const c_void);
    }

    #[link(name = "CoreGraphics", kind = "framework")]
    extern "C" {
        fn CGEventGetLocation(event: *const c_void) -> CGPoint;
    }

    #[repr(C)]
    struct CGPoint {
        x: f64,
        y: f64,
    }

    unsafe {
        let event = CGEventCreate(std::ptr::null());
        let point = CGEventGetLocation(event);
        CFRelease(event);
        (point.x, point.y)
    }
}

#[cfg(not(target_os = "macos"))]
fn get_cursor_position() -> (f64, f64) {
    (0.0, 0.0)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            let config = load_config(&app.handle());

            // Create ring window (hidden initially, transparent on macOS)
            let _ring =
                WebviewWindowBuilder::new(app, "ring", WebviewUrl::App("ring.html".into()))
                    .title("Ring")
                    .inner_size(400.0, 400.0)
                    .decorations(false)
                    .transparent(true)
                    .always_on_top(true)
                    .skip_taskbar(true)
                    .resizable(false)
                    .visible(false)
                    .build()?;

            // Register global shortcut
            register_shortcut(&app.handle(), &config.shortcut);

            // Store config in state
            app.manage(AppState {
                config: Mutex::new(config),
            });

            // Build tray
            let show_item = MenuItemBuilder::with_id("show", "Show Config").build(app)?;
            let quit_item = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
            let menu = MenuBuilder::new(app)
                .items(&[&show_item, &quit_item])
                .build()?;

            let tray_icon = app.default_window_icon().cloned().unwrap_or_else(|| {
                Image::from_path("icons/32x32.png")
                    .expect("failed to load tray icon")
            });

            let _tray = TrayIconBuilder::new()
                .icon(tray_icon)
                .menu(&menu)
                .on_menu_event(|app, event| match event.id().as_ref() {
                    "show" => {
                        if let Some(w) = app.get_webview_window("main") {
                            w.show().ok();
                            w.set_focus().ok();
                        }
                    }
                    "quit" => {
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click { button, .. } = event {
                        if button == tauri::tray::MouseButton::Left {
                            let app = tray.app_handle();
                            if let Some(w) = app.get_webview_window("main") {
                                w.show().ok();
                                w.set_focus().ok();
                            }
                        }
                    }
                })
                .build(app)?;

            // Hide main window on close (keep in tray)
            let app_handle = app.handle().clone();
            if let Some(main_window) = app.get_webview_window("main") {
                main_window.on_window_event(move |event| {
                    if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                        api.prevent_close();
                        if let Some(w) = app_handle.get_webview_window("main") {
                            w.hide().ok();
                        }
                    }
                });
            }

            // Hide ring on blur/focus-lost
            let ring_app = app.handle().clone();
            if let Some(ring_win) = app.get_webview_window("ring") {
                ring_win.on_window_event(move |event| {
                    if let tauri::WindowEvent::Focused(false) = event {
                        if let Some(r) = ring_app.get_webview_window("ring") {
                            r.hide().ok();
                        }
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            get_config,
            save_config,
            execute_action,
            hide_ring,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
