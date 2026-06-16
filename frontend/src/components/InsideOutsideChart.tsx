import { useEffect, useState } from "react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useOutsideHistory } from "../hooks/useOutsideHistory";

interface Row {
  timestamp: string;
  temperature: number;
}

interface Props {
  hours: number;
  refreshTick: number;
  accent: string;
}

interface Point {
  t: number; // UTC hour, epoch ms
  inside: number | null;
  outside: number | null;
}

const HOUR_MS = 3_600_000;

function fmtTick(t: number) {
  return new Date(t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const TooltipContent = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  const inside = payload.find((p: any) => p.dataKey === "inside")?.value;
  const outside = payload.find((p: any) => p.dataKey === "outside")?.value;
  const both = typeof inside === "number" && typeof outside === "number";
  const diff = both ? inside - outside : null;
  return (
    <div className="chart-tip">
      <div className="chart-tip-label">{fmtTick(label)}</div>
      {typeof inside === "number" && (
        <div style={{ color: "var(--text)" }}>
          Inside: <strong>{inside.toFixed(1)}°C</strong>
        </div>
      )}
      {typeof outside === "number" && (
        <div style={{ color: "var(--blue)" }}>
          Outside: <strong>{outside.toFixed(1)}°C</strong>
        </div>
      )}
      {diff !== null && (
        <div style={{ color: "var(--muted)", marginTop: 4 }}>
          {diff >= 0 ? "+" : ""}
          {diff.toFixed(1)}°C {diff >= 0 ? "warmer inside" : "cooler inside"}
        </div>
      )}
    </div>
  );
};

export function InsideOutsideChart({ hours, refreshTick, accent }: Props) {
  const [inside, setInside] = useState<Row[]>([]);
  const { outsideByHour, geoStatus, geoError, retry } = useOutsideHistory(hours, refreshTick);

  useEffect(() => {
    fetch(`/api/history?hours=${hours}`)
      .then((r) => r.json())
      .then((j) => {
        if (j.status === "ok") setInside(j.data);
      })
      .catch(() => {});
  }, [hours, refreshTick]);

  // Bucket indoor readings into hourly averages, keyed by UTC hour (epoch ms).
  const insideByHour = new Map<number, { sum: number; n: number }>();
  for (const r of inside) {
    const hour = Math.floor(new Date(r.timestamp).getTime() / HOUR_MS) * HOUR_MS;
    const acc = insideByHour.get(hour) ?? { sum: 0, n: 0 };
    acc.sum += r.temperature;
    acc.n += 1;
    insideByHour.set(hour, acc);
  }

  // Build the merged series across the selected window.
  const now = Date.now();
  const from = now - hours * HOUR_MS;
  const hourSet = new Set<number>([...insideByHour.keys(), ...outsideByHour.keys()]);
  const data: Point[] = [...hourSet]
    .filter((t) => t >= from - HOUR_MS && t <= now + HOUR_MS)
    .sort((a, b) => a - b)
    .map((t) => {
      const ins = insideByHour.get(t);
      return {
        t,
        inside: ins ? Math.round((ins.sum / ins.n) * 10) / 10 : null,
        outside: outsideByHour.has(t) ? outsideByHour.get(t)! : null,
      };
    });

  const hasInside = data.some((p) => p.inside !== null);
  const hasOutside = data.some((p) => p.outside !== null);

  return (
    <div className="card span-all">
      <div className="card-head">
        <span className="card-title">Inside vs Outside — last {hours}h</span>
        {geoStatus === "error" && (
          <button className="btn-ghost" onClick={retry}>Enable location</button>
        )}
      </div>

      {!hasInside && !hasOutside ? (
        <div className="card-empty">No data yet for this range.</div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data} margin={{ top: 4, right: 12, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="t"
                type="number"
                scale="time"
                domain={["dataMin", "dataMax"]}
                tickFormatter={fmtTick}
                tick={{ fill: "var(--muted)", fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={["auto", "auto"]}
                tick={{ fill: "var(--muted)", fontSize: 11 }}
                unit="°"
              />
              <Tooltip content={<TooltipContent />} cursor={{ stroke: "rgba(255,255,255,0.18)" }} />
              <Legend wrapperStyle={{ fontSize: 13, color: "var(--muted)" }} />
              <Line
                type="monotone"
                dataKey="inside"
                name="Inside"
                stroke={accent}
                strokeWidth={2.5}
                dot={false}
                connectNulls
              />
              <Line
                type="monotone"
                dataKey="outside"
                name="Outside"
                stroke="var(--blue)"
                strokeWidth={2}
                dot={false}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
          {!hasOutside && (
            <div className="chart-note">
              {geoStatus === "error"
                ? geoError ?? "Outside data unavailable."
                : "Loading outside temperature…"}
            </div>
          )}
        </>
      )}
    </div>
  );
}
