import { useEffect, useState } from "react";
import { useGeolocation, type GeoStatus } from "./useGeolocation";
import { addDaysISO, todayISO } from "../lib/period";

interface OutsideDailyState {
  // Map of UTC day (epoch ms, midnight) -> mean outside temperature °C
  outsideByDay: Map<number, number>;
  geoStatus: GeoStatus;
  geoError: string | null;
  retry: () => void;
}

// Open-Meteo's forecast API (`past_days`) only reaches ~92 days back, so
// Month/Year views use the separate historical Archive API instead. It
// exposes a `daily=temperature_2m_mean` aggregate directly — no need to
// average hourly values ourselves — but it lags a few days behind today,
// so the requested end date is clamped to yesterday.
//
// `start`/`end` are [start, end) UTC dates, matching periodRange(); pass ""
// for both to skip fetching (used when this period isn't month/year).
export function useOutsideDailyHistory(start: string, end: string, refreshTick: number): OutsideDailyState {
  const geo = useGeolocation();
  const [outsideByDay, setOutsideByDay] = useState<Map<number, number>>(new Map());

  useEffect(() => {
    if (!start || !end || geo.status !== "ready" || !geo.coords) return;
    const { latitude, longitude } = geo.coords;

    const inclusiveEnd = addDaysISO(end, -1); // periodRange's end is exclusive; the archive API's is inclusive
    const yesterday = addDaysISO(todayISO(), -1);
    const cappedEnd = inclusiveEnd < yesterday ? inclusiveEnd : yesterday;
    if (cappedEnd < start) {
      setOutsideByDay(new Map());
      return;
    }

    const url =
      `https://archive-api.open-meteo.com/v1/archive?latitude=${latitude}&longitude=${longitude}` +
      `&start_date=${start}&end_date=${cappedEnd}&daily=temperature_2m_mean&timezone=UTC`;

    let cancelled = false;
    fetch(url)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled || !j.daily?.time) return;
        const days: string[] = j.daily.time;
        const temps: number[] = j.daily.temperature_2m_mean;
        const m = new Map<number, number>();
        for (let i = 0; i < days.length; i++) {
          if (typeof temps[i] === "number") m.set(new Date(`${days[i]}T00:00:00Z`).getTime(), temps[i]);
        }
        setOutsideByDay(m);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [geo.status, geo.coords, start, end, refreshTick]);

  return { outsideByDay, geoStatus: geo.status, geoError: geo.error, retry: geo.retry };
}
