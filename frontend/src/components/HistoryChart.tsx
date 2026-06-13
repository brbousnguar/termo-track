import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from "recharts";

interface Row { timestamp: string; temperature: number; humidity: number }

interface Props { hours: number; refreshTick: number }

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const TooltipContent = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", fontSize: 13 }}>
      <div style={{ color: "var(--muted)", marginBottom: 6 }}>{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.color }}>
          {p.name}: <strong>{p.value}{p.name === "Temp (°C)" ? "°C" : "%"}</strong>
        </div>
      ))}
    </div>
  );
};

export function HistoryChart({ hours, refreshTick }: Props) {
  const [data, setData] = useState<Row[]>([]);

  useEffect(() => {
    fetch(`/api/history?hours=${hours}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.status === "ok") setData(j.data);
      })
      .catch(() => {});
  }, [hours, refreshTick]);

  const chartData = data.map((r) => ({
    time: fmtTime(r.timestamp),
    "Temp (°C)": r.temperature,
    "Humidity (%)": r.humidity,
  }));

  if (chartData.length === 0) {
    return (
      <div style={styles.card}>
        <div style={styles.title}>History — last {hours}h</div>
        <div style={styles.empty}>No data yet. Readings will appear here once the sensor is detected.</div>
      </div>
    );
  }

  return (
    <div style={styles.card}>
      <div style={styles.title}>History — last {hours}h</div>
      <ResponsiveContainer width="100%" height={260}>
        <LineChart data={chartData} margin={{ top: 4, right: 12, left: -10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="time" tick={{ fill: "var(--muted)", fontSize: 11 }} interval="preserveStartEnd" />
          <YAxis yAxisId="temp" domain={["auto", "auto"]} tick={{ fill: "var(--muted)", fontSize: 11 }} />
          <YAxis yAxisId="hum" orientation="right" domain={[0, 100]} tick={{ fill: "var(--muted)", fontSize: 11 }} />
          <Tooltip content={<TooltipContent />} />
          <Legend wrapperStyle={{ fontSize: 13, color: "var(--muted)" }} />
          <Line yAxisId="temp" type="monotone" dataKey="Temp (°C)" stroke="var(--orange)" strokeWidth={2} dot={false} />
          <Line yAxisId="hum"  type="monotone" dataKey="Humidity (%)" stroke="var(--teal)" strokeWidth={2} dot={false} />
        </LineChart>
      </ResponsiveContainer>
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
  title: { fontWeight: 600, fontSize: 16, marginBottom: 20 },
  empty: { color: "var(--muted)", textAlign: "center", padding: "40px 0" },
};
