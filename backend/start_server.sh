#!/bin/bash
# Start both the BLE scanner daemon and the API server.
#
# The scanner (scanner_daemon.py) reads live data from the ThermoPro device and
# writes it to the shared SQLite DB; the API server (server.py) serves that data
# to the frontend. Without the scanner running, the dashboard only ever shows the
# last reading collected, which is why "live" values can drift from the device.
cd "$(dirname "$0")"

# Kill any existing instances, then start fresh
lsof -ti:8765 | xargs kill -9 2>/dev/null
pkill -f scanner_daemon.py 2>/dev/null

# Start the BLE scanner in the background; stop it when this script exits.
.venv/bin/python scanner_daemon.py &
SCANNER_PID=$!
trap 'kill $SCANNER_PID 2>/dev/null' EXIT

# Run the API server in the foreground.
.venv/bin/python server.py
