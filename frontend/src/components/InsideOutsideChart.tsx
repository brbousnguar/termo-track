import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useEffect, useState } from "react";
import { useOutsideHistory } from "../hooks/useOutsideHistory";
import { useOutsideDailyHistory } from "../hooks/useOutsideDailyHistory";
import { SkeletonChart } from "./Skeleton";
import { useToast } from "./Toast";
import { Period, periodKey, periodLabel, periodRange } from "../lib/period";

interface Row {
  timestamp: string;
  temperature: number;
}

interface Props {
  period: Period;
  refreshTick: number;
  accent: string;
}

interface Point {
  t: number; // epoch ms — UTC hour bucket (recent mode) or UTC day (month/year mode)
  inside: number | null;
  outside: number | null;
}

const HOUR_MS = 3_600_000;

function insideMinMaxMedian(data: Point[]): { min: number; max: number; median: number } | null {
  const values = data
    .map((p) => p.inside)
    .filter((v): v is number => v !== null)
    .sort((a, b) => a - b);
  if (values.length === 0) return null;
  const mid = Math.floor(values.length / 2);
  const median = values.length % 2 === 0 ? (values[mid - 1] + values[mid]) / 2 : values[mid];
  return { min: values[0], max: values[values.length - 1], median: Math.round(median * 10) / 10 };
}

function fmtTick(period: Period, t: number): string {
  const d = new Date(t);
  if (period.mode === "recent") {
    return period.hours <= 24
      ? d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
      : d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
  }
  return d.toLocaleDateString([], { month: "short", day: "numeric" });
}

function insideUrl(period: Period): string {
  if (period.mode === "recent") return `/api/history?hours=${period.hours}`;
  const { start, end } = periodRange(period);
  return `/api/history/daily?start=${start}&end=${end}`;
}

const TooltipContent = ({ active, payload, label, period }: any) => {
  if (!active || !payload?.length) return null;
  const inside = payload.find((p: any) => p.dataKey === "inside")?.value;
  const outside = payload.find((p: any) => p.dataKey === "outside")?.value;
  const both = typeof inside === "number" && typeof outside === "number";
  const diff = both ? inside - outside : null;
  return (
    <div className="chart-tip">
      <div className="chart-tip-label">{fmtTick(period, label)}</div>
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

export function InsideOutsideChart({ period, refreshTick, accent }: Props) {
  const { toast } = useToast();
  const [inside, setInside] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isRecent = period.mode === "recent";
  const range = isRecent ? null : periodRange(period);

  // Rules of hooks require both to run unconditionally; each hook no-ops
  // (skips its fetch) when given a falsy hours/start/end for the inactive mode.
  const hourly = useOutsideHistory(isRecent ? period.hours : 0, refreshTick);
  const daily = useOutsideDailyHistory(range?.start ?? "", range?.end ?? "", refreshTick);
  const { outsideByHour: outsideMap, geoStatus, geoError, retry } = isRecent
    ? hourly
    : { outsideByHour: daily.outsideByDay, geoStatus: daily.geoStatus, geoError: daily.geoError, retry: daily.retry };

  const fetchInside = () => {
    setLoading(true);
    setError(null);
    fetch(insideUrl(period))
      .then((r) => r.json())
      .then((j) => {
        if (j.status === "ok") setInside(j.data);
        else setError("Unexpected response from server");
      })
      .catch(() => {
        setError("Failed to load indoor data");
        toast("Failed to load indoor data", "error");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchInside();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [periodKey(period), refreshTick]);

  let data: Point[];
  if (isRecent) {
    // Bucket indoor readings into hourly averages, keyed by UTC hour (epoch ms).
    const insideByHour = new Map<number, { sum: number; n: number }>();
    for (const r of inside) {
      const hour = Math.floor(new Date(r.timestamp).getTime() / HOUR_MS) * HOUR_MS;
      const acc = insideByHour.get(hour) ?? { sum: 0, n: 0 };
      acc.sum += r.temperature;
      acc.n += 1;
      insideByHour.set(hour, acc);
    }

    const now = Date.now();
    const from = now - period.hours * HOUR_MS;
    const hourSet = new Set<number>([...insideByHour.keys(), ...outsideMap.keys()]);
    data = [...hourSet]
      .filter((t) => t >= from - HOUR_MS && t <= now + HOUR_MS)
      .sort((a, b) => a - b)
      .map((t) => {
        const ins = insideByHour.get(t);
        return {
          t,
          inside: ins ? Math.round((ins.sum / ins.n) * 10) / 10 : null,
          outside: outsideMap.has(t) ? outsideMap.get(t)! : null,
        };
      });
  } else {
    // Month/Year: indoor rows already arrive daily-averaged, keyed by UTC day.
    const insideByDay = new Map<number, number>();
    for (const r of inside) {
      insideByDay.set(new Date(r.timestamp).getTime(), r.temperature);
    }
    const daySet = new Set<number>([...insideByDay.keys(), ...outsideMap.keys()]);
    data = [...daySet]
      .sort((a, b) => a - b)
      .map((t) => ({
        t,
        inside: insideByDay.get(t) ?? null,
        outside: outsideMap.get(t) ?? null,
      }));
  }

  const hasInside = data.some((p) => p.inside !== null);
  const hasOutside = data.some((p) => p.outside !== null);

  // Min/max/median reference lines are only meaningful for the short "recent"
  // windows (6h–7d); a month/year view is already daily-averaged.
  const insideStats = isRecent ? insideMinMaxMedian(data) : null;

  return (
    <div className="card span-all">
      <div className="card-head">
        <span className="card-title">
          Inside vs Outside — {isRecent ? `last ${periodLabel(period)}` : periodLabel(period)}
        </span>
        {geoStatus === "error" && (
          <button className="btn-ghost" onClick={retry}>Enable location</button>
        )}
      </div>

      {loading ? (
        <SkeletonChart />
      ) : error ? (
        <div className="card-empty">
          <div className="error-row" style={{ justifyContent: "center", border: 0, margin: 0 }}>
            <span className="error-text">⚠ {error}</span>
            <button className="btn-ghost" onClick={fetchInside}>Retry</button>
          </div>
        </div>
      ) : !hasInside && !hasOutside ? (
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
                tickFormatter={(t) => fmtTick(period, t)}
                tick={{ fill: "var(--muted)", fontSize: 11 }}
                interval="preserveStartEnd"
              />
              <YAxis
                domain={["auto", "auto"]}
                tick={{ fill: "var(--muted)", fontSize: 11 }}
                unit="°"
              />
              <Tooltip content={<TooltipContent period={period} />} cursor={{ stroke: "rgba(255,255,255,0.18)" }} />
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
              {insideStats && (
                <>
                  <ReferenceLine
                    y={insideStats.max}
                    stroke={accent}
                    strokeDasharray="4 4"
                    strokeOpacity={0.5}
                    ifOverflow="extendDomain"
                    label={{ value: `Max ${insideStats.max}°`, position: "top", fill: accent, fontSize: 11 }}
                  />
                  <ReferenceLine
                    y={insideStats.median}
                    stroke={accent}
                    strokeDasharray="2 4"
                    strokeOpacity={0.5}
                    ifOverflow="extendDomain"
                    label={{ value: `Median ${insideStats.median}°`, position: "insideBottomRight", fill: accent, fontSize: 11 }}
                  />
                  <ReferenceLine
                    y={insideStats.min}
                    stroke={accent}
                    strokeDasharray="4 4"
                    strokeOpacity={0.5}
                    ifOverflow="extendDomain"
                    label={{ value: `Min ${insideStats.min}°`, position: "bottom", fill: accent, fontSize: 11 }}
                  />
                </>
              )}
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
