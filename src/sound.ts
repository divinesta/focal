import type { Phase } from "./settings";

let ctx: AudioContext | null = null;
let idleTimer: number | undefined;
/** Get a running AudioContext, and suspend it again shortly after the last sound. */
const ac = () => {
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") ctx.resume();
  clearTimeout(idleTimer);
  idleTimer = window.setTimeout(() => ctx?.suspend(), 3000);
  return ctx;
};

/** Soft mechanical click, played once per second when ticking is on. */
export function tick(volume: number) {
  try {
    const c = ac();
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = "triangle";
    o.frequency.value = 1400;
    g.gain.setValueAtTime(0.05 * volume, c.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + 0.035);
    o.connect(g).connect(c.destination);
    o.start();
    o.stop(c.currentTime + 0.05);
  } catch {}
}

const MELODIES: Record<Phase, number[]> = {
  focus: [523.25, 659.25, 783.99], // rising C-E-G: back to work
  short: [783.99, 659.25], // falling: relax
  long: [783.99, 659.25, 523.25, 392.0],
};

/** Plays the sound for the phase that is starting. */
export function chime(phase: Phase, custom: string | null, volume: number) {
  if (custom) {
    const a = new Audio(custom);
    a.volume = volume;
    a.play().catch(() => {});
    return;
  }
  try {
    const c = ac();
    MELODIES[phase].forEach((freq, i) => {
      const t = c.currentTime + i * 0.22;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = "sine";
      o.frequency.value = freq;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.35 * volume, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      o.connect(g).connect(c.destination);
      o.start(t);
      o.stop(t + 1);
    });
  } catch {}
}
