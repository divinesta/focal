import { useEffect, useState, type ReactNode } from "react";
import { DEFAULTS, type Phase, type Settings } from "./settings";
import { THEMES } from "./themes";
import { BG_PRESETS, GRADIENTS, SOLIDS, gradientCss } from "./appearance";
import { BUILTIN, addCustomBackground, builtinThumb, deleteCustomBackground, listCustomBackgrounds } from "./backgrounds";
import { chime } from "./sound";
import { Icon } from "./icons";

/** 45 -> "45 min", 90 -> "1 h 30 min", 240 -> "4 h" */
const fmtMinutes = (m: number) => {
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60), r = m % 60;
  return r ? `${h} h ${r} min` : `${h} h`;
};

type Props = { settings: Settings; update: (p: Partial<Settings>) => void; onPreviewBreak: () => void };
type Tab = "timer" | "behaviour" | "break" | "themes" | "sounds" | "text" | "about";

const TABS: { id: Tab; icon: string; title: string }[] = [
  { id: "timer", icon: "clock", title: "Timer" },
  { id: "behaviour", icon: "gear", title: "Behaviour" },
  { id: "break", icon: "screen", title: "Break screen" },
  { id: "themes", icon: "palette", title: "Appearance" },
  { id: "sounds", icon: "sound", title: "Sounds" },
  { id: "text", icon: "text", title: "Labels" },
  { id: "about", icon: "info", title: "About" },
];

const PHASES: { id: Phase; name: string }[] = [
  { id: "focus", name: "Focus" },
  { id: "short", name: "Short break" },
  { id: "long", name: "Long break" },
];

function Toggle({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="row toggle">
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
      <i />
    </label>
  );
}

function Slider({ label, value, min, max, unit, color, format, onChange }: {
  label: string; value: number; min: number; max: number; unit?: string; color: string;
  format?: (v: number) => string; onChange: (v: number) => void;
}) {
  return (
    <div className="slider" style={{ "--c": `var(--${color})`, "--p": `${((value - min) / (max - min)) * 100}%` } as React.CSSProperties}>
      <div className="slider-head">
        <span>{label}</span>
        <b>{format ? format(value) : `${value}${unit ?? ""}`}</b>
      </div>
      <input type="range" min={min} max={max} value={value} onChange={(e) => onChange(Number(e.target.value))} />
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section>
      <h2>{title}</h2>
      {children}
    </section>
  );
}

type Thumb = { id: string; name: string; url: string };

function useCustomBackgrounds() {
  const [items, setItems] = useState<Thumb[]>([]);
  const refresh = async () => {
    try {
      const list = await listCustomBackgrounds();
      setItems((old) => {
        old.forEach((o) => URL.revokeObjectURL(o.url));
        return list.map((b) => ({ id: b.id, name: b.name, url: URL.createObjectURL(b.thumb) }));
      });
    } catch (e) {
      console.error(e);
    }
  };
  useEffect(() => { refresh(); }, []);
  return { items, refresh };
}

export default function SettingsView({ settings: s, update, onPreviewBreak }: Props) {
  const custom = useCustomBackgrounds();
  const [busy, setBusy] = useState(false);
  const addImages = async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    let last = "";
    for (const f of Array.from(files)) {
      try { last = await addCustomBackground(f); } catch (e) { console.error(e); }
    }
    await custom.refresh();
    if (last) update({ breakBg: `custom:${last}` });
    setBusy(false);
  };
  const removeCustom = async (id: string) => {
    await deleteCustomBackground(id);
    if (s.breakBg === `custom:${id}`) update({ breakBg: "none" });
    custom.refresh();
  };
  const [tab, setTab] = useState<Tab>("timer");
  const [err, setErr] = useState("");
  const presetSolid = SOLIDS.find((c) => c.color === s.ringColor);
  const presetGrad = GRADIENTS.find((g) => `grad:${g.id}` === s.ringColor);
  const isCustom = s.ringColor.startsWith("#") && !presetSolid;
  const ringName = s.ringColor === "phase" ? "Phase colours — changes with focus / break"
    : presetSolid?.name ?? (presetGrad ? `${presetGrad.name} gradient` : `Custom ${s.ringColor}`);

  const pickSound = (p: Phase, file: File | undefined) => {
    if (!file) return;
    if (file.size > 3_000_000) return setErr("Keep custom sounds under 3 MB.");
    setErr("");
    const r = new FileReader();
    r.onload = () => update({
      sounds: { ...s.sounds, [p]: r.result as string },
      soundNames: { ...s.soundNames, [p]: file.name },
    });
    r.readAsDataURL(file);
  };

  return (
    <div className="settings">
      <div className="settings-body">
        {tab === "timer" && (
          <Section title="Timer">
            <Slider label="Focus" value={s.focusMin} min={1} max={240} format={fmtMinutes} color="focus" onChange={(v) => update({ focusMin: v })} />
            <Slider label="Short break" value={s.shortMin} min={1} max={30} unit=" min" color="short" onChange={(v) => update({ shortMin: v })} />
            <Slider label="Long break" value={s.longMin} min={1} max={60} unit=" min" color="long" onChange={(v) => update({ longMin: v })} />
            <Slider label="Rounds before long break" value={s.rounds} min={1} max={12} color="fg" onChange={(v) => update({ rounds: v })} />
            <button className="link" onClick={() => update({ focusMin: DEFAULTS.focusMin, shortMin: DEFAULTS.shortMin, longMin: DEFAULTS.longMin, rounds: DEFAULTS.rounds })}>
              Reset defaults
            </button>
          </Section>
        )}

        {tab === "behaviour" && (
          <Section title="Behaviour">
            <Toggle label="Always on top" value={s.alwaysOnTop} onChange={(v) => update({ alwaysOnTop: v })} />
            <Toggle label="Auto-start next phase" value={s.autoContinue} onChange={(v) => update({ autoContinue: v })} />
            <Toggle label="Auto-hide title bar" hint="Shows when the cursor is over the window"
              value={s.autoHideTitlebar} onChange={(v) => update({ autoHideTitlebar: v })} />
            <Toggle label="Desktop notifications" value={s.notifications} onChange={(v) => update({ notifications: v })} />
            <Toggle label="Show countdown in tray" value={s.trayTimer} onChange={(v) => update({ trayTimer: v })} />
            <Toggle label="Minimize to tray" value={s.minimizeToTray} onChange={(v) => update({ minimizeToTray: v })} />
            <Toggle label="Close to tray" hint="Quit from the tray menu" value={s.closeToTray} onChange={(v) => update({ closeToTray: v })} />
            <Toggle label="Launch on login" value={s.autostart} onChange={(v) => update({ autostart: v })} />
            <Toggle label="Start hidden in tray" value={s.startMinimized} onChange={(v) => update({ startMinimized: v })} />
          </Section>
        )}

        {tab === "break" && (
          <Section title="Break screen">
            <Toggle label="Full-screen break screen" hint="Covers the screen when a focus block ends"
              value={s.breakScreen} onChange={(v) => update({ breakScreen: v })} />
            <Toggle label="Allow skipping breaks" value={s.allowSkipBreak} onChange={(v) => update({ allowSkipBreak: v })} />

            <h3>Background</h3>
            <div className="bg-grid">
              <button className={`bg-tile plain ${s.breakBg === "none" ? "sel" : ""}`} onClick={() => update({ breakBg: "none" })}>
                Plain
              </button>
              {BUILTIN.map((b) => (
                <button key={b.id} className={`bg-tile ${s.breakBg === `builtin:${b.id}` ? "sel" : ""}`} title={b.name}
                  style={{ backgroundImage: `url(${builtinThumb(b.id)})` }} onClick={() => update({ breakBg: `builtin:${b.id}` })} />
              ))}
              {custom.items.map((b) => (
                <div key={b.id} className={`bg-tile ${s.breakBg === `custom:${b.id}` ? "sel" : ""}`} title={b.name}
                  style={{ backgroundImage: `url(${b.url})` }} onClick={() => update({ breakBg: `custom:${b.id}` })}>
                  <button className="bg-del" title="Remove" onClick={(e) => { e.stopPropagation(); removeCustom(b.id); }}>
                    <Icon name="close" size={12} />
                  </button>
                </div>
              ))}
              <label className="bg-tile add" title="Add your own pictures">
                {busy ? "…" : <Icon name="plus" size={20} />}
                <input type="file" accept="image/*" multiple hidden onChange={(e) => { addImages(e.target.files); e.target.value = ""; }} />
              </label>
            </div>

            {s.breakBg !== "none" && (
              <>
                <Slider label="Darken" value={s.breakDim} min={0} max={90} unit="%" color="accent" onChange={(v) => update({ breakDim: v })} />
                <Slider label="Blur" value={s.breakBlur} min={0} max={20} unit="px" color="accent" onChange={(v) => update({ breakBlur: v })} />
              </>
            )}
            <button className="link" onClick={onPreviewBreak}>Preview break screen</button>
          </Section>
        )}

        {tab === "themes" && (
          <Section title="Appearance">
            <h3>Ring colour</h3>
            <div className="swatches-grid">
              <button className={`swatch phase ${s.ringColor === "phase" ? "sel" : ""}`} title="Phase colours (from theme)"
                onClick={() => update({ ringColor: "phase" })} />
              {SOLIDS.map((c) => (
                <button key={c.color} className={`swatch ${s.ringColor === c.color ? "sel" : ""}`} title={c.name}
                  style={{ background: c.color }} onClick={() => update({ ringColor: c.color })} />
              ))}
              {GRADIENTS.map((g) => (
                <button key={g.id} className={`swatch ${s.ringColor === `grad:${g.id}` ? "sel" : ""}`} title={g.name}
                  style={{ background: gradientCss(g.stops) }} onClick={() => update({ ringColor: `grad:${g.id}` })} />
              ))}
              <label className={`swatch custom ${isCustom ? "sel" : ""}`} title="Custom colour"
                style={isCustom ? { background: s.ringColor } : undefined}>
                +
                <input type="color" value={isCustom ? s.ringColor : "#9ece6a"}
                  onChange={(e) => update({ ringColor: e.target.value })} />
              </label>
            </div>
            <p className="hint">{ringName}</p>
            <Slider label="Thickness" value={s.ringWidth} min={3} max={16} unit="px" color="accent"
              onChange={(v) => update({ ringWidth: v })} />

            <h3>Background</h3>
            <div className="chips">
              {BG_PRESETS.map((b) => (
                <button key={b.name} className={`chip ${s.bgOpacity === b.value ? "sel" : ""}`}
                  onClick={() => update({ bgOpacity: b.value })}>{b.name}</button>
              ))}
            </div>
            <Slider label="Opacity" value={s.bgOpacity} min={0} max={100} unit="%" color="accent"
              onChange={(v) => update({ bgOpacity: v })} />
            <Toggle label="Solid on hover" hint="Background fills in while the cursor is over it"
              value={s.solidOnHover} onChange={(v) => update({ solidOnHover: v })} />
            <Toggle label="Rounded corners" value={s.roundedCorners} onChange={(v) => update({ roundedCorners: v })} />

            <h3>Theme</h3>
            <div className="themes">
              {THEMES.map((t) => (
                <button key={t.id} className="theme" onClick={() => update({ theme: t.id })}
                  style={{ background: t.bg, color: t.fg, borderLeftColor: t.focus }}>
                  <span>{t.name}</span>
                  <span className="swatches">
                    {[t.focus, t.short, t.long].map((c) => <i key={c} style={{ background: c }} />)}
                  </span>
                  {s.theme === t.id && <Icon name="check" size={16} />}
                </button>
              ))}
            </div>
          </Section>
        )}

        {tab === "sounds" && (
          <Section title="Sounds">
            <Slider label="Volume" value={Math.round(s.volume * 100)} min={0} max={100} unit="%" color="fg"
              onChange={(v) => update({ volume: v / 100 })} />
            <Toggle label="Tick during focus" value={s.tickFocus} onChange={(v) => update({ tickFocus: v })} />
            <Toggle label="Tick during breaks" value={s.tickBreak} onChange={(v) => update({ tickBreak: v })} />
            {PHASES.map((p) => (
              <div key={p.id} className="row sound">
                <span>
                  <b>{p.name}</b> start sound
                  <small>{s.soundNames[p.id] ?? "Built-in chime"}</small>
                </span>
                <div className="sound-actions">
                  <button className="link" onClick={() => chime(p.id, s.sounds[p.id], s.volume)}>Test</button>
                  <label className="link">
                    Custom
                    <input type="file" accept="audio/*" hidden onChange={(e) => pickSound(p.id, e.target.files?.[0])} />
                  </label>
                  {s.sounds[p.id] && (
                    <button className="link" onClick={() => update({
                      sounds: { ...s.sounds, [p.id]: null }, soundNames: { ...s.soundNames, [p.id]: null },
                    })}>Default</button>
                  )}
                </div>
              </div>
            ))}
            {err && <p className="error">{err}</p>}
          </Section>
        )}

        {tab === "text" && (
          <Section title="Labels">
            {PHASES.map((p) => (
              <label key={p.id} className="field">
                <span>{p.name} label</span>
                <input value={s.labels[p.id]} maxLength={24}
                  onChange={(e) => update({ labels: { ...s.labels, [p.id]: e.target.value } })} />
              </label>
            ))}
          </Section>
        )}

        {tab === "about" && (
          <Section title="Focal 0.3.0">
            <p className="about">A small focus timer with an always-on-top window that works on GNOME Wayland (it runs through XWayland).</p>
            <dl className="keys">
              <dt>Space</dt><dd>Start / pause</dd>
              <dt>S</dt><dd>Skip phase</dd>
              <dt>R</dt><dd>Restart phase</dd>
              <dt>,</dt><dd>Settings</dd>
              <dt>Esc</dt><dd>Back to timer</dd>
            </dl>
            <p className="about">Double-click the round dots to reset to round 1.</p>
          </Section>
        )}
      </div>

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.id} className={tab === t.id ? "active" : ""} onClick={() => setTab(t.id)} title={t.title}>
            <Icon name={t.icon} />
          </button>
        ))}
      </nav>
    </div>
  );
}
