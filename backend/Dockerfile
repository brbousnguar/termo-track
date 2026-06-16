FROM python:3.12-slim

WORKDIR /app

# Install only the API server's runtime deps (bleak/BLE is host-only, see compose).
COPY requirements.txt .
RUN pip install --no-cache-dir \
        fastapi>=0.111.0 \
        "uvicorn[standard]>=0.30.0" \
        aiosqlite>=0.20.0

COPY database.py server.py ./

ENV HOST=0.0.0.0 \
    PORT=8765 \
    DB_PATH=/data/readings.db

EXPOSE 8765

CMD ["python", "server.py"]
