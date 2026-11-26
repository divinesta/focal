import { useEffect, useMemo, useRef, useState } from "react";
import { emit, listen } from "@tauri-apps/api/event";
import { applyTheme } from "./themes";
import { resolveRing } from "./appearance";
import { backgroundUrl } from "./backgrounds";
import { fmt } from "./format";
import { Icon } from "./icons";
import type { OverlayAction, OverlayState } from "./overlayState";

const TIPS = [
  "Stand up and stretch.",
  "Look at something far away for 20 seconds.",
  "Drink some water.",
  "Roll your shoulders and unclench your jaw.",
  "Take five slow, deep breaths.",
  "Walk around for a minute.",
  "Rest your eyes. Close them for a bit.",
];

const act = (a: OverlayAction) => emit("overlay-action", a);

export default function Overlay() {
  const [st, setSt] = useState<OverlayState | null>(null);
  const [now, setNow] = useState(Date.now());
  const [bgUrl, setBgUrl] = useState<string | null>(null);
  const lastBg = useRef("");

  useEffect(() => {
    if (!("__TAURI_INTERNALS__" in window)) {
      // Plain browser (dev): show a demo state so the screen can be designed without the app.
      const q = new URLSearchParams(location.search);
      setSt({ phase: "short", label: "Short break", nextLabel: "Focus", endAt: Date.now() + 4 * 60_000 + 37_000,
        remaining: 0, total: 5 * 60_000, allowSkip: true, preview: false, theme: q.get("theme") ?? "tokyo-night-storm",
        ringColor: "phase", ringWidth: 9, background: q.get("bg") ?? "builtin:misty-river", dim: 40, blur: 0 });
      applyTheme(q.get("theme") ?? "tokyo-night-storm");
      return;
    }
    const un = listen<OverlayState>("overlay-state", (e) => {
      setSt(e.payload);
      setNow(Date.now());
      applyTheme(e.payload.theme);
    });
    act("ready"); // ask the main window for the current state
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") act("dismiss");
      else if (e.code === "Space") { e.preventDefault(); act("toggle"); }
    };
    window.addEventListener("keydown", onKey);
    return () => { un.then((f) => f()); window.removeEventListener("keydown", onKey); };
  }, []);

  // Redraw once per displayed second while the break runs.
  useEffect(() => {
    const endAt = st?.endAt;
    if (endAt == null) return;
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
  }, [st?.endAt]);

  // Load the background image when the choice changes.
  useEffect(() => {
    if (!st || st.background === lastBg.current) return;
    lastBg.current = st.background;
    let url: string | null = null;
    backgroundUrl(st.background).then((u) => { url = u; setBgUrl(u); });
    return () => { if (url?.startsWith("blob:")) URL.revokeObjectURL(url); };
  }, [st?.background]); // eslint-disable-line react-hooks/exhaustive-deps

  const tip = useMemo(() => TIPS[Math.floor(Math.random() * TIPS.length)], [st?.phase, st?.preview]);

  if (!st) return <div className="overlay" />;

  const running = st.endAt !== null;
  const remaining = running ? st.endAt! - now : st.remaining;
  const progress = Math.min(1, Math.max(0, remaining / st.total));
  const ring = resolveRing(st.ringColor);
  const R = 100, C = 2 * Math.PI * R;

  return (
    <div className="overlay" data-phase={st.phase}
      style={{ "--ring-w": st.ringWidth, ...(ring ? { "--accent": ring[0] } : {}) } as React.CSSProperties}>
      {bgUrl && <div className="overlay-bg" style={{ backgroundImage: `url("${bgUrl}")`, filter: st.blur ? `blur(${st.blur}px)` : undefined }} />}
      <div className="overlay-dim" style={{ opacity: bgUrl ? st.dim / 100 : 0 }} />

      <div className="overlay-content">
        <div className="overlay-label">{st.label}</div>
        <div className="ring overlay-ring">
          <svg viewBox="0 0 240 240">
            {ring && ring.length > 1 && (
              <defs>
                <linearGradient id="ovGrad" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="240" y2="240">
                  {ring.map((c, i) => <stop key={i} offset={i / (ring.length - 1)} stopColor={c} />)}
                </linearGradient>
              </defs>
            )}
            <circle className="track" cx="120" cy="120" r={R} />
            <circle className="bar" cx="120" cy="120" r={R} strokeDasharray={C} strokeDashoffset={C * (1 - progress)}
              transform="rotate(-90 120 120)"
              style={ring ? { stroke: ring.length > 1 ? "url(#ovGrad)" : ring[0] } : undefined} />
          </svg>
          <div className="readout">
            <div className={`time ${remaining > 3_599_000 ? "long" : ""}`}>{fmt(remaining)}</div>
            <div className="phase">{running ? "until " + st.nextLabel.toLowerCase() : "paused"}</div>
          </div>
        </div>
        <p className="overlay-tip">{st.preview ? "Preview: press Esc to close" : tip}</p>

        <div className="overlay-actions">
          <button className="ov-btn" onClick={() => act("toggle")}>
            <Icon name={running ? "pause" : "play"} size={18} fill /> {running ? "Pause" : "Start break"}
          </button>
          {st.allowSkip && (
            <button className="ov-btn" onClick={() => act("skip")}>
              <Icon name="skip" size={18} fill /> Skip break
            </button>
          )}
          <button className="ov-btn ghost" onClick={() => act("dismiss")} title="Hide this screen, the break keeps running (Esc)">
            Hide
          </button>
        </div>
      </div>
    </div>
  );
}
