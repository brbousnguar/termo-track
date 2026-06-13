import { useCallback, useEffect, useState } from "react";

export interface Coords {
  latitude: number;
  longitude: number;
}

export type GeoStatus = "locating" | "ready" | "error";

interface GeolocationState {
  coords: Coords | null;
  status: GeoStatus;
  error: string | null;
  retry: () => void;
}

// Shared browser-geolocation hook. The browser only prompts once per origin, so
// multiple consumers (weather card, trend chart) can each call this safely; the
// cached position (maximumAge) is reused.
export function useGeolocation(): GeolocationState {
  const [coords, setCoords] = useState<Coords | null>(null);
  const [status, setStatus] = useState<GeoStatus>("locating");
  const [error, setError] = useState<string | null>(null);

  const locate = useCallback(() => {
    if (!("geolocation" in navigator)) {
      setStatus("error");
      setError("Geolocation isn't supported by this browser.");
      return;
    }
    setStatus("locating");
    setError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setStatus("ready");
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
    locate();
  }, [locate]);

  return { coords, status, error, retry: locate };
}
