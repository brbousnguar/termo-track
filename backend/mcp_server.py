"""
MCP server for termo-track.

Exposes sensor history to Claude so you can ask questions like:
  "What was the temperature at noon?"
  "Is it getting hotter or cooler today?"
  "What's the comfort level right now?"

Transport is selectable via env vars (defaults to stdio for local clients):

  MCP_TRANSPORT=stdio            python mcp_server.py   # Claude Desktop / Claude Code
  MCP_TRANSPORT=streamable-http  python mcp_server.py   # always-on HTTP service

For HTTP, MCP_HOST (default 127.0.0.1) and MCP_PORT (default 8675) control the
bind address; the endpoint is served at http://<host>:<port>/mcp.

Outside weather (for the indoor/outdoor comparison tools) comes from Open-Meteo,
keyless. Location is resolved from LATITUDE / LONGITUDE env vars if set, otherwise
from approximate IP geolocation. LOCATION_NAME overrides the displayed place name.

Configure stdio in ~/.claude/claude_desktop_config.json or a project .mcp.json.
"""

import asyncio
import os
import sys
import time
from pathlib import Path

import httpx

# Ensure database module is importable from any working directory
sys.path.insert(0, str(Path(__file__).parent))

from mcp.server.fastmcp import FastMCP

from database import get_history, get_latest, get_stats, init_db

mcp = FastMCP(
    "termo-track",
    host=os.getenv("MCP_HOST", "127.0.0.1"),
    port=int(os.getenv("MCP_PORT", "8675")),
)


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


# --- Outside weather -------------------------------------------------------
#
# The MCP server runs headless on the host, so (unlike the browser dashboard)
# there's no geolocation API. We resolve a location once from env vars or IP
# geolocation, then poll Open-Meteo. Results are cached so repeated tool calls
# don't hammer the free public APIs.

_WEATHER_TTL = 600  # seconds
_DEFAULT_LATITUDE = 47.2184
_DEFAULT_LONGITUDE = -1.5536
_DEFAULT_LOCATION_NAME = "Nantes"
_weather_cache: dict = {"ts": 0.0, "data": None}
_weather_lock = asyncio.Lock()


def _configured_coords() -> tuple[float, float, str | None] | None:
    lat, lon = os.getenv("LATITUDE"), os.getenv("LONGITUDE")
    if lat and lon:
        try:
            return float(lat), float(lon), os.getenv("LOCATION_NAME")
        except ValueError:
            pass
    return _DEFAULT_LATITUDE, _DEFAULT_LONGITUDE, os.getenv("LOCATION_NAME") or _DEFAULT_LOCATION_NAME


async def _ip_location(client: httpx.AsyncClient) -> tuple[float, float, str | None]:
    """Best-effort approximate location from the host's public IP (keyless)."""
    r = await client.get("https://ipapi.co/json/")
    r.raise_for_status()
    j = r.json()
    return float(j["latitude"]), float(j["longitude"]), j.get("city")


async def _reverse_geocode(client: httpx.AsyncClient, lat: float, lon: float) -> str | None:
    try:
        r = await client.get(
            "https://api.bigdatacloud.net/data/reverse-geocode-client",
            params={"latitude": lat, "longitude": lon, "localityLanguage": "en"},
        )
        j = r.json()
        return j.get("city") or j.get("locality") or j.get("principalSubdivision")
    except Exception:
        return None


async def _fetch_outside_weather() -> dict:
    async with httpx.AsyncClient(timeout=10) as client:
        configured = _configured_coords()
        if configured:
            lat, lon, name = configured
        else:
            lat, lon, name = _DEFAULT_LATITUDE, _DEFAULT_LONGITUDE, _DEFAULT_LOCATION_NAME

        try:
            r = await client.get(
                "https://api.open-meteo.com/v1/forecast",
                params={
                    "latitude": lat,
                    "longitude": lon,
                    "current": "temperature_2m,relative_humidity_2m",
                },
            )
            r.raise_for_status()
            cur = r.json().get("current") or {}
            if not isinstance(cur.get("temperature_2m"), (int, float)):
                return {"error": "Malformed weather response from Open-Meteo."}
        except Exception as exc:
            return {"error": f"Could not fetch outside weather: {exc}"}

        if not name:
            name = await _reverse_geocode(client, lat, lon)

        return {
            "temperature": round(float(cur["temperature_2m"]), 1),
            "humidity": round(float(cur["relative_humidity_2m"]), 0),
            "location": name,
            "latitude": round(lat, 4),
            "longitude": round(lon, 4),
            "source": "open-meteo",
        }


async def _outside_weather() -> dict:
    """Cached outside-weather lookup."""
    now = time.monotonic()
    if _weather_cache["data"] and now - _weather_cache["ts"] < _WEATHER_TTL:
        return _weather_cache["data"]
    async with _weather_lock:
        now = time.monotonic()
        if _weather_cache["data"] and now - _weather_cache["ts"] < _WEATHER_TTL:
            return _weather_cache["data"]
        data = await _fetch_outside_weather()
        if "error" not in data:
            _weather_cache.update(ts=now, data=data)
        return data


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


@mcp.tool()
async def get_outside_weather() -> dict:
    """
    Get the current outside temperature and humidity for the sensor's location.

    Uses Open-Meteo (keyless). Location comes from the LATITUDE/LONGITUDE env
    vars if configured, otherwise approximate IP geolocation. Returns
    temperature (°C), humidity (%), and the resolved place name.
    """
    return await _outside_weather()


@mcp.tool()
async def get_indoor_outdoor_comparison() -> dict:
    """
    Compare the current indoor sensor reading against the outside weather.

    Returns the indoor reading (with comfort label), the outside conditions, and
    the temperature/humidity differences with a short human-readable summary
    (e.g. "3.2 °C warmer and 12% more humid inside than outside").
    """
    await init_db()
    indoor = await get_latest()
    if not indoor:
        return {"error": "No indoor readings available yet."}

    indoor_out = {
        "temperature": indoor["temperature"],
        "humidity": indoor["humidity"],
        "comfort": _comfort_label(indoor["temperature"], indoor["humidity"]),
        "timestamp": indoor["timestamp"],
    }

    outside = await _outside_weather()
    if "error" in outside:
        return {"indoor": indoor_out, "outside_error": outside["error"]}

    temp_diff = round(indoor["temperature"] - outside["temperature"], 1)
    hum_diff = round(indoor["humidity"] - outside["humidity"])

    temp_word = "warmer" if temp_diff > 0 else "cooler" if temp_diff < 0 else "the same temperature"
    hum_word = "more humid" if hum_diff > 0 else "drier" if hum_diff < 0 else "equally humid"
    if temp_diff == 0 and hum_diff == 0:
        summary = "Indoor and outdoor conditions are about the same."
    else:
        parts = []
        if temp_diff != 0:
            parts.append(f"{abs(temp_diff)} °C {temp_word}")
        if hum_diff != 0:
            parts.append(f"{abs(hum_diff)}% {hum_word}")
        summary = f"It's {' and '.join(parts)} inside than outside."

    return {
        "indoor": indoor_out,
        "outside": outside,
        "difference": {
            "temperature_c": temp_diff,
            "humidity_pct": hum_diff,
            "summary": summary,
        },
    }


if __name__ == "__main__":
    transport = os.getenv("MCP_TRANSPORT", "stdio")
    mcp.run(transport=transport)
