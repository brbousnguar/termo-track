import { useEffect, useState } from "react";
import { useGeolocation, type GeoStatus } from "./useGeolocation";

interface OutsideHistoryState {
  // Map of UTC hour (epoch ms, floored to the hour) -> outside temperature °C
  outsideByHour: Map<number, number>;
  geoStatus: GeoStatus;
  geoError: string | null;
  retry: () => void;
}

// Open-Meteo hourly forecast covers recent past via `past_days` (+ today via
// `forecast_days`). `timeformat=unixtime` returns absolute timestamps so they
// align cleanly with the indoor readings without timezone juggling.
export function useOutsideHistory(hours: number, refreshTick: number): OutsideHistoryState {
  const geo = useGeolocation();
  const [outsideByHour, setOutsideByHour] = useState<Map<number, number>>(new Map());

  useEffect(() => {
    if (geo.status !== "ready" || !geo.coords) return;
    const { latitude, longitude } = geo.coords;
    const pastDays = Math.min(92, Math.ceil(hours / 24) + 1);
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
      `&hourly=temperature_2m&timeformat=unixtime&past_days=${pastDays}&forecast_days=1`;

    let cancelled = false;
    fetch(url)
      .then((r) => r.json())
      .then((j) => {
        if (cancelled || !j.hourly?.time) return;
        const times: number[] = j.hourly.time; // unix seconds, on the hour
        const temps: number[] = j.hourly.temperature_2m;
        const m = new Map<number, number>();
        for (let i = 0; i < times.length; i++) {
          if (typeof temps[i] === "number") m.set(times[i] * 1000, temps[i]);
        }
        setOutsideByHour(m);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [geo.status, geo.coords, hours, refreshTick]);

  return { outsideByHour, geoStatus: geo.status, geoError: geo.error, retry: geo.retry };
}
