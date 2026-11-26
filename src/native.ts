// Thin wrapper around Tauri APIs so the UI also runs in a plain browser (`bun run dev`).
import { invoke } from "@tauri-apps/api/core";
import { emit, listen } from "@tauri-apps/api/event";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import type { OverlayAction, OverlayState } from "./overlayState";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { disable, enable, isEnabled } from "@tauri-apps/plugin-autostart";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";

export const isTauri = "__TAURI_INTERNALS__" in window;
const safe = async (fn: () => Promise<unknown>) => {
  if (!isTauri) return;
  try {
    await fn();
  } catch (e) {
    console.error(e);
  }
};

export const showWindow = () => safe(async () => {
  const w = getCurrentWindow();
  await w.show();
  await w.setFocus();
});
export const hideWindow = () => safe(() => getCurrentWindow().hide());
export const minimizeWindow = () => safe(() => getCurrentWindow().minimize());
export const quit = () => (isTauri ? safe(() => invoke("quit_app")) : Promise.resolve(window.close()));
export const setAlwaysOnTop = (v: boolean) => safe(() => getCurrentWindow().setAlwaysOnTop(v));
export const setTrayLabel = (label: string) => safe(() => invoke("set_tray_label", { label }));
export const saveTimerFile = (json: string) => safe(() => invoke("save_timer", { json }));

export const syncAutostart = (want: boolean) => safe(async () => {
  const on = await isEnabled();
  if (want && !on) await enable();
  if (!want && on) await disable();
});

export async function notify(title: string, body: string) {
  if (!isTauri) {
    if ("Notification" in window && Notification.permission === "granted") new Notification(title, { body });
    return;
  }
  await safe(async () => {
    let ok = await isPermissionGranted();
    if (!ok) ok = (await requestPermission()) === "granted";
    if (ok) sendNotification({ title, body });
  });
}

export function onTrayEvent(name: "tray-toggle" | "tray-skip" | "tray-break", cb: () => void) {
  if (!isTauri) return () => {};
  const p = listen(name, cb);
  return () => void p.then((un) => un());
}

// ---- full-screen break window ----
// Created on demand and destroyed when closed, so its web process only exists during a break.
const getOverlay = () => WebviewWindow.getByLabel("overlay");

export const isMainVisible = async () => (isTauri ? getCurrentWindow().isVisible().catch(() => true) : true);

async function ensureOverlay() {
  const existing = await getOverlay();
  if (existing) return existing;
  const w = new WebviewWindow("overlay", {
    url: "overlay.html",
    title: "Focal break",
    decorations: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    fullscreen: true,
    focus: true,
  });
  await new Promise<void>((resolve, reject) => {
    w.once("tauri://created", () => resolve());
    w.once("tauri://error", (e) => reject(e.payload));
  });
  // Closed some other way (e.g. Alt+F4): tell the main window so its state stays in sync.
  w.once("tauri://destroyed", () => emit("overlay-action", "dismiss"));
  return w;
}

export const showOverlay = () => safe(async () => {
  const w = await ensureOverlay();
  await w.setAlwaysOnTop(true);
  await w.setFocus();
});

export const hideOverlay = () => safe(async () => {
  const w = await getOverlay();
  if (w) await w.destroy();
});

export const sendOverlayState = (st: OverlayState) => safe(() => emit("overlay-state", st));

export function onOverlayAction(cb: (a: OverlayAction) => void) {
  if (!isTauri) return () => {};
  const p = listen<OverlayAction>("overlay-action", (e) => cb(e.payload));
  return () => void p.then((un) => un());
}
