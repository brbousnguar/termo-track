import type { LiveReading } from "../hooks/useWebSocket";

interface Props {
  reading: LiveReading | null;
  connected: boolean;
}

function comfortInfo(temp: number, hum: number): { label: string; color: string } {
  if (hum < 30) return { label: "Dry", color: "var(--orange)" };
  if (hum > 70) return { label: "Humid", color: "var(--blue)" };
  if (temp < 18) return { label: "Cold", color: "var(--blue)" };
  if (temp > 28) return { label: "Warm", color: "var(--orange)" };
  return { label: "Comfortable", color: "var(--green)" };
}

export function LiveReadingCard({ reading, connected }: Props) {
  const comfort = reading ? comfortInfo(reading.temperature, reading.humidity) : null;

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <span style={styles.title}>Live Reading</span>
        <span style={{ ...styles.dot, background: connected ? "var(--green)" : "var(--red)" }} />
      </div>

      {reading ? (
        <>
          <div style={styles.row}>
            <Metric label="Temperature" value={reading.temperature.toFixed(1)} unit="°C" color="var(--orange)" />
            <Metric label="Humidity" value={reading.humidity.toFixed(0)} unit="%" color="var(--teal)" />
          </div>
          <div style={styles.footer}>
            <span style={{ color: comfort!.color, fontWeight: 600 }}>{comfort!.label}</span>
            {reading.battery !== undefined && (
              <span style={styles.muted}>🔋 {reading.battery}%</span>
            )}
            {reading.device && <span style={styles.muted}>{reading.device}</span>}
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
  footer: { display: "flex", gap: 16, marginTop: 16, alignItems: "center" },
  muted: { fontSize: 13, color: "var(--muted)" },
  waiting: { color: "var(--muted)", textAlign: "center", padding: "32px 0" },
};
