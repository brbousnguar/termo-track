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


async def on_reading(reading):
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


async def main():
    await init_db()
    scanner = ThermoproScanner(on_reading=on_reading, scan_interval=30)
    try:
        await scanner.run()
    except KeyboardInterrupt:
        logger.info("Stopped.")


if __name__ == "__main__":
    asyncio.run(main())
