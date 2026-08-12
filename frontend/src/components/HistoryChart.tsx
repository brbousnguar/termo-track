import { useEffect, useState } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer,
} from "recharts";
import { SkeletonChart } from "./Skeleton";
import { useToast } from "./Toast";
import { Period, periodKey, periodLabel, periodRange } from "../lib/period";

interface Row { timestamp: string; temperature: number; humidity: number }

interface Props { period: Period; refreshTick: number; accent: string }

// Recent-mode readings are full ISO timestamps ("2026-08-10T14:23:00Z"); Month/Year
// readings are daily-averaged and come back as bare dates ("2026-08-10"). Long
// windows need the date/month shown, not just a repeating time-of-day.
function fmtTime(period: Period, iso: string): string {
  const d = new Date(iso);
  if (period.mode === "recent") {
    return period.hours <= 24
      ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function historyUrl(period: Period): string {
  if (period.mode === "recent") return `/api/history?hours=${period.hours}`;
  const { start, end } = periodRange(period);
  return `/api/history/daily?start=${start}&end=${end}`;
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

export function HistoryChart({ period, refreshTick, accent }: Props) {
  const { toast } = useToast();
  const [data, setData] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = () => {
    setLoading(true);
    setError(null);
    fetch(historyUrl(period))
      .then((r) => r.json())
      .then((j) => {
        if (j.status === "ok") setData(j.data);
        else setError("Unexpected response from server");
      })
      .catch(() => {
        setError("Failed to load history data");
        toast("Failed to load history", "error");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodKey(period), refreshTick]);

  const chartData = data.map((r) => ({
    time: fmtTime(period, r.timestamp),
    "Temp (°C)": r.temperature,
    "Humidity (%)": r.humidity,
  }));

  const title = period.mode === "recent" ? `History — last ${periodLabel(period)}` : `History — ${periodLabel(period)}`;

  return (
    <div className="card span-all">
      <div className="card-head"><span className="card-title">{title}</span></div>
      {loading ? (
        <SkeletonChart />
      ) : error ? (
        <div className="card-empty">
          <div className="error-row" style={{ justifyContent: "center", border: 0, margin: 0 }}>
            <span className="error-text">⚠ {error}</span>
            <button className="btn-ghost" onClick={fetchData}>Retry</button>
          </div>
        </div>
      ) : chartData.length === 0 ? (
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
