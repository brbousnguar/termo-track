import { useEffect, useState } from "react";
import { SkeletonTable } from "./Skeleton";
import { useToast } from "./Toast";
import { Period, periodKey, periodLabel, periodRange } from "../lib/period";

interface Stats {
  temp_min: number; temp_max: number; temp_avg: number;
  hum_min: number;  hum_max: number;  hum_avg: number;
  count: number;
}

interface Props { period: Period; refreshTick?: number }

function statsUrl(period: Period): string {
  if (period.mode === "recent") return `/api/stats?hours=${period.hours}`;
  const { start, end } = periodRange(period);
  return `/api/stats/range?start=${start}&end=${end}`;
}

export function StatsCard({ period, refreshTick = 0 }: Props) {
  const { toast } = useToast();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    fetch(statsUrl(period))
      .then((r) => r.json())
      .then((j) => {
        if (j.status === "ok") setStats(j.data);
        else setError("Unexpected response from server");
      })
      .catch(() => {
        setError("Failed to load stats");
        toast("Failed to load stats", "error");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodKey(period), refreshTick]);

  const title = period.mode === "recent" ? `Last ${periodLabel(period)} summary` : `${periodLabel(period)} summary`;

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">{title}{stats ? ` (${stats.count} readings)` : ""}</span>
      </div>
      {loading ? (
        <SkeletonTable rows={2} cols={4} />
      ) : error ? (
        <div className="card-empty">
          <div className="error-row" style={{ justifyContent: "center", border: 0, margin: 0 }}>
            <span className="error-text">⚠ {error}</span>
            <button className="btn-ghost" onClick={load}>Retry</button>
          </div>
        </div>
      ) : !stats ? (
        <div className="card-empty">No data yet.</div>
      ) : (
        <table className="stats-table">
          <thead>
            <tr>
              <th></th>
              <th>Min</th>
              <th>Avg</th>
              <th>Max</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="label">Temperature</td>
              <td className="val">{stats.temp_min}°C</td>
              <td className="val avg" style={{ color: "var(--orange)" }}>{stats.temp_avg}°C</td>
              <td className="val">{stats.temp_max}°C</td>
            </tr>
            <tr>
              <td className="label">Humidity</td>
              <td className="val">{stats.hum_min}%</td>
              <td className="val avg" style={{ color: "var(--teal)" }}>{stats.hum_avg}%</td>
              <td className="val">{stats.hum_max}%</td>
            </tr>
          </tbody>
        </table>
      )}
    </div>
  );
}
