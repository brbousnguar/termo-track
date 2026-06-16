import { useEffect, useState } from "react";
import type { LiveReading } from "../hooks/useWebSocket";
import { useCountUp } from "../hooks/useCountUp";
import { comfortLabel } from "../theme";

interface Props {
  reading: LiveReading | null;
  connected: boolean;
  accent: string;
}

// A reading older than this is considered stale: the scanner has likely stopped
// and the values no longer reflect what the physical device is showing.
const STALE_AFTER_MS = 2 * 60 * 1000;

function formatAge(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export function LiveReadingCard({ reading, connected, accent }: Props) {
  // Re-render periodically so the reading's age (and staleness) stays current
  // even when no new readings are arriving.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  const animTemp = useCountUp(reading ? reading.temperature : null);

  const ageMs = reading?.timestamp ? now - new Date(reading.timestamp).getTime() : null;
  const isStale = ageMs !== null && ageMs > STALE_AFTER_MS;
  const isLive = connected && reading !== null && !isStale;

  const status = isLive
    ? { cls: "live", text: "Live" }
    : isStale
      ? { cls: "stale", text: "Stale" }
      : { cls: "offline", text: connected ? "No data" : "Offline" };

  if (!reading) {
    return (
      <section className="hero">
        <span className="status">
          <span className={`dot ${status.cls}`} />
          {status.text}
        </span>
        <div className="hero-waiting">
          {connected ? "Waiting for first reading…" : "Connecting to backend…"}
        </div>
      </section>
    );
  }

  const label = comfortLabel(reading.temperature, reading.humidity);

  return (
    <section className="hero" style={isStale ? { opacity: 0.6 } : undefined}>
      <span className="status">
        <span className={`dot ${status.cls}`} />
        {status.text}
        {!isStale && ageMs !== null && <span style={{ color: "var(--faint)" }}>· {formatAge(ageMs)}</span>}
      </span>

      <div className="hero-temp">
        {(animTemp ?? reading.temperature).toFixed(1)}
        <span className="hero-deg" style={{ color: accent }}>°C</span>
      </div>

      <div className="hero-sub">
        <span className="hero-comfort" style={{ color: accent }}>{label}</span>
        <span className="sep">·</span>
        {reading.humidity.toFixed(0)}% humidity
      </div>

      <div className="hero-meta">
        {reading.battery !== undefined && <span>🔋 {reading.battery}%</span>}
        {reading.device && <span>{reading.device}</span>}
      </div>

      {isStale && (
        <div className="stale-banner">
          ⚠ Data may be stale — last reading {ageMs !== null ? formatAge(ageMs) : ""}. Check that the
          scanner (<code>scanner_daemon.py</code>) is running.
        </div>
      )}
    </section>
  );
}
