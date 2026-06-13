import type { LiveReading } from "../hooks/useWebSocket";
import { useWeather } from "../hooks/useWeather";

interface Props {
  reading: LiveReading | null;
}

function tempDeltaInfo(diff: number): { text: string; color: string; arrow: string } {
  if (Math.abs(diff) < 0.5) return { text: "about the same", color: "var(--muted)", arrow: "≈" };
  return diff > 0
    ? { text: "warmer inside", color: "var(--orange)", arrow: "▲" }
    : { text: "cooler inside", color: "var(--blue)", arrow: "▼" };
}

function humDeltaInfo(diff: number): { text: string; color: string; arrow: string } {
  if (Math.abs(diff) < 1) return { text: "about the same", color: "var(--muted)", arrow: "≈" };
  return diff > 0
    ? { text: "more humid inside", color: "var(--teal)", arrow: "▲" }
    : { text: "drier inside", color: "var(--orange)", arrow: "▼" };
}

export function ComparisonCard({ reading }: Props) {
  const { weather, status, error, retry } = useWeather();

  const locationChip =
    status === "ready" && weather?.locationName
      ? `📍 ${weather.locationName}`
      : status === "locating"
        ? "📍 Locating…"
        : status === "loading"
          ? "📍 Loading weather…"
          : "📍 Outside";

  const haveBoth = reading !== null && weather !== null;
  const tempDiff = haveBoth ? reading!.temperature - weather!.temperature : 0;
  const humDiff = haveBoth ? reading!.humidity - weather!.humidity : 0;
  const td = tempDeltaInfo(tempDiff);
  const hd = humDeltaInfo(humDiff);

  return (
    <div style={styles.card}>
      <div style={styles.header}>
        <span style={styles.title}>Indoor vs Outdoor</span>
        <span style={styles.locationChip}>{locationChip}</span>
      </div>

      <div style={styles.panels}>
        <Panel
          icon="🏠"
          label="Room"
          temp={reading ? reading.temperature : null}
          hum={reading ? reading.humidity : null}
          accent="var(--orange)"
          placeholder="Waiting for sensor…"
        />
        <div style={styles.divider} />
        <Panel
          icon="🌤"
          label="Outside"
          temp={status === "ready" && weather ? weather.temperature : null}
          hum={status === "ready" && weather ? weather.humidity : null}
          accent="var(--blue)"
          placeholder={
            status === "error" ? "Unavailable" : status === "locating" ? "Locating…" : "Loading…"
          }
        />
      </div>

      {haveBoth ? (
        <div style={styles.deltaStrip}>
          <DeltaRow
            label="Temperature"
            value={`${tempDiff > 0 ? "+" : ""}${tempDiff.toFixed(1)}°C`}
            arrow={td.arrow}
            text={td.text}
            color={td.color}
          />
          <DeltaRow
            label="Humidity"
            value={`${humDiff > 0 ? "+" : ""}${humDiff.toFixed(0)}%`}
            arrow={hd.arrow}
            text={hd.text}
            color={hd.color}
          />
        </div>
      ) : error ? (
        <div style={styles.errorRow}>
          <span style={styles.errorText}>{error}</span>
          <button style={styles.retryBtn} onClick={retry}>
            Retry
          </button>
        </div>
      ) : null}
    </div>
  );
}

function Panel({
  icon,
  label,
  temp,
  hum,
  accent,
  placeholder,
}: {
  icon: string;
  label: string;
  temp: number | null;
  hum: number | null;
  accent: string;
  placeholder: string;
}) {
  return (
    <div style={styles.panel}>
      <div style={styles.panelHead}>
        <span style={styles.panelIcon}>{icon}</span>
        <span style={styles.panelLabel}>{label}</span>
      </div>
      {temp !== null ? (
        <>
          <div style={styles.panelTemp}>
            <span style={{ color: accent }}>{temp.toFixed(1)}</span>
            <span style={styles.panelUnit}>°C</span>
          </div>
          <div style={styles.panelHum}>{hum !== null ? `${hum.toFixed(0)}% humidity` : ""}</div>
        </>
      ) : (
        <div style={styles.panelPlaceholder}>{placeholder}</div>
      )}
    </div>
  );
}

function DeltaRow({
  label,
  value,
  arrow,
  text,
  color,
}: {
  label: string;
  value: string;
  arrow: string;
  text: string;
  color: string;
}) {
  return (
    <div style={styles.deltaRow}>
      <span style={styles.deltaLabel}>{label}</span>
      <span style={styles.deltaRight}>
        <span style={{ ...styles.deltaValue, color }}>
          {arrow} {value}
        </span>
        <span style={styles.deltaText}>{text}</span>
      </span>
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
  locationChip: {
    fontSize: 13,
    color: "var(--muted)",
    background: "var(--bg)",
    border: "1px solid var(--border)",
    borderRadius: 999,
    padding: "4px 12px",
    maxWidth: "55%",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  panels: { display: "flex", alignItems: "stretch", gap: 0 },
  divider: { width: 1, background: "var(--border)", margin: "0 8px" },
  panel: { flex: 1, padding: "4px 12px" },
  panelHead: { display: "flex", alignItems: "center", gap: 8, marginBottom: 10 },
  panelIcon: { fontSize: 18 },
  panelLabel: {
    fontSize: 12,
    color: "var(--muted)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    fontWeight: 600,
  },
  panelTemp: { fontSize: 40, fontWeight: 700, lineHeight: 1, display: "flex", alignItems: "baseline", gap: 4 },
  panelUnit: { fontSize: 18, fontWeight: 400, color: "var(--muted)" },
  panelHum: { fontSize: 13, color: "var(--muted)", marginTop: 8 },
  panelPlaceholder: { fontSize: 14, color: "var(--muted)", padding: "16px 0" },
  deltaStrip: {
    marginTop: 20,
    paddingTop: 16,
    borderTop: "1px solid var(--border)",
    display: "flex",
    flexDirection: "column",
    gap: 10,
  },
  deltaRow: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  deltaLabel: { fontSize: 14, color: "var(--muted)" },
  deltaRight: { display: "flex", alignItems: "baseline", gap: 10 },
  deltaValue: { fontSize: 18, fontWeight: 700 },
  deltaText: { fontSize: 13, color: "var(--muted)" },
  errorRow: {
    marginTop: 16,
    paddingTop: 16,
    borderTop: "1px solid var(--border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  errorText: { fontSize: 13, color: "var(--muted)" },
  retryBtn: {
    background: "transparent",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--text)",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 500,
    padding: "6px 14px",
  },
};
