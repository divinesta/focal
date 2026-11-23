#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    #[cfg(target_os = "linux")]
    {
        // GNOME on Wayland ignores "always on top" requests from apps.
        // Running through XWayland makes the request work. Set FOCAL_WAYLAND=1 to opt out.
        if std::env::var_os("FOCAL_WAYLAND").is_none() {
            std::env::set_var("GDK_BACKEND", "x11");
        }
        // Avoids blank/white WebKitGTK windows on some GPU drivers.
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }
    focal_lib::run()
}
