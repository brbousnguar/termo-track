import type { LiveReading } from "../hooks/useWebSocket";
import { useWeather } from "../hooks/useWeather";

interface Props {
  reading: LiveReading | null;
}

function tempDeltaInfo(diff: number): { text: string; color: string; arrow: string } {
  if (Math.abs(diff) < 0.5) return { text: "about the same", color: "var(--muted)", arrow: "≈" };
  return diff > 0
    ? { text: "warmer inside", color: "var(--orange)", arrow: "▲" }
    : { text: "cooler inside", color: "var(--blue)", arrow: "▼" };
}

function humDeltaInfo(diff: number): { text: string; color: string; arrow: string } {
  if (Math.abs(diff) < 1) return { text: "about the same", color: "var(--muted)", arrow: "≈" };
  return diff > 0
    ? { text: "more humid inside", color: "var(--teal)", arrow: "▲" }
    : { text: "drier inside", color: "var(--orange)", arrow: "▼" };
}

export function ComparisonCard({ reading }: Props) {
  const { weather, status, error, retry } = useWeather();

  const locationChip =
    status === "ready" && weather?.locationName
      ? `📍 ${weather.locationName}`
      : status === "locating"
        ? "📍 Locating…"
        : status === "loading"
          ? "📍 Loading weather…"
          : "📍 Outside";

  const haveBoth = reading !== null && weather !== null;
  const tempDiff = haveBoth ? reading!.temperature - weather!.temperature : 0;
  const humDiff = haveBoth ? reading!.humidity - weather!.humidity : 0;
  const td = tempDeltaInfo(tempDiff);
  const hd = humDeltaInfo(humDiff);

  return (
    <div className="card">
      <div className="card-head">
        <span className="card-title">Indoor vs Outdoor</span>
        <span className="chip">{locationChip}</span>
      </div>

      <div className="io-panels">
        <Panel
          icon="🏠"
          label="Room"
          temp={reading ? reading.temperature : null}
          hum={reading ? reading.humidity : null}
          accent="var(--orange)"
          placeholder="Waiting for sensor…"
        />
        <div className="io-divider" />
        <Panel
          icon="🌤"
          label="Outside"
          temp={status === "ready" && weather ? weather.temperature : null}
          hum={status === "ready" && weather ? weather.humidity : null}
          accent="var(--blue)"
          placeholder={
            status === "error" ? "Unavailable" : status === "locating" ? "Locating…" : "Loading…"
          }
        />
      </div>

      {haveBoth ? (
        <div className="delta-strip">
          <DeltaRow
            label="Temperature"
            value={`${tempDiff > 0 ? "+" : ""}${tempDiff.toFixed(1)}°C`}
            arrow={td.arrow}
            text={td.text}
            color={td.color}
          />
          <DeltaRow
            label="Humidity"
            value={`${humDiff > 0 ? "+" : ""}${humDiff.toFixed(0)}%`}
            arrow={hd.arrow}
            text={hd.text}
            color={hd.color}
          />
        </div>
      ) : error ? (
        <div className="error-row">
          <span className="error-text">{error}</span>
          <button className="btn-ghost" onClick={retry}>Retry</button>
        </div>
      ) : null}
    </div>
  );
}

function Panel({
  icon,
  label,
  temp,
  hum,
  accent,
  placeholder,
}: {
  icon: string;
  label: string;
  temp: number | null;
  hum: number | null;
  accent: string;
  placeholder: string;
}) {
  return (
    <div className="io-panel">
      <div className="io-head">
        <span className="io-icon">{icon}</span>
        <span className="io-label">{label}</span>
      </div>
      {temp !== null ? (
        <>
          <div className="io-temp">
            <span style={{ color: accent }}>{temp.toFixed(1)}</span>
            <span className="io-unit">°C</span>
          </div>
          <div className="io-hum">{hum !== null ? `${hum.toFixed(0)}% humidity` : ""}</div>
        </>
      ) : (
        <div className="io-placeholder">{placeholder}</div>
      )}
    </div>
  );
}

function DeltaRow({
  label,
  value,
  arrow,
  text,
  color,
}: {
  label: string;
  value: string;
  arrow: string;
  text: string;
  color: string;
}) {
  return (
    <div className="delta-row">
      <span className="delta-label">{label}</span>
      <span className="delta-right">
        <span className="delta-value" style={{ color }}>{arrow} {value}</span>
        <span className="delta-text">{text}</span>
      </span>
    </div>
  );
}
