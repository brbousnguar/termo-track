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
  mcp_server.py       # MCP server (FastMCP): exposes sensor data to Claude/apps
  database.py         # SQLite access (DB path overridable via DB_PATH)
  start_server.sh     # starts the API server
  Dockerfile          # backend image (FastAPI + uvicorn)
  Dockerfile.mcp      # MCP image (FastMCP over HTTP)
frontend/
  src/                # React + Vite dashboard
  Dockerfile          # builds the app, serves it via nginx
  nginx.conf          # nginx config: serves the SPA, proxies /api + /ws
docker-compose.yml    # runs backend + frontend + mcp (scanner stays on the host)
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
| `mcp`      | python:3.12-slim  | **8675**  | MCP over HTTP at `/mcp`; DB mounted read-only |
| scanner    | host process      | —          | BLE → SQLite; needs native Bluetooth     |

> The UI port is set in `docker-compose.yml` (`8088:80`) — change the left-hand
> number if `8088` is taken on your machine.

## MCP — expose sensor data to Claude & other apps

`backend/mcp_server.py` (built on [FastMCP](https://github.com/modelcontextprotocol/python-sdk))
serves the sensor data over the **Model Context Protocol**, so Claude (Desktop /
Code) and any other MCP client can query your room conditions in natural language:

| Tool                  | What it returns                                        |
| --------------------- | ------------------------------------------------------ |
| `get_current_reading` | latest temperature + humidity + a comfort label        |
| `get_sensor_history`  | readings over the last *N* hours (default 24, max 168) |
| `get_sensor_stats`    | min / max / avg temperature & humidity over *N* hours  |
| `get_comfort_level`   | comfort assessment + a tip (heat / cool / humidify …)  |

It reads the same `data/readings.db` the scanner writes — it has **no dependency
on the FastAPI server**. Transport is chosen via env vars:

| Env var         | Default     | Purpose                                        |
| --------------- | ----------- | ---------------------------------------------- |
| `MCP_TRANSPORT` | `stdio`     | `stdio` (local clients) or `streamable-http`   |
| `MCP_HOST`      | `127.0.0.1` | bind address for HTTP mode                     |
| `MCP_PORT`      | `8675`      | port for HTTP mode (endpoint at `/mcp`)        |
| `DB_PATH`       | —           | path to the shared SQLite DB                   |

### Local (same machine) — stdio

The simplest, most secure option when the client runs on the same Mac as the DB:
the client spawns `mcp_server.py` directly over stdio. No container or network
needed.

**Claude Code** (available in every project — registers a user-scope server):

```bash
claude mcp add termo-track -s user \
  -e DB_PATH=/abs/path/to/termo-track/data/readings.db \
  -- /abs/path/to/termo-track/backend/.venv/bin/python \
     /abs/path/to/termo-track/backend/mcp_server.py
```

**Claude Desktop** — add to
`~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "termo-track": {
      "command": "/abs/path/to/termo-track/backend/.venv/bin/python",
      "args": ["/abs/path/to/termo-track/backend/mcp_server.py"],
      "env": { "DB_PATH": "/abs/path/to/termo-track/data/readings.db" }
    }
  }
}
```

Use absolute paths and the venv's Python (Claude Desktop spawns with a minimal
environment). Fully quit and reopen Claude Desktop (⌘Q) after editing.

### LAN / remote — HTTP

To reach the sensor from **another machine on your network** (or any HTTP MCP
client), run the `mcp` container (started by `docker compose up`). It serves
streamable-HTTP at `http://<host>:8675/mcp`, reading the DB read-only.

Find the host's LAN address (`ipconfig getifaddr en0`) and point clients at it.
Many Claude Desktop builds only accept `command`-based servers in their config,
so bridge stdio→HTTP with [`mcp-remote`](https://www.npmjs.com/package/mcp-remote)
(needs Node on the client machine):

```json
{
  "mcpServers": {
    "termo-track": {
      "command": "/Users/you/.nvm/versions/node/v24.11.0/bin/npx",
      "args": [
        "-y",
        "mcp-remote",
        "http://192.168.1.95:8675/mcp",
        "--allow-http"
      ],
      "env": {
        "PATH": "/Users/you/.nvm/versions/node/v24.11.0/bin:/usr/local/bin:/usr/bin:/bin"
      }
    }
  }
}
```

> **Gotchas that bite on a real setup:**
> - `--allow-http` is **required** — `mcp-remote` refuses plain `http://` URLs
>   without it (it assumes HTTPS otherwise).
> - Use the **absolute path to `npx`** as `command` and set `PATH` to include
>   your Node `bin` — Claude Desktop's minimal environment usually can't find an
>   nvm-managed `npx` otherwise.
> - The host (where the container runs) must be **awake with Docker running**,
>   and its **firewall** must allow incoming connections on `8675`.

> ⚠️ The HTTP endpoint is **unauthenticated** and bound to all interfaces. That's
> fine on a trusted home LAN — do **not** port-forward `8675` to the internet.
> For access beyond the LAN, put it on a private network (e.g. Tailscale) and
> point clients at that address instead.

## Useful scripts

- `python backend/discover.py` — list nearby BLE devices and their raw
  advertisement data (handy for identifying your sensor).
