import { useCallback, useEffect, useState } from "react";
import { useGeolocation } from "./useGeolocation";

export interface Weather {
  temperature: number;
  humidity: number;
  locationName?: string;
}

export type WeatherStatus = "locating" | "loading" | "ready" | "error";

interface WeatherState {
  weather: Weather | null;
  status: WeatherStatus;
  error: string | null;
  retry: () => void;
}

const REFRESH_MS = 10 * 60 * 1000;

export function useWeather(): WeatherState {
  const geo = useGeolocation();
  const [weather, setWeather] = useState<Weather | null>(null);
  const [fetchState, setFetchState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchWeather = useCallback(async (lat: number, lon: number) => {
    setFetchState("loading");
    setFetchError(null);
    try {
      const r = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
          `&current=temperature_2m,relative_humidity_2m`
      );
      if (!r.ok) throw new Error(`weather ${r.status}`);
      const j = await r.json();
      const cur = j.current;
      if (!cur || typeof cur.temperature_2m !== "number") {
        throw new Error("malformed weather response");
      }
      setWeather({
        temperature: cur.temperature_2m,
        humidity: cur.relative_humidity_2m,
        locationName: "Nantes",
      });
      setFetchState("ready");
    } catch {
      setFetchState("error");
      setFetchError("Couldn't fetch outside weather. Try again.");
    }
  }, []);

  useEffect(() => {
    if (geo.status !== "ready" || !geo.coords) return;
    const { latitude, longitude } = geo.coords;
    fetchWeather(latitude, longitude);
    const id = setInterval(() => fetchWeather(latitude, longitude), REFRESH_MS);
    return () => clearInterval(id);
  }, [geo.status, geo.coords, fetchWeather]);

  const status: WeatherStatus =
    geo.status === "locating"
      ? "locating"
      : geo.status === "error"
        ? "error"
        : fetchState === "ready"
          ? "ready"
          : fetchState === "error"
            ? "error"
            : "loading";

  return { weather, status, error: geo.error ?? fetchError, retry: geo.retry };
}
