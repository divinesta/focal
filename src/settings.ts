export type Phase = "focus" | "short" | "long";

export type Settings = {
  focusMin: number;
  shortMin: number;
  longMin: number;
  rounds: number;
  autoContinue: boolean;
  alwaysOnTop: boolean;
  autostart: boolean;
  notifications: boolean;
  minimizeToTray: boolean;
  closeToTray: boolean;
  startMinimized: boolean;
  trayTimer: boolean;
  autoHideTitlebar: boolean;
  ringColor: string; // "phase" | "#hex" | "grad:<id>"
  ringWidth: number;
  bgOpacity: number; // 0..100
  roundedCorners: boolean;
  solidOnHover: boolean;
  theme: string;
  tickFocus: boolean;
  tickBreak: boolean;
  volume: number; // 0..1
  sounds: Record<Phase, string | null>; // data: URLs for custom sounds, null = built-in chime
  soundNames: Record<Phase, string | null>;
  labels: Record<Phase, string>;
};

export const DEFAULTS: Settings = {
  focusMin: 25,
  shortMin: 5,
  longMin: 20,
  rounds: 4,
  autoContinue: true,
  alwaysOnTop: true,
  autostart: false,
  notifications: true,
  minimizeToTray: false,
  closeToTray: true,
  startMinimized: false,
  trayTimer: true,
  autoHideTitlebar: true,
  ringColor: "phase",
  ringWidth: 9,
  bgOpacity: 100,
  roundedCorners: true,
  solidOnHover: false,
  theme: "tokyo-night-storm",
  tickFocus: false,
  tickBreak: false,
  volume: 0.7,
  sounds: { focus: null, short: null, long: null },
  soundNames: { focus: null, short: null, long: null },
  labels: { focus: "Focus", short: "Short break", long: "Long break" },
};

const KEY = "focal.settings.v1";

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const s = JSON.parse(raw);
    return {
      ...DEFAULTS,
      ...s,
      sounds: { ...DEFAULTS.sounds, ...s.sounds },
      soundNames: { ...DEFAULTS.soundNames, ...s.soundNames },
      labels: { ...DEFAULTS.labels, ...s.labels },
    };
  } catch {
    return DEFAULTS;
  }
}

export function saveSettings(s: Settings) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch (e) {
    console.error("Could not save settings", e);
  }
}

export function durationMs(s: Settings, p: Phase) {
  const min = p === "focus" ? s.focusMin : p === "short" ? s.shortMin : s.longMin;
  return min * 60_000;
}
