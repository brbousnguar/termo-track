#!/bin/bash
# Kill any existing instance on port 8765, then start fresh
lsof -ti:8765 | xargs kill -9 2>/dev/null
cd "$(dirname "$0")"
.venv/bin/python server.py
