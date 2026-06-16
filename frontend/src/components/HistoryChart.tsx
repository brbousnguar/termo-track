import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from "recharts";

interface Row { timestamp: string; temperature: number; humidity: number }

interface Props { hours: number; refreshTick: number; accent: string }

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const TooltipContent = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      <div className="chart-tip-label">{label}</div>
      {payload.map((p: any) => (
        <div key={p.name} style={{ color: p.color }}>
          {p.name}: <strong>{p.value}{p.name === "Temp (°C)" ? "°C" : "%"}</strong>
        </div>
      ))}
    </div>
  );
};

export function HistoryChart({ hours, refreshTick, accent }: Props) {
  const [data, setData] = useState<Row[]>([]);

  useEffect(() => {
    fetch(`/api/history?hours=${hours}`)
      .then((r) => r.json())
      .then((j) => { if (j.status === "ok") setData(j.data); })
      .catch(() => {});
  }, [hours, refreshTick]);

  const chartData = data.map((r) => ({
    time: fmtTime(r.timestamp),
    "Temp (°C)": r.temperature,
    "Humidity (%)": r.humidity,
  }));

  return (
    <div className="card span-all">
      <div className="card-head"><span className="card-title">History — last {hours}h</span></div>
      {chartData.length === 0 ? (
        <div className="card-empty">No data yet. Readings will appear here once the sensor is detected.</div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={chartData} margin={{ top: 4, right: 12, left: -10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="time" tick={{ fill: "var(--muted)", fontSize: 11 }} interval="preserveStartEnd" />
            <YAxis yAxisId="temp" domain={["auto", "auto"]} tick={{ fill: "var(--muted)", fontSize: 11 }} />
            <YAxis yAxisId="hum" orientation="right" domain={[0, 100]} tick={{ fill: "var(--muted)", fontSize: 11 }} />
            <Tooltip content={<TooltipContent />} cursor={{ stroke: "rgba(255,255,255,0.18)" }} />
            <Legend wrapperStyle={{ fontSize: 13, color: "var(--muted)" }} />
            <Line yAxisId="temp" type="monotone" dataKey="Temp (°C)" stroke={accent} strokeWidth={2.5} dot={false} />
            <Line yAxisId="hum" type="monotone" dataKey="Humidity (%)" stroke="var(--teal)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
