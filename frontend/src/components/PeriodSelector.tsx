import { canShiftForward, Period, periodLabel, shiftPeriod } from "../lib/period";

const HOUR_OPTIONS = [6, 24, 48, 168] as const;

interface Props {
  period: Period;
  onChange: (period: Period) => void;
}

export function PeriodSelector({ period, onChange }: Props) {
  const setMode = (mode: Period["mode"]) => {
    if (mode === period.mode) return;
    const now = new Date();
    if (mode === "recent") onChange({ mode: "recent", hours: 24 });
    else if (mode === "month") onChange({ mode: "month", year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 });
    else onChange({ mode: "year", year: now.getUTCFullYear() });
  };

  return (
    <div className="period-selector">
      <div className="range">
        <button className={period.mode === "recent" ? "active" : ""} onClick={() => setMode("recent")}>Recent</button>
        <button className={period.mode === "month" ? "active" : ""} onClick={() => setMode("month")}>Month</button>
        <button className={period.mode === "year" ? "active" : ""} onClick={() => setMode("year")}>Year</button>
      </div>

      {period.mode === "recent" && (
        <div className="range">
          {HOUR_OPTIONS.map((h) => (
            <button
              key={h}
              className={period.hours === h ? "active" : ""}
              onClick={() => onChange({ mode: "recent", hours: h })}
            >
              {h < 48 ? `${h}h` : `${h / 24}d`}
            </button>
          ))}
        </div>
      )}

      {(period.mode === "month" || period.mode === "year") && (
        <div className="period-nav">
          <button aria-label="Previous" onClick={() => onChange(shiftPeriod(period, -1))}>‹</button>
          <span className="period-nav-label">{periodLabel(period)}</span>
          <button
            aria-label="Next"
            disabled={!canShiftForward(period)}
            onClick={() => onChange(shiftPeriod(period, 1))}
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}
