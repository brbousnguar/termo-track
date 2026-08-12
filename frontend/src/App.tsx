import { useState } from "react";
import { ComparisonCard } from "./components/ComparisonCard";
import { HistoryChart } from "./components/HistoryChart";
import { InsideOutsideChart } from "./components/InsideOutsideChart";
import { LiveReadingCard } from "./components/LiveReading";
import { PeriodSelector } from "./components/PeriodSelector";
import { StatsCard } from "./components/StatsCard";
import { useWebSocket } from "./hooks/useWebSocket";
import { useRefresh } from "./hooks/useRefresh";
import { usePullToRefresh } from "./hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "./components/PullToRefreshIndicator";
import { themeForReading, themeVars } from "./theme";
import type { Period } from "./lib/period";

const WS_PROTOCOL = location.protocol === "https:" ? "wss" : "ws";
const WS_URL = `${WS_PROTOCOL}://${location.host}/ws`;

export default function App() {
  const { reading, connected } = useWebSocket(WS_URL);
  const [period, setPeriod] = useState<Period>({ mode: "recent", hours: 24 });
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
          <PeriodSelector period={period} onChange={(p) => { setPeriod(p); refresh(); }} />
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
          <StatsCard period={period} refreshTick={refreshTick} />
          <InsideOutsideChart period={period} refreshTick={refreshTick} accent={theme.accent} />
          <HistoryChart period={period} refreshTick={refreshTick} accent={theme.accent} />
        </div>
      </main>
    </div>
  );
}
