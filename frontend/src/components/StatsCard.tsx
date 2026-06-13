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
    fetch(`/api/stats?hours=${hours}`)
      .then((r) => r.json())
      .then((j) => j.status === "ok" && setStats(j.data))
      .catch(() => {});
    const id = setInterval(() => {
      fetch(`/api/stats?hours=${hours}`)
        .then((r) => r.json())
        .then((j) => j.status === "ok" && setStats(j.data))
        .catch(() => {});
    }, 60_000);
    return () => clearInterval(id);
  }, [hours]);

  if (!stats) return null;

  return (
    <div style={styles.card}>
      <div style={styles.title}>Last {hours}h summary  <span style={styles.count}>({stats.count} readings)</span></div>
      <table style={styles.table}>
        <thead>
          <tr>
            <th style={styles.th}></th>
            <th style={styles.th}>Min</th>
            <th style={styles.th}>Avg</th>
            <th style={styles.th}>Max</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style={styles.label}>Temperature</td>
            <td style={styles.val}>{stats.temp_min}°C</td>
            <td style={{ ...styles.val, color: "var(--orange)", fontWeight: 600 }}>{stats.temp_avg}°C</td>
            <td style={styles.val}>{stats.temp_max}°C</td>
          </tr>
          <tr>
            <td style={styles.label}>Humidity</td>
            <td style={styles.val}>{stats.hum_min}%</td>
            <td style={{ ...styles.val, color: "var(--teal)", fontWeight: 600 }}>{stats.hum_avg}%</td>
            <td style={styles.val}>{stats.hum_max}%</td>
          </tr>
        </tbody>
      </table>
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
  title: { fontWeight: 600, fontSize: 16, marginBottom: 16 },
  count: { color: "var(--muted)", fontWeight: 400, fontSize: 13 },
  table: { width: "100%", borderCollapse: "collapse" },
  th: { textAlign: "center", fontSize: 12, color: "var(--muted)", padding: "4px 12px", textTransform: "uppercase", letterSpacing: "0.05em" },
  label: { fontSize: 14, color: "var(--muted)", padding: "8px 0" },
  val: { textAlign: "center", fontSize: 15, padding: "8px 12px" },
};
