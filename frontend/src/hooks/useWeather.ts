import { useCallback, useEffect, useState } from "react";

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

// Open-Meteo is free and needs no API key; BigDataCloud gives a best-effort
// city name for the resolved coordinates (also keyless). Refresh every 10 min.
const REFRESH_MS = 10 * 60 * 1000;

async function reverseGeocode(lat: number, lon: number): Promise<string | undefined> {
  try {
    const r = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
    );
    const j = await r.json();
    return j.city || j.locality || j.principalSubdivision || undefined;
  } catch {
    return undefined;
  }
}

export function useWeather(): WeatherState {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [status, setStatus] = useState<WeatherStatus>("locating");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setStatus("error");
      setError("Geolocation isn't supported by this browser.");
      return;
    }
    setStatus("locating");
    setError(null);

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords;
        setStatus("loading");
        try {
          const r = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}` +
              `&current=temperature_2m,relative_humidity_2m`
          );
          if (!r.ok) throw new Error(`weather ${r.status}`);
          const j = await r.json();
          const cur = j.current;
          if (!cur || typeof cur.temperature_2m !== "number") {
            throw new Error("malformed weather response");
          }
          const locationName = await reverseGeocode(latitude, longitude);
          setWeather({
            temperature: cur.temperature_2m,
            humidity: cur.relative_humidity_2m,
            locationName,
          });
          setStatus("ready");
        } catch {
          setStatus("error");
          setError("Couldn't fetch outside weather. Try again.");
        }
      },
      (err) => {
        setStatus("error");
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Location access denied — enable it to compare with outside."
            : "Couldn't determine your location."
        );
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60 * 1000 }
    );
  }, []);

  useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  return { weather, status, error, retry: load };
}
