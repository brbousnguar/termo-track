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

const NANTES: Coords = { latitude: 47.2184, longitude: -1.5536 };

export function useGeolocation(): GeolocationState {
  return { coords: NANTES, status: "ready", error: null, retry: () => {} };
}
