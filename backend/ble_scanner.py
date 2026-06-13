"""
ThermoPro BLE scanner.

ThermoPro TP-357/TP-358/TP-359 devices broadcast temperature and humidity
in BLE advertisement manufacturer-specific data (no pairing needed).

Packet layout (after 2-byte company-ID prefix):
  [0:2] int16 little-endian  — temperature × 10  (e.g. 279 → 27.9 °C)
  [2]   uint8                — humidity %
  [3]   uint8  (optional)    — battery %

On macOS, Bluetooth permission must be granted to Terminal / your IDE.
Go to System Settings → Privacy & Security → Bluetooth and add Terminal.
"""

import asyncio
import logging
import struct
from dataclasses import dataclass

from bleak import BleakScanner
from bleak.backends.device import BLEDevice
from bleak.backends.scanner import AdvertisementData

logger = logging.getLogger(__name__)

# Device local-name substrings that identify ThermoPro sensors
THERMOPRO_NAMES = ("TP350S", "TP350", "TP357", "TP358", "TP359", "TP393", "TP97", "TP960")

# Known ThermoPro company IDs (TP357/TP358/TP359 style)
THERMOPRO_COMPANY_IDS = {0xEC88, 0x0D00, 0xFFFF}

# TP350S uses low byte 0xC2 as a fixed device marker; the high byte carries
# temperature in integer Celsius and payload[1] carries humidity.
TP350S_COMPANY_LOW_BYTE = 0xC2


@dataclass
class SensorReading:
    temperature: float
    humidity: float
    battery: int | None
    device_name: str
    device_address: str


def _decode_payload(payload: bytes) -> tuple[float, float, int | None] | None:
    """Decode temp / humidity / battery from a raw payload (company ID already stripped)."""
    if len(payload) < 3:
        return None
    try:
        temp_raw, humidity = struct.unpack_from("<hB", payload, 0)
        temperature = temp_raw / 10.0
        battery = payload[3] if len(payload) > 3 else None
        if -40 <= temperature <= 85 and 0 <= humidity <= 100:
            return temperature, humidity, battery
    except struct.error:
        pass
    return None


def _decode_tp350s(company_id: int, payload: bytes) -> tuple[float, float, int | None] | None:
    """TP350S / TP35X advertisement format (source: thermopro-ble / Home Assistant).

    On Linux/BlueZ the raw manufacturer bytes are a flat 7-byte array:
      [0xC2]  [temp_lo]  [temp_hi]  [humidity]  [battery]  ...

    On macOS CoreBluetooth, bleak splits the first two bytes into the company_id
    (uint16 LE), so they arrive as:
      company_id = 0xC2 | (temp_lo << 8)   →  low byte = 0xC2 (fixed marker)
      payload    = [temp_hi, humidity, battery, ...]

    Temperature is a signed int16 LE reassembled from both halves.
    """
    if (company_id & 0xFF) != TP350S_COMPANY_LOW_BYTE or len(payload) < 2:
        return None
    temp_lo = company_id >> 8
    temp_hi = payload[0]
    (temp_raw,) = struct.unpack_from("<h", bytes([temp_lo, temp_hi]))
    temperature = temp_raw / 10.0
    humidity = float(payload[1])
    battery = payload[2] if len(payload) > 2 else None
    if -40 <= temperature <= 85 and 0 <= humidity <= 100:
        return temperature, humidity, battery
    return None


def _try_decode(mfr_data: dict[int, bytes]) -> tuple[float, float, int | None] | None:
    for company_id, payload in mfr_data.items():
        if (company_id & 0xFF) == TP350S_COMPANY_LOW_BYTE:
            result = _decode_tp350s(company_id, payload)
            if result:
                return result
        elif company_id in THERMOPRO_COMPANY_IDS:
            result = _decode_payload(payload)
            if result:
                return result
    # Fallback: try every manufacturer entry
    for company_id, payload in mfr_data.items():
        result = _decode_payload(payload)
        if result:
            logger.debug("Decoded via fallback (company_id=0x%04X)", company_id)
            return result
    return None


def _is_thermopro(device: BLEDevice, adv: AdvertisementData) -> bool:
    name = (device.name or adv.local_name or "").upper()
    return any(p in name for p in THERMOPRO_NAMES)


class ThermoproScanner:
    def __init__(self, on_reading, scan_interval: float = 30.0):
        """
        on_reading: async callable(SensorReading) called each time we get a fresh decode.
        scan_interval: minimum seconds between stored readings for the same device.
        """
        self._on_reading = on_reading
        self._scan_interval = scan_interval
        self._last_seen: dict[str, float] = {}
        self._running = False

    async def run(self) -> None:
        self._running = True
        logger.info("Starting BLE scan for ThermoPro devices …")
        scanner = BleakScanner(detection_callback=self._on_advertisement)
        await scanner.start()
        try:
            while self._running:
                await asyncio.sleep(1)
        finally:
            await scanner.stop()

    def stop(self) -> None:
        self._running = False

    def _on_advertisement(self, device: BLEDevice, adv: AdvertisementData) -> None:
        if not _is_thermopro(device, adv):
            return
        if not adv.manufacturer_data:
            return

        raw_hex = {f"0x{k:04X}": v.hex() for k, v in adv.manufacturer_data.items()}
        result = _try_decode(adv.manufacturer_data)
        if result is None:
            logger.debug(
                "Found ThermoPro device %s but could not decode: %s",
                device.name,
                raw_hex,
            )
            return

        temperature, humidity, battery = result
        addr = device.address
        now = asyncio.get_event_loop().time()

        if now - self._last_seen.get(addr, 0) < self._scan_interval:
            return

        self._last_seen[addr] = now
        reading = SensorReading(
            temperature=temperature,
            humidity=humidity,
            battery=battery,
            device_name=device.name or adv.local_name or "ThermoPro",
            device_address=addr,
        )
        logger.info(
            "Reading: %.1f°C  %d%%  (battery=%s)  from %s  [raw: %s]",
            temperature,
            humidity,
            f"{battery}%" if battery is not None else "?",
            reading.device_name,
            raw_hex,
        )
        asyncio.ensure_future(self._on_reading(reading))
