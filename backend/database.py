import aiosqlite
import asyncio
import os
from datetime import datetime, timezone
from pathlib import Path

# DB location is overridable via DB_PATH so the scanner (host) and server
# (container) can point at the same shared SQLite file.
DB_PATH = Path(os.getenv("DB_PATH", Path(__file__).parent / "readings.db"))

CREATE_TABLE = """
CREATE TABLE IF NOT EXISTS readings (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT    NOT NULL,
    temperature REAL  NOT NULL,
    humidity    REAL  NOT NULL,
    device_name TEXT,
    device_address TEXT
);
CREATE INDEX IF NOT EXISTS idx_ts ON readings(timestamp);
"""


async def init_db() -> None:
    async with aiosqlite.connect(DB_PATH) as db:
        await db.executescript(CREATE_TABLE)
        await db.commit()


async def insert_reading(
    temperature: float,
    humidity: float,
    device_name: str | None = None,
    device_address: str | None = None,
) -> None:
    ts = datetime.now(timezone.utc).isoformat()
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO readings (timestamp, temperature, humidity, device_name, device_address)"
            " VALUES (?, ?, ?, ?, ?)",
            (ts, temperature, humidity, device_name, device_address),
        )
        await db.commit()


async def get_latest() -> dict | None:
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            "SELECT * FROM readings ORDER BY timestamp DESC LIMIT 1"
        ) as cur:
            row = await cur.fetchone()
            return dict(row) if row else None


async def get_history(hours: int = 24) -> list[dict]:
    since = f"datetime('now', '-{hours} hours')"
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            f"SELECT * FROM readings WHERE timestamp >= {since} ORDER BY timestamp ASC"
        ) as cur:
            rows = await cur.fetchall()
            return [dict(r) for r in rows]


async def get_stats(hours: int = 24) -> dict | None:
    since = f"datetime('now', '-{hours} hours')"
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        async with db.execute(
            f"""
            SELECT
                MIN(temperature) as temp_min,
                MAX(temperature) as temp_max,
                AVG(temperature) as temp_avg,
                MIN(humidity)    as hum_min,
                MAX(humidity)    as hum_max,
                AVG(humidity)    as hum_avg,
                COUNT(*)         as count
            FROM readings WHERE timestamp >= {since}
            """
        ) as cur:
            row = await cur.fetchone()
            if row and row["count"]:
                return {k: round(v, 1) if isinstance(v, float) else v for k, v in dict(row).items()}
            return None
