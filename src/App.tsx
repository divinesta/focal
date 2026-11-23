import { useEffect, useRef, useState } from "react";
import { durationMs, loadSettings, saveSettings, type Phase, type Settings } from "./settings";
import { applyTheme } from "./themes";
import { chime, tick } from "./sound";
import * as native from "./native";
import { Icon } from "./icons";
import SettingsView from "./SettingsView";
import { resolveRing } from "./appearance";

type Timer = {
  phase: Phase;
  round: number;
  remaining: number; // ms left while paused
  endAt: number | null; // wall-clock end while running (no drift when minimized)
  pristine: boolean; // not started yet in this phase
};

const fmt = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [view, setView] = useState<"timer" | "settings">("timer");
  const [timer, setTimer] = useState<Timer>(() => ({
    phase: "focus", round: 1, remaining: durationMs(settings, "focus"), endAt: null, pristine: true,
  }));
  const [now, setNow] = useState(Date.now());
  const s = useRef(settings);
  s.current = settings;

  const update = (patch: Partial<Settings>) => setSettings((prev) => ({ ...prev, ...patch }));

  // ---- persistence + native sync ----
  useEffect(() => { saveSettings(settings); applyTheme(settings.theme); }, [settings]);
  useEffect(() => { native.setAlwaysOnTop(settings.alwaysOnTop); }, [settings.alwaysOnTop]);
  useEffect(() => { native.syncAutostart(settings.autostart); }, [settings.autostart]);
  useEffect(() => { if (!s.current.startMinimized) native.showWindow(); }, []);

  // ---- timer engine ----
  const running = timer.endAt !== null;
  const remaining = running ? timer.endAt! - now : timer.remaining;
  const total = durationMs(settings, timer.phase);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [running]);

  const advance = (completed: boolean) => {
    const cfg = s.current;
    const { phase, round } = timer;
    let next: Phase;
    let nextRound = round;
    if (phase === "focus") next = round >= cfg.rounds ? "long" : "short";
    else {
      next = "focus";
      nextRound = phase === "long" ? 1 : round + 1;
    }
    const dur = durationMs(cfg, next);
    const autoStart = completed ? cfg.autoContinue : running;
    const t = Date.now();
    setTimer({ phase: next, round: nextRound, remaining: dur, endAt: autoStart ? t + dur : null, pristine: !autoStart });
    setNow(t);
    if (completed) {
      chime(next, cfg.sounds[next], cfg.volume);
      if (cfg.notifications) native.notify(`${cfg.labels[phase]} finished`, `Up next: ${cfg.labels[next]} (${fmt(dur)})`);
    }
  };

  useEffect(() => {
    if (timer.endAt !== null && now >= timer.endAt) advance(true);
  }, [now]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = () => {
    const t = Date.now();
    setTimer((x) => x.endAt !== null
      ? { ...x, remaining: Math.max(0, x.endAt - t), endAt: null }
      : { ...x, endAt: t + x.remaining, pristine: false });
    setNow(t);
  };
  const reset = () => setTimer((x) => ({ ...x, remaining: durationMs(s.current, x.phase), endAt: null, pristine: true }));
  const resetAll = () => setTimer({ phase: "focus", round: 1, remaining: durationMs(s.current, "focus"), endAt: null, pristine: true });

  // Duration changed in settings: apply to the current phase if it hasn't started yet.
  useEffect(() => {
    setTimer((x) => (x.pristine && x.endAt === null ? { ...x, remaining: durationMs(s.current, x.phase) } : x));
  }, [settings.focusMin, settings.shortMin, settings.longMin]);
  useEffect(() => {
    setTimer((x) => (x.round > settings.rounds ? { ...x, round: settings.rounds } : x));
  }, [settings.rounds]);

  // Ticking sound, once per displayed second.
  const secs = Math.ceil(remaining / 1000);
  const lastSec = useRef(secs);
  useEffect(() => {
    if (running && secs !== lastSec.current) {
      const on = timer.phase === "focus" ? s.current.tickFocus : s.current.tickBreak;
      if (on) tick(s.current.volume);
    }
    lastSec.current = secs;
  }, [secs]); // eslint-disable-line react-hooks/exhaustive-deps

  // Tray label.
  const label = settings.labels[timer.phase];
  const trayText = settings.trayTimer && !timer.pristine ? `${fmt(remaining)} ${running ? label : "(paused)"}` : "";
  useEffect(() => { native.setTrayLabel(trayText); }, [trayText]);

  // Tray menu + keyboard shortcuts (refs so listeners always call the latest closures).
  const actions = useRef({ toggle, skip: () => advance(false), reset });
  actions.current = { toggle, skip: () => advance(false), reset };
  useEffect(() => {
    const offs = [
      native.onTrayEvent("tray-toggle", () => actions.current.toggle()),
      native.onTrayEvent("tray-skip", () => actions.current.skip()),
    ];
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, select")) return;
      if (e.code === "Space") { e.preventDefault(); actions.current.toggle(); }
      else if (e.key === "r") actions.current.reset();
      else if (e.key === "s") actions.current.skip();
      else if (e.key === "Escape") setView("timer");
      else if (e.key === ",") setView("settings");
    };
    window.addEventListener("keydown", onKey);
    return () => { offs.forEach((f) => f()); window.removeEventListener("keydown", onKey); };
  }, []);

  useEffect(() => { document.title = trayText ? `${trayText} · Focal` : "Focal"; }, [trayText]);

  // ---- window buttons ----
  const onMinimize = () => (settings.minimizeToTray ? native.hideWindow() : native.minimizeWindow());
  const onClose = () => (settings.closeToTray ? native.hideWindow() : native.quit());

  // ---- ring geometry ----
  const R = 100;
  const C = 2 * Math.PI * R;
  const progress = Math.min(1, Math.max(0, remaining / total));

  // ---- appearance ----
  const ring = resolveRing(settings.ringColor);
  const ringStroke = ring ? (ring.length > 1 ? "url(#ringGrad)" : ring[0]) : undefined;
  // Settings stay readable even when the timer background is see-through.
  const bgOp = view === "settings" ? Math.max(settings.bgOpacity, 94) : settings.bgOpacity;
  const appClass = [
    "app",
    settings.autoHideTitlebar && "autohide",
    settings.roundedCorners && "rounded",
    settings.solidOnHover && "solidhover",
    bgOp < 100 && "see-through",
    bgOp < 35 && "clear",
  ].filter(Boolean).join(" ");
  const appStyle = {
    "--bg-op": `${bgOp}%`,
    "--ring-w": settings.ringWidth,
    ...(ring ? { "--accent": ring[0] } : {}),
  } as React.CSSProperties;

  return (
    <div className={appClass} style={appStyle} data-phase={timer.phase} data-view={view}>
      <header className="titlebar" data-tauri-drag-region>
        <button className="icon-btn" onClick={() => setView(view === "timer" ? "settings" : "timer")}
          title={view === "timer" ? "Settings (,)" : "Back (Esc)"}>
          <Icon name={view === "timer" ? "menu" : "back"} />
        </button>
        <button className={`icon-btn ${settings.alwaysOnTop ? "active" : ""}`}
          onClick={() => update({ alwaysOnTop: !settings.alwaysOnTop })}
          title={settings.alwaysOnTop ? "Always on top: on" : "Always on top: off"}>
          <Icon name="pin" size={18} />
        </button>
        <h1 data-tauri-drag-region>Focal</h1>
        <button className="icon-btn" onClick={onMinimize} title="Minimize"><Icon name="min" /></button>
        <button className="icon-btn" onClick={onClose} title="Close"><Icon name="close" /></button>
      </header>

      {view === "timer" ? (
        <main className="timer" data-tauri-drag-region>
          <div className="ring-wrap" data-tauri-drag-region>
          <div className="ring" onClick={toggle} title="Click to start / pause">
            <svg viewBox="0 0 240 240">
              {ring && ring.length > 1 && (
                <defs>
                  <linearGradient id="ringGrad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="240" y2="240">
                    {ring.map((c, i) => <stop key={i} offset={i / (ring.length - 1)} stopColor={c} />)}
                  </linearGradient>
                </defs>
              )}
              <circle className="track" cx="120" cy="120" r={R} />
              <circle className="bar" cx="120" cy="120" r={R} style={ringStroke ? { stroke: ringStroke } : undefined}
                strokeDasharray={C} strokeDashoffset={C * (1 - progress)} transform="rotate(-90 120 120)" />
            </svg>
            <div className="readout">
              <div className="time">{fmt(remaining)}</div>
              <div className="phase">{label}</div>
            </div>
          </div>
          </div>

          <div className="controls">
            <button className="icon-btn" onClick={reset} title="Restart this phase (R)"><Icon name="reset" /></button>
            <button className="play" onClick={toggle} title="Start / pause (Space)">
              <Icon name={running ? "pause" : "play"} size={22} fill />
            </button>
            <button className="icon-btn" onClick={() => advance(false)} title="Skip phase (S)"><Icon name="skip" fill /></button>
          </div>

          <div className="rounds" onDoubleClick={resetAll} title="Round progress (double-click to reset)">
            {Array.from({ length: settings.rounds }, (_, i) => (
              <span key={i} className={`dot ${i + 1 < timer.round || (i + 1 === timer.round && timer.phase !== "focus") ? "done" : ""} ${i + 1 === timer.round ? "current" : ""}`} />
            ))}
          </div>
        </main>
      ) : (
        <SettingsView settings={settings} update={update} />
      )}
    </div>
  );
}
