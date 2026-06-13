# Termo Track

Track temperature and humidity from a **ThermoPro** Bluetooth sensor and compare
your room against the live outside weather — all in a clean local dashboard.

No pairing, no cloud account, no API keys. The sensor broadcasts its readings
over BLE advertisements; a small daemon listens, stores them in SQLite, and a
FastAPI server streams them to a React dashboard.

## Features

- **Live readings** — temperature & humidity pushed to the browser over WebSocket.
- **Stale-data detection** — the dashboard warns when readings stop arriving
  (e.g. the scanner died) instead of silently showing old values.
- **Indoor vs Outdoor** — uses your browser geolocation + [Open-Meteo](https://open-meteo.com)
  (free, keyless) to show the temperature/humidity difference between your room
  and outside.
- **History & stats** — min/avg/max over a selectable window, plus a chart.

## Architecture

```
ThermoPro sensor ──BLE adv──▶ scanner_daemon.py ──▶ readings.db (SQLite)
                                                          │
                                          server.py (FastAPI) ──REST + WS──▶ React/Vite dashboard
```

The scanner and API server are independent processes that share the SQLite DB.

```
backend/
  ble_scanner.py      # BLE advertisement decoding (ThermoPro TP35x family)
  scanner_daemon.py   # long-running scanner → writes readings to the DB
  server.py           # FastAPI: REST endpoints + WebSocket live feed
  database.py         # SQLite access
  start_server.sh     # starts BOTH the scanner and the API server
frontend/
  src/                # React + Vite dashboard
```

## Requirements

- Python 3.11+
- Node 18+
- A ThermoPro sensor (TP357 / TP358 / TP359 / TP350S / …)
- **macOS:** grant Bluetooth access to your terminal/IDE in
  *System Settings → Privacy & Security → Bluetooth*.

## Setup

```bash
# Backend
cd backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt

# Frontend
cd ../frontend
npm install
```

## Running

```bash
# 1. Backend — starts the BLE scanner AND the API server (port 8765)
cd backend
./start_server.sh

# 2. Frontend — dev server on http://localhost:5173 (proxies /api and /ws to 8765)
cd frontend
npm run dev
```

Open <http://localhost:5173>. Allow location access when prompted to enable the
indoor-vs-outdoor comparison.

> **Tip:** if the dashboard shows a "data may be stale" warning, the scanner
> isn't running — `start_server.sh` launches it for you, or run
> `python scanner_daemon.py` directly.

## Useful scripts

- `python backend/discover.py` — list nearby BLE devices and their raw
  advertisement data (handy for identifying your sensor).
