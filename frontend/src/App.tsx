import { useState } from "react";
import { ComparisonCard } from "./components/ComparisonCard";
import { HistoryChart } from "./components/HistoryChart";
import { InsideOutsideChart } from "./components/InsideOutsideChart";
import { LiveReadingCard } from "./components/LiveReading";
import { StatsCard } from "./components/StatsCard";
import { useWebSocket } from "./hooks/useWebSocket";
import { useRefresh } from "./hooks/useRefresh";
import { usePullToRefresh } from "./hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "./components/PullToRefreshIndicator";
import { themeForReading, themeVars } from "./theme";

const WS_PROTOCOL = location.protocol === "https:" ? "wss" : "ws";
const WS_URL = `${WS_PROTOCOL}://${location.host}/ws`;
const HOUR_OPTIONS = [6, 24, 48, 168] as const;

export default function App() {
  const { reading, connected } = useWebSocket(WS_URL);
  const [hours, setHours] = useState<number>(24);
  const { refreshTick, refresh, refreshing } = useRefresh();
  const { pullState, pullDistance } = usePullToRefresh(refresh);

  const theme = themeForReading(reading);

  return (
    <div className="app" style={themeVars(theme)}>
      <div className="app-bg" aria-hidden="true" />
      <PullToRefreshIndicator pullState={pullState} pullDistance={pullDistance} />

      <header className="topbar">
        <div className="logo">
          <span className="logo-icon">🌡</span>
          <span className="logo-text">Termo Track</span>
        </div>
        <div className="topbar-actions">
          <div className="range">
            {HOUR_OPTIONS.map((h) => (
              <button
                key={h}
                className={hours === h ? "active" : ""}
                onClick={() => { setHours(h); refresh(); }}
              >
                {h < 48 ? `${h}h` : `${h / 24}d`}
              </button>
            ))}
          </div>
          <button
            className={`refresh-btn${refreshing ? " spinning" : ""}`}
            onClick={refresh}
            aria-label="Refresh data"
            title="Refresh"
          >
            ↻
          </button>
        </div>
      </header>

      <main className="stage">
        <LiveReadingCard reading={reading} connected={connected} accent={theme.accent} />

        <div className="grid">
          <ComparisonCard reading={reading} />
          <StatsCard hours={hours} refreshTick={refreshTick} />
          <InsideOutsideChart hours={hours} refreshTick={refreshTick} accent={theme.accent} />
          <HistoryChart hours={hours} refreshTick={refreshTick} accent={theme.accent} />
        </div>
      </main>
    </div>
  );
}
