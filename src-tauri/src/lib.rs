use std::{fs, path::PathBuf};
use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::TrayIconBuilder,
    AppHandle, Emitter, Manager,
};

/// Text shown next to the tray icon (e.g. "24:13 Focus"). Empty string clears it.
#[tauri::command]
fn set_tray_label(app: AppHandle, label: String) {
    if let Some(tray) = app.tray_by_id("main") {
        let text = if label.is_empty() { None } else { Some(label.as_str()) };
        let _ = tray.set_title(text);
        let _ = tray.set_tooltip(Some(text.unwrap_or("Focal")));
    }
}

/// Where the running timer is saved: ~/.local/share/app.focal.timer/timer.json on Linux.
/// Computed without an AppHandle so it can be read before any window exists.
fn timer_file() -> Option<PathBuf> {
    let base = std::env::var_os("XDG_DATA_HOME")
        .map(PathBuf::from)
        .or_else(|| std::env::var_os("HOME").map(|h| PathBuf::from(h).join(".local/share")))?;
    Some(base.join("app.focal.timer").join("timer.json"))
}

/// Saved synchronously on every timer change, so quitting right after can't lose it
/// (WebKit's localStorage writes to disk with a delay and can be cut off on exit).
#[tauri::command]
fn save_timer(json: String) {
    let Some(path) = timer_file() else { return };
    if serde_json::from_str::<serde_json::Value>(&json).is_err() {
        return;
    }
    if let Some(dir) = path.parent() {
        let _ = fs::create_dir_all(dir);
    }
    let tmp = path.with_extension("json.tmp");
    if fs::write(&tmp, json).is_ok() {
        let _ = fs::rename(tmp, path); // atomic replace: never a half-written file
    }
}

/// Script that hands the saved timer to the page before any of its code runs.
fn timer_init_script() -> String {
    let saved = timer_file()
        .and_then(|p| fs::read_to_string(p).ok())
        .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok())
        .map(|v| v.to_string())
        .unwrap_or_else(|| "null".into());
    format!("window.__FOCAL_TIMER__ = {saved};")
}

#[tauri::command]
fn quit_app(app: AppHandle) {
    app.exit(0);
}

fn show_window(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

fn toggle_window(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        if w.is_visible().unwrap_or(false) {
            let _ = w.hide();
        } else {
            show_window(app);
        }
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            show_window(app);
        }))
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_autostart::init(
            tauri_plugin_autostart::MacosLauncher::LaunchAgent,
            Some(vec!["--autostart"]),
        ))
        .plugin(
            tauri::plugin::Builder::<tauri::Wry>::new("focal-state")
                .js_init_script(timer_init_script())
                .build(),
        )
        .invoke_handler(tauri::generate_handler![set_tray_label, quit_app, save_timer])
        // A small timer doesn't need a browser-sized cache: use WebKit's leanest cache model.
        .on_page_load(|webview, _payload| {
            #[cfg(target_os = "linux")]
            let _ = webview.with_webview(|wv| {
                use webkit2gtk::{CacheModel, WebContextExt, WebViewExt};
                if let Some(ctx) = wv.inner().context() {
                    ctx.set_cache_model(CacheModel::DocumentViewer);
                }
            });
        })
        .setup(|app| {
            let show = MenuItem::with_id(app, "show", "Show / Hide", true, None::<&str>)?;
            let toggle = MenuItem::with_id(app, "toggle", "Start / Pause", true, None::<&str>)?;
            let skip = MenuItem::with_id(app, "skip", "Skip phase", true, None::<&str>)?;
            let brk = MenuItem::with_id(app, "break", "Show break screen", true, None::<&str>)?;
            let sep = PredefinedMenuItem::separator(app)?;
            let quit = MenuItem::with_id(app, "quit", "Quit Focal", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show, &toggle, &skip, &brk, &sep, &quit])?;

            TrayIconBuilder::with_id("main")
                .icon(app.default_window_icon().cloned().expect("missing app icon"))
                .tooltip("Focal")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => toggle_window(app),
                    "toggle" => {
                        let _ = app.emit("tray-toggle", ());
                    }
                    "skip" => {
                        let _ = app.emit("tray-skip", ());
                    }
                    "break" => {
                        let _ = app.emit("tray-break", ());
                    }
                    "quit" => app.exit(0),
                    _ => {}
                })
                .build(app)?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running Focal");
}
