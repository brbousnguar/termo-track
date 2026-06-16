import { useEffect, useState } from "react";

interface Stats {
  temp_min: number; temp_max: number; temp_avg: number;
  hum_min: number;  hum_max: number;  hum_avg: number;
  count: number;
}

interface Props { hours: number }

export function StatsCard({ hours }: Props) {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    const load = () =>
      fetch(`/api/stats?hours=${hours}`)
        .then((r) => r.json())
        .then((j) => j.status === "ok" && setStats(j.data))
        .catch(() => {});
    load();
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [hours]);

  if (!stats) {
    return (
      <div className="card">
        <div className="card-head"><span className="card-title">Last {hours}h summary</span></div>
        <div className="card-empty">No data yet.</div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Last {hours}h summary <span className="count">({stats.count} readings)</span></span>
      </div>
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
    </div>
  );
}
