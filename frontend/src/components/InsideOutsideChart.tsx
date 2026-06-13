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
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        padding: "10px 14px",
        fontSize: 13,
      }}
    >
      <div style={{ color: "var(--muted)", marginBottom: 6 }}>{fmtTick(label)}</div>
      {typeof inside === "number" && (
        <div style={{ color: "var(--orange)" }}>
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

export function InsideOutsideChart({ hours, refreshTick }: Props) {
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
    <div style={styles.card}>
      <div style={styles.headerRow}>
        <div style={styles.title}>Inside vs Outside — last {hours}h</div>
        {geoStatus === "error" && (
          <button style={styles.retryBtn} onClick={retry}>
            Enable location
          </button>
        )}
      </div>

      {!hasInside && !hasOutside ? (
        <div style={styles.empty}>No data yet for this range.</div>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data} margin={{ top: 4, right: 12, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
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
              <Tooltip content={<TooltipContent />} />
              <Legend wrapperStyle={{ fontSize: 13, color: "var(--muted)" }} />
              <Line
                type="monotone"
                dataKey="inside"
                name="Inside"
                stroke="var(--orange)"
                strokeWidth={2}
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
            <div style={styles.note}>
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

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: "var(--surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius)",
    padding: "24px",
  },
  headerRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  title: { fontWeight: 600, fontSize: 16 },
  empty: { color: "var(--muted)", textAlign: "center", padding: "40px 0" },
  note: { color: "var(--muted)", fontSize: 13, marginTop: 10, textAlign: "center" },
  retryBtn: {
    background: "transparent",
    border: "1px solid var(--border)",
    borderRadius: 8,
    color: "var(--text)",
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 500,
    padding: "6px 14px",
  },
};
