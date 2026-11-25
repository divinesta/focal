import type { Phase } from "./settings";

/** Everything the full-screen break window needs; sent from the main window. */
export type OverlayState = {
  phase: Phase;
  label: string;
  nextLabel: string;
  endAt: number | null;
  remaining: number;
  total: number;
  allowSkip: boolean;
  preview: boolean;
  theme: string;
  ringColor: string;
  ringWidth: number;
  background: string;
  dim: number; // 0..90 %
  blur: number; // px
};

export type OverlayAction = "ready" | "toggle" | "skip" | "dismiss";
