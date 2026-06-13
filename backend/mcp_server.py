"""
MCP server for termo-track.

Exposes sensor history to Claude so you can ask questions like:
  "What was the temperature at noon?"
  "Is it getting hotter or cooler today?"
  "What's the comfort level right now?"

Run via: python mcp_server.py
Configure in ~/.claude/claude_desktop_config.json or .claude/mcp.json.
"""

import asyncio
import sys
from pathlib import Path

# Ensure database module is importable from any working directory
sys.path.insert(0, str(Path(__file__).parent))

from mcp.server.fastmcp import FastMCP

from database import get_history, get_latest, get_stats, init_db

mcp = FastMCP("termo-track")


def _comfort_label(temp: float, humidity: float) -> str:
    if humidity < 30:
        return "dry"
    if humidity > 70:
        return "humid"
    if temp < 18:
        return "cold"
    if temp > 28:
        return "warm"
    return "comfortable"


@mcp.tool()
async def get_current_reading() -> dict:
    """Get the latest temperature and humidity reading from the ThermoPro sensor."""
    await init_db()
    row = await get_latest()
    if not row:
        return {"error": "No readings available yet. Make sure the backend server is running."}
    row["comfort"] = _comfort_label(row["temperature"], row["humidity"])
    return row


@mcp.tool()
async def get_sensor_history(hours: int = 24) -> dict:
    """
    Get historical temperature and humidity readings.

    Args:
        hours: How many hours of history to return (default 24, max 168).
    """
    hours = min(hours, 168)
    await init_db()
    rows = await get_history(hours)
    return {"readings": rows, "count": len(rows), "hours": hours}


@mcp.tool()
async def get_sensor_stats(hours: int = 24) -> dict:
    """
    Get min / max / average temperature and humidity over the last N hours.

    Args:
        hours: Time window in hours (default 24).
    """
    await init_db()
    s = await get_stats(hours)
    if not s:
        return {"error": "No data for the requested period."}
    return s


@mcp.tool()
async def get_comfort_level() -> dict:
    """Assess current comfort level based on temperature and humidity."""
    await init_db()
    row = await get_latest()
    if not row:
        return {"error": "No data available."}
    label = _comfort_label(row["temperature"], row["humidity"])
    tips = {
        "dry": "Humidity is low — consider using a humidifier.",
        "humid": "Humidity is high — open windows or run a dehumidifier.",
        "cold": "Temperature is below 18 °C — you may want to heat the room.",
        "warm": "Temperature is above 28 °C — consider cooling or ventilation.",
        "comfortable": "Temperature and humidity are in the comfort zone.",
    }
    return {
        "comfort": label,
        "tip": tips[label],
        "temperature": row["temperature"],
        "humidity": row["humidity"],
        "timestamp": row["timestamp"],
    }


if __name__ == "__main__":
    mcp.run()
