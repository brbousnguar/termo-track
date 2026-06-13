"""
FastAPI server — HTTP REST + WebSocket live feed.

Run the BLE scanner separately:  python scanner_daemon.py
Then start this server:           python server.py

The two processes share a SQLite database.
The server polls for new readings and pushes them to WebSocket clients.
"""

import asyncio
import json
import logging
from contextlib import asynccontextmanager

import uvicorn
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

from database import get_history, get_latest, get_stats, init_db

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

_connections: set[WebSocket] = set()
_last_broadcast_id: int | None = None


async def _broadcast(payload: dict) -> None:
    dead = set()
    for ws in _connections:
        try:
            await ws.send_text(json.dumps(payload))
        except Exception:
            dead.add(ws)
    _connections.difference_update(dead)


async def _poll_db() -> None:
    """Poll DB every 5 s; broadcast any reading newer than the last one we sent."""
    global _last_broadcast_id
    while True:
        await asyncio.sleep(5)
        try:
            row = await get_latest()
            if row and row["id"] != _last_broadcast_id:
                _last_broadcast_id = row["id"]
                await _broadcast({"type": "reading", **row})
        except Exception as exc:
            logger.debug("Poll error: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    task = asyncio.create_task(_poll_db())
    logger.info("Server ready. Start scanner_daemon.py separately for live BLE data.")
    try:
        yield
    finally:
        task.cancel()


app = FastAPI(title="termo-track", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/api/current")
async def current():
    row = await get_latest()
    if row is None:
        return {"status": "no_data"}
    return {"status": "ok", "data": row}


@app.get("/api/history")
async def history(hours: int = 24):
    rows = await get_history(hours)
    return {"status": "ok", "data": rows, "count": len(rows)}


@app.get("/api/stats")
async def stats(hours: int = 24):
    s = await get_stats(hours)
    if s is None:
        return {"status": "no_data"}
    return {"status": "ok", "data": s}


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    _connections.add(ws)
    latest = await get_latest()
    if latest:
        await ws.send_text(json.dumps({"type": "reading", **latest}))
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        _connections.discard(ws)


if __name__ == "__main__":
    uvicorn.run("server:app", host="127.0.0.1", port=8765, reload=False)
