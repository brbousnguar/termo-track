import { useState } from "react";
import { ComparisonCard } from "./components/ComparisonCard";
import { HistoryChart } from "./components/HistoryChart";
import { InsideOutsideChart } from "./components/InsideOutsideChart";
import { LiveReadingCard } from "./components/LiveReading";
import { StatsCard } from "./components/StatsCard";
import { useWebSocket } from "./hooks/useWebSocket";
import { themeForReading, themeVars } from "./theme";

const WS_URL = `ws://${location.host}/ws`;
const HOUR_OPTIONS = [6, 24, 48, 168] as const;

export default function App() {
  const { reading, connected } = useWebSocket(WS_URL);
  const [hours, setHours] = useState<number>(24);
  const [tick, setTick] = useState(0);

  const theme = themeForReading(reading);

  return (
    <div className="app" style={themeVars(theme)}>
      <div className="app-bg" aria-hidden="true" />

      <header className="topbar">
        <div className="logo">
          <span className="logo-icon">🌡</span>
          <span className="logo-text">Termo Track</span>
        </div>
        <div className="range">
          {HOUR_OPTIONS.map((h) => (
            <button
              key={h}
              className={hours === h ? "active" : ""}
              onClick={() => { setHours(h); setTick((t) => t + 1); }}
            >
              {h < 48 ? `${h}h` : `${h / 24}d`}
            </button>
          ))}
        </div>
      </header>

      <main className="stage">
        <LiveReadingCard reading={reading} connected={connected} accent={theme.accent} />

        <div className="grid">
          <ComparisonCard reading={reading} />
          <StatsCard hours={hours} />
          <InsideOutsideChart hours={hours} refreshTick={tick} accent={theme.accent} />
          <HistoryChart hours={hours} refreshTick={tick} accent={theme.accent} />
        </div>
      </main>
    </div>
  );
}
