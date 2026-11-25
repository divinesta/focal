const P: Record<string, string> = {
  menu: "M4 7h16M4 12h10M4 17h16",
  back: "M15 5l-7 7 7 7",
  min: "M5 12h14",
  close: "M6 6l12 12M18 6L6 18",
  pin: "M9 4h6l-1 6 4 3H6l4-3-1-6zM12 13v7",
  play: "M8 5v14l11-7z",
  pause: "M8 5h3v14H8zM13 5h3v14h-3z",
  skip: "M6 5l9 7-9 7zM17 5h2v14h-2z",
  reset: "M4 12a8 8 0 1 0 2.4-5.7M4 4v5h5",
  clock: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2",
  gear: "M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6zM19.4 13a7.5 7.5 0 0 0 0-2l2-1.6-2-3.4-2.4 1a7.4 7.4 0 0 0-1.7-1L15 3.5h-4l-.4 2.5a7.4 7.4 0 0 0-1.7 1l-2.4-1-2 3.4L6.6 11a7.5 7.5 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7.4 7.4 0 0 0 1.7 1l.4 2.5h4l.4-2.5a7.4 7.4 0 0 0 1.7-1l2.4 1 2-3.4z",
  palette: "M12 3a9 9 0 0 0 0 18c1.1 0 1.6-.8 1.6-1.6 0-1-.8-1.4-.8-2.4 0-.9.7-1.6 1.6-1.6H16a5 5 0 0 0 5-5c0-4.1-4-7.4-9-7.4zM7.5 12.5h0M9 8h0M14 7.5h0M17 11h0",
  sound: "M4 9v6h4l5 4V5L8 9zM16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11",
  text: "M5 6V4h14v2M12 4v16M9 20h6",
  info: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 11v6M12 7.5h0",
  check: "M5 12l5 5 9-10",
  screen: "M3 5h18v11H3zM8 20h8M12 16v4",
  plus: "M12 5v14M5 12h14",
};

export function Icon({ name, size = 20, fill = false }: { name: keyof typeof P | string; size?: number; fill?: boolean }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill ? "currentColor" : "none"}
      stroke="currentColor" strokeWidth={fill ? 0 : 2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={P[name]} />
    </svg>
  );
}
