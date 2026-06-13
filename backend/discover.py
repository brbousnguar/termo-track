"""
Run this to see every BLE device nearby and their raw advertisement data.
This helps identify what name/data your ThermoPro broadcasts.

    python discover.py
"""
import asyncio
from bleak import BleakScanner
from bleak.backends.device import BLEDevice
from bleak.backends.scanner import AdvertisementData

THERMOPRO_NAMES = ("TP350S", "TP350", "TP357", "TP358", "TP359", "TP393", "TP97", "TP960")

seen: set[str] = set()

def on_adv(device: BLEDevice, adv: AdvertisementData):
    key = device.address
    if key in seen:
        return
    seen.add(key)

    name = device.name or adv.local_name or "(no name)"
    mfr = {f"0x{k:04X}": v.hex() for k, v in adv.manufacturer_data.items()}
    services = list(adv.service_uuids)
    is_thermopro = any(p in name.upper() for p in THERMOPRO_NAMES)

    sep = "═" * 60 if is_thermopro else "─" * 60
    tag = "  *** ThermoPro ***" if is_thermopro else ""
    print(f"\n{sep}{tag}")
    print(f"  Name    : {name}")
    print(f"  Address : {device.address}")
    print(f"  RSSI    : {adv.rssi} dBm")
    if mfr:
        print(f"  Mfr data: {mfr}")
    if services:
        print(f"  Services: {services[:3]}")

async def main():
    print("Scanning for 30 seconds — force-close ThermoPro app on iPhone first!\n")
    scanner = BleakScanner(detection_callback=on_adv)
    await scanner.start()
    await asyncio.sleep(30)
    await scanner.stop()
    print(f"\n{'─'*60}")
    print(f"Done. Found {len(seen)} device(s).")

asyncio.run(main())
