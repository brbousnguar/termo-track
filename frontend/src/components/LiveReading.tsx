import { useEffect, useState } from "react";
import type { LiveReading } from "../hooks/useWebSocket";

interface Props {
  reading: LiveReading | null;
  connected: boolean;
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

function comfortInfo(temp: number, hum: number): { label: string; color: string } {
  if (hum < 30) return { label: "Dry", color: "var(--orange)" };
  if (hum > 70) return { label: "Humid", color: "var(--blue)" };
  if (temp < 18) return { label: "Cold", color: "var(--blue)" };
  if (temp > 28) return { label: "Warm", color: "var(--orange)" };
  return { label: "Comfortable", color: "var(--green)" };
}

export function LiveReadingCard({ reading, connected }: Props) {
  // Re-render periodically so the reading's age (and staleness) stays current
  // even when no new readings are arriving.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  const comfort = reading ? comfortInfo(reading.temperature, reading.humidity) : null;

  const ageMs = reading?.timestamp ? now - new Date(reading.timestamp).getTime() : null;
  const isStale = ageMs !== null && ageMs > STALE_AFTER_MS;
  const isLive = connected && reading !== null && !isStale;
  const dotColor = isLive ? "var(--green)" : isStale ? "var(--orange)" : "var(--red)";

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <span style={styles.title}>Live Reading</span>
        <span style={{ ...styles.dot, background: dotColor }} />
      </div>

      {reading ? (
        <>
          {isStale && (
            <div style={styles.staleBanner}>
              ⚠ Data may be stale — last reading {ageMs !== null ? formatAge(ageMs) : ""}. Check that the
              scanner (<code>scanner_daemon.py</code>) is running.
            </div>
          )}
          <div style={{ ...styles.row, ...(isStale ? styles.dimmed : {}) }}>
            <Metric label="Temperature" value={reading.temperature.toFixed(1)} unit="°C" color="var(--orange)" />
            <Metric label="Humidity" value={reading.humidity.toFixed(0)} unit="%" color="var(--teal)" />
          </div>
          <div style={styles.footer}>
            <span style={{ color: comfort!.color, fontWeight: 600 }}>{comfort!.label}</span>
            {reading.battery !== undefined && (
              <span style={styles.muted}>🔋 {reading.battery}%</span>
            )}
            {reading.device && <span style={styles.muted}>{reading.device}</span>}
            {!isStale && ageMs !== null && (
              <span style={styles.muted}>updated {formatAge(ageMs)}</span>
            )}
          </div>
        </>
      ) : (
        <div style={styles.waiting}>
          {connected ? "Waiting for first reading…" : "Connecting to backend…"}
        </div>
      )}
    </div>
  );
}

function Metric({ label, value, unit, color }: { label: string; value: string; unit: string; color: string }) {
  return (
    <div style={styles.metric}>
      <div style={styles.metricLabel}>{label}</div>
      <div style={styles.metricValue}>
        <span style={{ color }}>{value}</span>
        <span style={styles.unit}>{unit}</span>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: "24px",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  title: { fontWeight: 600, fontSize: 16 },
  dot: { width: 10, height: 10, borderRadius: "50%" },
  row: { display: "flex", gap: 16 },
  metric: { flex: 1, background: "var(--bg)", borderRadius: 10, padding: "16px 20px" },
  metricLabel: { fontSize: 12, color: "var(--muted)", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.05em" },
  metricValue: { fontSize: 48, fontWeight: 700, lineHeight: 1, display: "flex", alignItems: "baseline", gap: 4 },
  unit: { fontSize: 22, fontWeight: 400, color: "var(--muted)" },
  footer: { display: "flex", gap: 16, marginTop: 16, alignItems: "center", flexWrap: "wrap" },
  muted: { fontSize: 13, color: "var(--muted)" },
  staleBanner: {
    background: "rgba(245, 158, 11, 0.12)",
    border: "1px solid var(--orange)",
    borderRadius: 10,
    color: "var(--orange)",
    fontSize: 13,
    fontWeight: 500,
    padding: "10px 14px",
    marginBottom: 16,
    lineHeight: 1.4,
  },
  dimmed: { opacity: 0.45 },
};
