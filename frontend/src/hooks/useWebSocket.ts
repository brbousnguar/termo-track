import { useEffect, useRef, useState } from "react";

export interface LiveReading {
  temperature: number;
  humidity: number;
  battery?: number;
  device?: string;
  timestamp?: string;
}

export function useWebSocket(url: string) {
  const [reading, setReading] = useState<LiveReading | null>(null);
  const [connected, setConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function connect() {
      const socket = new WebSocket(url);
      ws.current = socket;

      socket.onopen = () => setConnected(true);

      socket.onmessage = (e) => {
        try {
          const msg = JSON.parse(e.data);
          if (msg.type === "reading" || msg.temperature !== undefined) {
            setReading({
              temperature: msg.temperature,
              humidity: msg.humidity,
              battery: msg.battery,
              device: msg.device ?? msg.device_name,
              timestamp: msg.timestamp,
            });
          }
        } catch {}
      };

      socket.onclose = () => {
        setConnected(false);
        retry.current = setTimeout(connect, 3000);
      };

      socket.onerror = () => socket.close();
    }

    connect();
    return () => {
      ws.current?.close();
      if (retry.current) clearTimeout(retry.current);
    };
  }, [url]);

  return { reading, connected };
}
