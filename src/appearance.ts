// Ring colour presets. A ring value is "phase" (theme colours per phase), "#rrggbb", or "grad:<id>".

export const SOLIDS: { name: string; color: string }[] = [
  { name: "Green", color: "#4ade80" },
  { name: "Lime", color: "#a3e635" },
  { name: "Teal", color: "#2dd4bf" },
  { name: "Sky", color: "#38bdf8" },
  { name: "Blue", color: "#60a5fa" },
  { name: "Indigo", color: "#818cf8" },
  { name: "Violet", color: "#a78bfa" },
  { name: "Pink", color: "#f472b6" },
  { name: "Rose", color: "#fb7185" },
  { name: "Orange", color: "#fb923c" },
  { name: "Amber", color: "#fbbf24" },
  { name: "White", color: "#e5e7eb" },
];

export const GRADIENTS: { id: string; name: string; stops: string[] }[] = [
  { id: "sunset", name: "Sunset", stops: ["#f97316", "#ec4899"] },
  { id: "ocean", name: "Ocean", stops: ["#06b6d4", "#3b82f6"] },
  { id: "aurora", name: "Aurora", stops: ["#22c55e", "#06b6d4", "#8b5cf6"] },
  { id: "candy", name: "Candy", stops: ["#f472b6", "#a78bfa"] },
  { id: "fire", name: "Fire", stops: ["#facc15", "#ef4444"] },
  { id: "mint", name: "Mint", stops: ["#a7f3d0", "#10b981"] },
  { id: "neon", name: "Neon", stops: ["#22d3ee", "#e879f9"] },
  { id: "gold", name: "Gold", stops: ["#fde68a", "#d97706"] },
];

export const BG_PRESETS: { name: string; value: number }[] = [
  { name: "Solid", value: 100 },
  { name: "Soft", value: 85 },
  { name: "Translucent", value: 65 },
  { name: "Sheer", value: 40 },
  { name: "Clear", value: 0 },
];

/** Colour stops for the ring, or null to use the theme's per-phase colour. */
export function resolveRing(value: string): string[] | null {
  if (value.startsWith("#")) return [value];
  if (value.startsWith("grad:")) return GRADIENTS.find((g) => `grad:${g.id}` === value)?.stops ?? null;
  return null;
}

export const gradientCss = (stops: string[]) => `linear-gradient(135deg, ${stops.join(", ")})`;
