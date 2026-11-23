// Thin wrapper around Tauri APIs so the UI also runs in a plain browser (`bun run dev`).
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
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

export function onTrayEvent(name: "tray-toggle" | "tray-skip", cb: () => void) {
  if (!isTauri) return () => {};
  const p = listen(name, cb);
  return () => void p.then((un) => un());
}
