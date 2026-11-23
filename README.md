# Focal

A small focus timer (Tauri 2 + React) with an always-on-top window that works on GNOME Wayland.

## One-time setup

```sh
sudo apt install libwebkit2gtk-4.1-dev libayatana-appindicator3-dev librsvg2-dev libxdo-dev libssl-dev
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh   # then open a new terminal
bun install
```

## Run / build

```sh
bun tauri dev      # dev window with hot reload
bun tauri build    # .deb + AppImage in src-tauri/target/release/bundle/
sudo apt install ./src-tauri/target/release/bundle/deb/Focal_0.1.0_amd64.deb
```

## Why always-on-top works

GNOME on Wayland ignores "keep me on top" requests from apps. `src-tauri/src/main.rs` sets
`GDK_BACKEND=x11` before startup so the window runs through XWayland, where the request works.
Run with `FOCAL_WAYLAND=1` to opt out.

## Layout

- `src/App.tsx` – timer engine (wall-clock based, no drift), ring, tray/keyboard wiring
- `src/SettingsView.tsx` – Timer / Behaviour / Themes / Sounds / Labels / About tabs
- `src/themes.ts` – add a theme = add one line
- `src/sound.ts` – built-in chimes and tick (Web Audio), custom files
- `src-tauri/src/lib.rs` – tray menu, tray countdown label, plugins
