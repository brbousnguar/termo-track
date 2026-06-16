// Comfort-reactive theming.
//
// The whole UI mood is derived from the live temperature: a dark, tinted
// gradient background that slides from cold indigo → cool teal → comfortable
// green → warm amber → hot red, plus an accent colour used for the hero number,
// live dot and "inside" chart line. Colours are interpolated continuously so the
// background drifts smoothly as the reading changes (CSS @property animates the
// transition — see index.css).

export interface Theme {
  gradTop: string;
  gradMid: string;
  gradBot: string;
  glow: string; // rgba — radial accent glow behind the hero
  accent: string; // vivid colour for the active reading
  label: string; // comfort label, e.g. "Comfortable"
}

interface Anchor {
  t: number;
  top: string;
  mid: string;
  bot: string;
  accent: string;
}

// Dark, saturated base tints keep frosted glass + white text legible while still
// reading clearly as "cold" vs "hot".
const ANCHORS: Anchor[] = [
  { t: 2, top: "#0a1230", mid: "#0e1d44", bot: "#0a1020", accent: "#6aa3ff" }, // frigid indigo
  { t: 12, top: "#08202f", mid: "#0c3146", bot: "#081820", accent: "#34c6d8" }, // cool teal-blue
  { t: 20, top: "#0a2524", mid: "#0e3a30", bot: "#081a18", accent: "#34d39e" }, // comfortable green
  { t: 26, top: "#2a1d12", mid: "#3e2a14", bot: "#170f08", accent: "#f7b733" }, // warm amber
  { t: 32, top: "#2e1410", mid: "#4a1c16", bot: "#190b08", accent: "#fb6f6f" }, // hot red
];

// Neutral fallback before the first reading arrives.
const NEUTRAL: Theme = {
  gradTop: "#10131c",
  gradMid: "#141826",
  gradBot: "#0a0c13",
  glow: "rgba(91, 157, 247, 0.10)",
  accent: "#5b9dff",
  label: "—",
};

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function rgbToHex(r: number, g: number, b: number): string {
  const h = (v: number) => Math.round(v).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}`;
}

function lerpHex(a: string, b: string, f: number): string {
  const [r1, g1, b1] = hexToRgb(a);
  const [r2, g2, b2] = hexToRgb(b);
  return rgbToHex(r1 + (r2 - r1) * f, g1 + (g2 - g1) * f, b1 + (b2 - b1) * f);
}

export function comfortLabel(temp: number, hum: number): string {
  if (hum < 30) return "Dry";
  if (hum > 70) return "Humid";
  if (temp < 18) return "Cold";
  if (temp > 28) return "Warm";
  return "Comfortable";
}

export function themeForReading(reading: { temperature: number; humidity: number } | null): Theme {
  if (!reading) return NEUTRAL;
  const t = reading.temperature;

  // Find the bracketing anchors and interpolate.
  let lo = ANCHORS[0];
  let hi = ANCHORS[ANCHORS.length - 1];
  for (let i = 0; i < ANCHORS.length - 1; i++) {
    if (t >= ANCHORS[i].t && t <= ANCHORS[i + 1].t) {
      lo = ANCHORS[i];
      hi = ANCHORS[i + 1];
      break;
    }
  }
  const f = hi.t === lo.t ? 0 : Math.min(1, Math.max(0, (t - lo.t) / (hi.t - lo.t)));

  const accent = lerpHex(lo.accent, hi.accent, f);
  const [ar, ag, ab] = hexToRgb(accent);

  return {
    gradTop: lerpHex(lo.top, hi.top, f),
    gradMid: lerpHex(lo.mid, hi.mid, f),
    gradBot: lerpHex(lo.bot, hi.bot, f),
    glow: `rgba(${ar}, ${ag}, ${ab}, 0.20)`,
    accent,
    label: comfortLabel(t, reading.humidity),
  };
}

// CSS custom properties consumed by index.css. Spread onto the root element's
// style so the registered @property colours animate on change.
export function themeVars(theme: Theme): React.CSSProperties {
  return {
    ["--grad-top" as any]: theme.gradTop,
    ["--grad-mid" as any]: theme.gradMid,
    ["--grad-bot" as any]: theme.gradBot,
    ["--glow" as any]: theme.glow,
    ["--accent" as any]: theme.accent,
  };
}
