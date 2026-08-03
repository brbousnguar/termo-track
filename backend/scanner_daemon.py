"""
BLE scanner daemon — run this in a separate terminal.

    python scanner_daemon.py

It scans for ThermoPro devices and writes readings to the shared SQLite DB.
The API server reads from the same DB, so the two processes are independent.

macOS requirement: grant Bluetooth access to Terminal (or your IDE) in
System Settings → Privacy & Security → Bluetooth, then re-run this script.
"""

import asyncio
import logging
import sys
import time
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from ble_scanner import ThermoproScanner
from database import init_db, insert_reading

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(message)s",
    handlers=[logging.StreamHandler()],
)
logger = logging.getLogger(__name__)

WATCHDOG_TIMEOUT = 300       # seconds — restart BLE scan if silent for this long
WATCHDOG_CHECK_INTERVAL = 60 # how often the watchdog polls

last_reading_at: float = 0.0


async def on_reading(reading):
    global last_reading_at
    last_reading_at = time.monotonic()
    await insert_reading(
        temperature=reading.temperature,
        humidity=reading.humidity,
        device_name=reading.device_name,
        device_address=reading.device_address,
    )
    logger.info(
        "Saved → %.1f°C  %d%%  %s",
        reading.temperature,
        reading.humidity,
        reading.device_name,
    )


async def _watchdog(scanner: ThermoproScanner) -> None:
    while True:
        await asyncio.sleep(WATCHDOG_CHECK_INTERVAL)
        elapsed = time.monotonic() - last_reading_at
        if elapsed >= WATCHDOG_TIMEOUT:
            logger.warning(
                "Watchdog: no reading for %.0f s — restarting BLE scan", elapsed
            )
            scanner.stop()
            return


async def _run_scanner() -> None:
    global last_reading_at
    last_reading_at = time.monotonic()
    scanner = ThermoproScanner(on_reading=on_reading, scan_interval=30)
    watchdog_task = asyncio.create_task(_watchdog(scanner))
    try:
        await scanner.run()
    finally:
        watchdog_task.cancel()
        try:
            await watchdog_task
        except asyncio.CancelledError:
            pass


async def main():
    await init_db()
    while True:
        await _run_scanner()
        logger.info("Restarting BLE scanner in 2 s …")
        await asyncio.sleep(2)


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        logger.info("Stopped.")
