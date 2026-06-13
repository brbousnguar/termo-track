import { useState } from "react";
import { HistoryChart } from "./components/HistoryChart";
import { LiveReadingCard } from "./components/LiveReading";
import { StatsCard } from "./components/StatsCard";
import { useWebSocket } from "./hooks/useWebSocket";

const WS_URL = `ws://${location.host}/ws`;
const HOUR_OPTIONS = [6, 24, 48, 168] as const;

export default function App() {
  const { reading, connected } = useWebSocket(WS_URL);
  const [hours, setHours] = useState<number>(24);
  const [tick, setTick] = useState(0);

  // Bump tick whenever a new live reading arrives so the chart refreshes
  // We use reading?.timestamp as the dependency key via useEffect in HistoryChart
  const refreshTick = tick;

  return (
    <div style={styles.root}>
      <header style={styles.header}>
        <div style={styles.logo}>
          <span style={styles.logoIcon}>🌡</span>
          <span style={styles.logoText}>Termo Track</span>
        </div>
        <div style={styles.rangeButtons}>
          {HOUR_OPTIONS.map((h) => (
            <button
              key={h}
              style={{ ...styles.rangeBtn, ...(hours === h ? styles.rangeBtnActive : {}) }}
              onClick={() => { setHours(h); setTick((t) => t + 1); }}
            >
              {h < 48 ? `${h}h` : `${h / 24}d`}
            </button>
          ))}
        </div>
      </header>

      <main style={styles.main}>
        <LiveReadingCard reading={reading} connected={connected} />
        <StatsCard hours={hours} />
        <HistoryChart hours={hours} refreshTick={refreshTick} />
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: { display: "flex", flexDirection: "column", minHeight: "100vh" },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 24px",
    borderBottom: "1px solid var(--border)",
    background: "var(--surface)",
  },
  logo: { display: "flex", alignItems: "center", gap: 10 },
  logoIcon: { fontSize: 24 },
  logoText: { fontWeight: 700, fontSize: 18, letterSpacing: "-0.02em" },
  rangeButtons: { display: "flex", gap: 6 },
  rangeBtn: {
    background: "transparent",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--muted)",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 500,
    padding: "6px 14px",
    transition: "all 0.15s",
  },
  rangeBtnActive: {
    background: "var(--blue)",
    borderColor: "var(--blue)",
    color: "#fff",
  },
  main: {
    flex: 1,
    maxWidth: 820,
    margin: "0 auto",
    padding: "24px 16px",
    width: "100%",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
};
