// Shared time-window model for the dashboard's charts.
//
// "recent" mirrors the original relative-hours behavior (raw readings from
// the backend). "month"/"year" are absolute calendar windows anchored in UTC
// (matching how readings are timestamped) and are served daily-averaged by
// the backend, since a month of raw ~1/min readings is tens of thousands of
// points — too many to fetch or render usefully.
export type Period =
  | { mode: "recent"; hours: number }
  | { mode: "month"; year: number; month: number } // month is 1-12
  | { mode: "year"; year: number };

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}

export function todayISO(): string {
  return isoDate(new Date());
}

/** [start, end) as YYYY-MM-DD, UTC calendar boundaries. Only valid for month/year periods. */
export function periodRange(period: Period): { start: string; end: string } {
  if (period.mode === "month") {
    return {
      start: isoDate(new Date(Date.UTC(period.year, period.month - 1, 1))),
      end: isoDate(new Date(Date.UTC(period.year, period.month, 1))),
    };
  }
  if (period.mode === "year") {
    return {
      start: isoDate(new Date(Date.UTC(period.year, 0, 1))),
      end: isoDate(new Date(Date.UTC(period.year + 1, 0, 1))),
    };
  }
  throw new Error("periodRange only applies to month/year periods");
}

export function periodLabel(period: Period): string {
  if (period.mode === "recent") return period.hours < 48 ? `${period.hours}h` : `${period.hours / 24}d`;
  if (period.mode === "month") return `${MONTH_NAMES[period.month - 1]} ${period.year}`;
  return `${period.year}`;
}

/** Stable string key for effect dependency arrays / cache keys. */
export function periodKey(period: Period): string {
  if (period.mode === "recent") return `recent:${period.hours}`;
  if (period.mode === "month") return `month:${period.year}-${period.month}`;
  return `year:${period.year}`;
}

export function shiftPeriod(period: Period, dir: -1 | 1): Period {
  if (period.mode === "month") {
    let { year, month } = period;
    month += dir;
    if (month < 1) { month = 12; year -= 1; }
    if (month > 12) { month = 1; year += 1; }
    return { mode: "month", year, month };
  }
  if (period.mode === "year") {
    return { mode: "year", year: period.year + dir };
  }
  return period;
}

/** Disallow navigating past the current UTC month/year. */
export function canShiftForward(period: Period): boolean {
  const now = new Date();
  if (period.mode === "month") {
    return (
      period.year < now.getUTCFullYear() ||
      (period.year === now.getUTCFullYear() && period.month < now.getUTCMonth() + 1)
    );
  }
  if (period.mode === "year") return period.year < now.getUTCFullYear();
  return false;
}
