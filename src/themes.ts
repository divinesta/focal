export type Theme = {
  id: string;
  name: string;
  bg: string;
  surface: string;
  fg: string;
  muted: string;
  focus: string;
  short: string;
  long: string;
};

export const THEMES: Theme[] = [
  { id: "tokyo-night-storm", name: "Tokyo Night Storm", bg: "#24283b", surface: "#1f2335", fg: "#c0caf5", muted: "#565f89", focus: "#9ece6a", short: "#7aa2f7", long: "#bb9af7" },
  { id: "catppuccin-mocha", name: "Catppuccin Mocha", bg: "#1e1e2e", surface: "#181825", fg: "#cdd6f4", muted: "#6c7086", focus: "#a6e3a1", short: "#89b4fa", long: "#cba6f7" },
  { id: "catppuccin-macchiato", name: "Catppuccin Macchiato", bg: "#24273a", surface: "#1e2030", fg: "#cad3f5", muted: "#6e738d", focus: "#a6da95", short: "#8aadf4", long: "#c6a0f6" },
  { id: "catppuccin-latte", name: "Catppuccin Latte", bg: "#eff1f5", surface: "#e6e9ef", fg: "#4c4f69", muted: "#9ca0b0", focus: "#40a02b", short: "#1e66f5", long: "#8839ef" },
  { id: "dracula", name: "Dracula", bg: "#282a36", surface: "#21222c", fg: "#f8f8f2", muted: "#6272a4", focus: "#50fa7b", short: "#8be9fd", long: "#ff79c6" },
  { id: "nord", name: "Nord", bg: "#2e3440", surface: "#272c36", fg: "#eceff4", muted: "#616e88", focus: "#a3be8c", short: "#88c0d0", long: "#b48ead" },
  { id: "one-dark", name: "One Dark", bg: "#282c34", surface: "#21252b", fg: "#abb2bf", muted: "#5c6370", focus: "#98c379", short: "#61afef", long: "#c678dd" },
  { id: "gruvbox", name: "Gruvbox", bg: "#282828", surface: "#1d2021", fg: "#ebdbb2", muted: "#7c6f64", focus: "#b8bb26", short: "#83a598", long: "#d3869b" },
  { id: "rose-pine", name: "Rosé Pine", bg: "#191724", surface: "#1f1d2e", fg: "#e0def4", muted: "#6e6a86", focus: "#9ccfd8", short: "#f6c177", long: "#c4a7e7" },
  { id: "everforest", name: "Everforest", bg: "#2d353b", surface: "#272e33", fg: "#d3c6aa", muted: "#7a8478", focus: "#a7c080", short: "#7fbbb3", long: "#d699b6" },
  { id: "solarized-dark", name: "Solarized Dark", bg: "#002b36", surface: "#073642", fg: "#93a1a1", muted: "#586e75", focus: "#859900", short: "#268bd2", long: "#d33682" },
  { id: "solarized-light", name: "Solarized Light", bg: "#fdf6e3", surface: "#eee8d5", fg: "#586e75", muted: "#93a1a1", focus: "#859900", short: "#268bd2", long: "#d33682" },
  { id: "synthwave", name: "Synthwave", bg: "#262335", surface: "#1e1a2b", fg: "#f4eee4", muted: "#6d5f86", focus: "#72f1b8", short: "#36f9f6", long: "#ff7edb" },
  { id: "monokai", name: "Monokai", bg: "#272822", surface: "#1e1f1c", fg: "#f8f8f2", muted: "#75715e", focus: "#a6e22e", short: "#66d9ef", long: "#ae81ff" },
];

export function applyTheme(id: string) {
  const t = THEMES.find((x) => x.id === id) ?? THEMES[0];
  const root = document.documentElement.style;
  for (const k of ["bg", "surface", "fg", "muted", "focus", "short", "long"] as const) {
    root.setProperty(`--${k}`, t[k]);
  }
}
