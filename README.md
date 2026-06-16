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
  database.py         # SQLite access (DB path overridable via DB_PATH)
  start_server.sh     # starts the API server
  Dockerfile          # backend image (FastAPI + uvicorn)
frontend/
  src/                # React + Vite dashboard
  Dockerfile          # builds the app, serves it via nginx
  nginx.conf          # nginx config: serves the SPA, proxies /api + /ws
docker-compose.yml    # runs backend + frontend (scanner stays on the host)
```

## Requirements

- Python 3.11+
- Node 18+
- A ThermoPro sensor (TP357 / TP358 / TP359 / TP350S / …)
- **macOS:** grant Bluetooth access to your terminal/IDE in
  *System Settings → Privacy & Security → Bluetooth*.
- Docker + Docker Compose — optional, for the [containerized setup](#run-with-docker-compose).

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

The scanner and the API server are **independent processes** — start each in
its own terminal.

```bash
# 1. Scanner — listens for BLE broadcasts and writes them to the DB
cd backend
.venv/bin/python scanner_daemon.py

# 2. API server — REST + WebSocket on port 8765 (second terminal)
cd backend
./start_server.sh

# 3. Frontend — dev server on http://localhost:5173 (proxies /api and /ws to 8765)
cd frontend
npm run dev
```

Open <http://localhost:5173>. Allow location access when prompted to enable the
indoor-vs-outdoor comparison.

> **Tip:** if the dashboard shows a "data may be stale" warning, the scanner
> isn't running. Start it with `python scanner_daemon.py` — it's separate from
> the API server.

## Run with Docker Compose

The two network services (FastAPI backend + nginx-served frontend) are
containerized. The BLE **scanner is not**: Docker Desktop on macOS has no access
to the host Bluetooth adapter, so the scanner runs on the host. All three share
the SQLite DB at `./data/readings.db` (bind-mounted into the backend container).

```bash
# Build and start backend + frontend
docker compose up --build -d          # UI on http://localhost:8088

# Run the scanner on the host (needs Bluetooth), writing to the shared DB
cd backend
DB_PATH="$(pwd)/../data/readings.db" .venv/bin/python scanner_daemon.py

# Stop the stack
docker compose down
```

| Service    | Runs as           | Host port  | Notes                                    |
| ---------- | ----------------- | ---------- | ---------------------------------------- |
| `frontend` | nginx + Vite build | **8088**  | serves the SPA, proxies `/api` + `/ws`   |
| `backend`  | python:3.12-slim  | (internal) | FastAPI/uvicorn, DB path from `DB_PATH`  |
| scanner    | host process      | —          | BLE → SQLite; needs native Bluetooth     |

> The UI port is set in `docker-compose.yml` (`8088:80`) — change the left-hand
> number if `8088` is taken on your machine.

## Useful scripts

- `python backend/discover.py` — list nearby BLE devices and their raw
  advertisement data (handy for identifying your sensor).
