import { useEffect, useRef, useState } from "react";
import { durationMs, loadSettings, saveSettings, type Phase, type Settings } from "./settings";
import { applyTheme } from "./themes";
import { chime, tick } from "./sound";
import * as native from "./native";
import { Icon } from "./icons";
import SettingsView from "./SettingsView";
import { resolveRing } from "./appearance";
import { fmt } from "./format";
import type { OverlayState } from "./overlayState";

type Timer = {
  phase: Phase;
  round: number;
  remaining: number; // ms left while paused
  endAt: number | null; // wall-clock end while running (no drift when minimized)
  pristine: boolean; // not started yet in this phase
};


const TIMER_KEY = "focal.timer.v1";

/** Phase that follows `phase`, and its round number. */
function nextPhase(phase: Phase, round: number, rounds: number): { next: Phase; nextRound: number } {
  if (phase === "focus") return { next: round >= rounds ? "long" : "short", nextRound: round };
  return { next: "focus", nextRound: phase === "long" ? 1 : round + 1 };
}

/** Restore the timer saved before the app was closed. */
function loadTimer(cfg: Settings): Timer {
  const fresh: Timer = { phase: "focus", round: 1, remaining: durationMs(cfg, "focus"), endAt: null, pristine: true };
  try {
    // Prefer the file the app saved (reliable across quits), then localStorage (browser/dev).
    const injected = (window as unknown as { __FOCAL_TIMER__?: Timer | null }).__FOCAL_TIMER__;
    const raw = injected ? null : localStorage.getItem(TIMER_KEY);
    const t = injected ?? (raw ? (JSON.parse(raw) as Timer) : null);
    if (!t) return fresh;
    if (!["focus", "short", "long"].includes(t.phase)) return fresh;
    const round = Math.min(Math.max(1, t.round), cfg.rounds);
    if (t.endAt === null) return { ...t, round }; // paused: exactly as left
    if (t.endAt > Date.now()) return { ...t, round }; // still counting: the clock kept going
    // Finished while closed: move to the next phase, paused, so the user decides when to continue.
    const { next, nextRound } = nextPhase(t.phase, round, cfg.rounds);
    return { phase: next, round: nextRound, remaining: durationMs(cfg, next), endAt: null, pristine: true };
  } catch {
    return fresh;
  }
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [view, setView] = useState<"timer" | "settings">("timer");
  const [timer, setTimer] = useState<Timer>(() => loadTimer(settings));
  // Save on every change (start, pause, phase switch). Cheap: a few dozen bytes, not per tick.
  useEffect(() => {
    const json = JSON.stringify(timer);
    try { localStorage.setItem(TIMER_KEY, json); } catch {}
    native.saveTimerFile(json);
  }, [timer]);
  const [now, setNow] = useState(Date.now());
  const [overlay, setOverlay] = useState<false | "break" | "preview">(false);
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

  // Redraw once per displayed second, aligned to the second boundary (not on a fast interval).
  useEffect(() => {
    if (timer.endAt === null) return;
    const endAt = timer.endAt;
    let id: number;
    const loop = () => {
      const t = Date.now();
      setNow(t);
      const left = endAt - t;
      if (left <= 0) return;
      id = window.setTimeout(loop, (left % 1000 || 1000) + 5);
    };
    loop();
    return () => clearTimeout(id);
  }, [timer.endAt]);

  const advance = (completed: boolean) => {
    const cfg = s.current;
    const { phase, round } = timer;
    const { next, nextRound } = nextPhase(phase, round, cfg.rounds);
    const dur = durationMs(cfg, next);
    const autoStart = completed ? cfg.autoContinue : running;
    const t = Date.now();
    setTimer({ phase: next, round: nextRound, remaining: dur, endAt: autoStart ? t + dur : null, pristine: !autoStart });
    setNow(t);
    setOverlay(completed && next !== "focus" && cfg.breakScreen ? "break" : false);
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

  // ---- full-screen break window ----
  const canReopen = timer.phase !== "focus" && !overlay;
  const reopenBreak = () => { if (timer.phase !== "focus" && !overlayRef.current) setOverlay("break"); };
  const overlayState = (): OverlayState => {
    const cfg = s.current;
    const preview = overlay === "preview";
    const ph: Phase = preview ? "short" : timer.phase;
    return {
      phase: ph,
      label: cfg.labels[ph],
      nextLabel: cfg.labels.focus,
      endAt: preview ? null : timer.endAt,
      remaining: preview ? durationMs(cfg, "short") : timer.remaining,
      total: durationMs(cfg, ph),
      allowSkip: cfg.allowSkipBreak,
      preview,
      theme: cfg.theme,
      ringColor: cfg.ringColor,
      ringWidth: cfg.ringWidth,
      background: cfg.breakBg,
      dim: cfg.breakDim,
      blur: cfg.breakBlur,
    };
  };
  const sendOverlay = useRef(overlayState);
  sendOverlay.current = overlayState;

  // Open / close: hide the small window while the break screen is up, bring it back after.
  const mainWasVisible = useRef(true);
  const prevOverlay = useRef(overlay);
  useEffect(() => {
    const was = prevOverlay.current;
    prevOverlay.current = overlay;
    if (!!was === !!overlay) return;
    if (overlay) {
      (async () => {
        mainWasVisible.current = await native.isMainVisible();
        native.sendOverlayState(sendOverlay.current());
        await native.showOverlay();
        native.hideWindow();
      })();
    } else {
      native.hideOverlay();
      if (mainWasVisible.current) native.showWindow();
    }
  }, [overlay]);

  // Keep the break screen in sync (it ticks on its own from endAt, so only on real changes).
  useEffect(() => {
    if (overlay) native.sendOverlayState(sendOverlay.current());
  }, [overlay, timer, settings]);

  // Tray label.
  const label = settings.labels[timer.phase];
  // Tray text changes once a minute (each change is a native call + panel redraw).
  const trayMin = Math.ceil(Math.max(0, remaining) / 60_000);
  const trayText = settings.trayTimer && !timer.pristine ? `${trayMin}m ${running ? label : "(paused)"}` : "";
  useEffect(() => { native.setTrayLabel(trayText); }, [trayText]);

  // Tray menu + keyboard shortcuts (refs so listeners always call the latest closures).
  const overlayRef = useRef(overlay);
  overlayRef.current = overlay;
  const actions = useRef({ toggle, skip: () => advance(false), reset, reopenBreak });
  actions.current = { toggle, skip: () => advance(false), reset, reopenBreak };
  useEffect(() => {
    const offs = [
      native.onTrayEvent("tray-toggle", () => actions.current.toggle()),
      native.onTrayEvent("tray-skip", () => actions.current.skip()),
      native.onTrayEvent("tray-break", () => actions.current.reopenBreak()),
      native.onOverlayAction((a) => {
        const preview = overlayRef.current === "preview";
        if (a === "ready") { if (overlayRef.current) native.sendOverlayState(sendOverlay.current()); }
        else if (a === "dismiss" || preview) setOverlay(false);
        else if (a === "toggle") actions.current.toggle();
        else if (a === "skip") actions.current.skip();
      }),
    ];
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest("input, textarea, select")) return;
      if (e.code === "Space") { e.preventDefault(); actions.current.toggle(); }
      else if (e.key === "r") actions.current.reset();
      else if (e.key === "s") actions.current.skip();
      else if (e.key === "b") actions.current.reopenBreak();
      else if (e.key === "Escape") setView("timer");
      else if (e.key === ",") setView("settings");
    };
    window.addEventListener("keydown", onKey);
    return () => { offs.forEach((f) => f()); window.removeEventListener("keydown", onKey); };
  }, []);


  // Pointer presence. CSS :hover gets stuck in WebKitGTK when the cursor leaves the window,
  // so track it ourselves: show on movement, hide on leave/blur, and after 2s idle as a fallback.
  const [hovering, setHovering] = useState(false);
  useEffect(() => {
    let idle: number | undefined;
    const hide = () => { clearTimeout(idle); setHovering(false); };
    const show = () => {
      setHovering(true);
      clearTimeout(idle);
      idle = window.setTimeout(hide, 2000);
    };
    const onOut = (e: PointerEvent) => { if (!e.relatedTarget) hide(); };
    window.addEventListener("pointermove", show);
    window.addEventListener("pointerdown", show);
    window.addEventListener("pointerout", onOut);
    document.documentElement.addEventListener("mouseleave", hide);
    window.addEventListener("blur", hide);
    return () => {
      clearTimeout(idle);
      window.removeEventListener("pointermove", show);
      window.removeEventListener("pointerdown", show);
      window.removeEventListener("pointerout", onOut);
      document.documentElement.removeEventListener("mouseleave", hide);
      window.removeEventListener("blur", hide);
    };
  }, []);

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
    hovering && "hovering",
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
              <div className={`time ${remaining > 3_600_000 - 1000 ? "long" : ""}`}>{fmt(remaining)}</div>
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
            {canReopen && (
              <button className="icon-btn" onClick={reopenBreak} title="Show break screen (B)"><Icon name="screen" /></button>
            )}
          </div>

          <div className="rounds" onDoubleClick={resetAll} title="Round progress (double-click to reset)">
            {Array.from({ length: settings.rounds }, (_, i) => (
              <span key={i} className={`dot ${i + 1 < timer.round || (i + 1 === timer.round && timer.phase !== "focus") ? "done" : ""} ${i + 1 === timer.round ? "current" : ""}`} />
            ))}
          </div>
        </main>
      ) : (
        <SettingsView settings={settings} update={update} onPreviewBreak={() => setOverlay("preview")} />
      )}
    </div>
  );
}
