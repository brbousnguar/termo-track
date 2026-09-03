import { useCallback, useEffect, useRef, useState } from "react";

export interface LiveReading {
  temperature: number;
  humidity: number;
  battery?: number;
  device?: string;
  timestamp?: string;
}

function parseReading(msg: any): LiveReading | null {
  if (msg && (msg.type === "reading" || typeof msg.temperature === "number")) {
    return {
      temperature: msg.temperature,
      humidity: msg.humidity,
      battery: msg.battery,
      device: msg.device ?? msg.device_name,
      timestamp: msg.timestamp,
    };
  }
  return null;
}

export function useWebSocket(url: string, refreshTick = 0) {
  const [reading, setReading] = useState<LiveReading | null>(null);
  const [connected, setConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);
  const retry = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMounted = useRef(true);

  const updateReading = useCallback((incoming: LiveReading) => {
    if (!isMounted.current) return;
    setReading((prev) => {
      if (!prev || !prev.timestamp || !incoming.timestamp) {
        return incoming;
      }
      const prevTime = new Date(prev.timestamp).getTime();
      const incomingTime = new Date(incoming.timestamp).getTime();
      return incomingTime >= prevTime ? incoming : prev;
    });
  }, []);

  const fetchCurrent = useCallback(async () => {
    try {
      const res = await fetch("/api/current");
      if (!res.ok) return;
      const json = await res.json();
      if (json.status === "ok" && json.data) {
        const parsed = parseReading(json.data);
        if (parsed) {
          updateReading(parsed);
        }
      }
    } catch {
      // Ignore fetch error; WS or retry will handle connection
    }
  }, [updateReading]);

  const disconnectSocket = useCallback(() => {
    if (retry.current) {
      clearTimeout(retry.current);
      retry.current = null;
    }
    if (ws.current) {
      const socket = ws.current;
      ws.current = null;
      socket.onopen = null;
      socket.onmessage = null;
      socket.onclose = null;
      socket.onerror = null;
      socket.close();
    }
  }, []);

  const connect = useCallback(() => {
    disconnectSocket();
    if (!isMounted.current) return;

    const socket = new WebSocket(url);
    ws.current = socket;

    socket.onopen = () => {
      if (isMounted.current) {
        setConnected(true);
      }
    };

    socket.onmessage = (e) => {
      if (!isMounted.current) return;
      try {
        const msg = JSON.parse(e.data);
        const parsed = parseReading(msg);
        if (parsed) {
          updateReading(parsed);
        }
      } catch {}
    };

    socket.onclose = () => {
      if (!isMounted.current) return;
      setConnected(false);
      if (!retry.current) {
        retry.current = setTimeout(() => {
          retry.current = null;
          connect();
        }, 3000);
      }
    };

    socket.onerror = () => {
      socket.close();
    };
  }, [url, disconnectSocket, updateReading]);

  useEffect(() => {
    isMounted.current = true;
    fetchCurrent();
    connect();

    return () => {
      isMounted.current = false;
      disconnectSocket();
    };
  }, [url, refreshTick, fetchCurrent, connect, disconnectSocket]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchCurrent();
        connect();
      }
    };

    const handleOnline = () => {
      fetchCurrent();
      connect();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
    };
  }, [fetchCurrent, connect]);

  return { reading, connected };
}

