#!/bin/zsh
set -e

# Falo x Force 教學註解：
# 這是「學員版」唯一主入口。Runtime、Portal、ngrok 都從這裡啟動。
# 其他拆開的 command 檔保留在 tools/debug/，只給工程除錯與拆解教學使用。

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

PORT="${FALO_RUNTIME_PORT:-8765}"
HOST="${FALO_RUNTIME_HOST:-0.0.0.0}"
LOCAL_URL="http://127.0.0.1:${PORT}"
SESSION_NAME="ai_etl_runtime_${PORT}"
ENABLE_NGROK="${FALO_ENABLE_NGROK:-1}"

echo "=============================================="
echo " AI NotebookLM Runtime Lab - Unified Launcher"
echo "=============================================="
echo ""
echo "Falo x Force 教學註解："
echo "1. Runtime 是本機 Python service，真正負責 queue / upload / log。"
echo "2. Portal 是 HTML 操作面板，網址是 ${LOCAL_URL}。"
echo "3. ngrok 只是外部通道，讓 GAS / 雲端可以叫醒本機，不是第二個 runtime。"
echo ""

echo "[1/4] Environment check"
./.venv/bin/python environment_check.py
echo ""

echo "[2/4] Restart Python runtime on ${HOST}:${PORT}"
screen -S "${SESSION_NAME}" -X quit >/dev/null 2>&1 || true

PORT_PIDS="$(lsof -ti tcp:${PORT} 2>/dev/null || true)"
if [ -n "${PORT_PIDS}" ]; then
  echo "[INFO] Found existing listener(s) on port ${PORT}: ${PORT_PIDS}"
  echo "[INFO] Stopping old listener(s) for clean restart."
  echo "${PORT_PIDS}" | xargs kill >/dev/null 2>&1 || true
  sleep 1
fi

screen -dmS "${SESSION_NAME}" ./.venv/bin/python runtime_server.py --host "${HOST}" --port "${PORT}" --no-open

for i in {1..30}; do
  if curl -fsS "${LOCAL_URL}/api/status" >/dev/null 2>&1; then
    break
  fi
  sleep 0.5
done

if ! curl -fsS "${LOCAL_URL}/api/status" >/dev/null 2>&1; then
  echo "[ERROR] Runtime did not become ready: ${LOCAL_URL}"
  echo "Debug: screen -r ${SESSION_NAME}"
  exit 1
fi

echo "[OK] Runtime ready: ${LOCAL_URL}"
echo ""

echo "[3/4] Open local portal"
open "${LOCAL_URL}" >/dev/null 2>&1 || true
echo "[OK] Portal opened."
echo ""

echo "[4/4] External tunnel"
if [ "${ENABLE_NGROK}" != "1" ]; then
  echo "[SKIP] FALO_ENABLE_NGROK=${ENABLE_NGROK}; ngrok tunnel not started."
  echo "Runtime keeps running in screen session: ${SESSION_NAME}"
  exit 0
fi

if ! command -v ngrok >/dev/null 2>&1; then
  echo "[WARN] ngrok not found. Local runtime is still usable: ${LOCAL_URL}"
  echo "Runtime keeps running in screen session: ${SESSION_NAME}"
  exit 0
fi

EXISTING_NGROK="$(pgrep -fl "ngrok http ${PORT}" 2>/dev/null || true)"
if [ -n "${EXISTING_NGROK}" ]; then
  echo "[INFO] Stopping existing ngrok tunnel for port ${PORT}."
  pkill -f "ngrok http ${PORT}" >/dev/null 2>&1 || true
  sleep 1
fi

echo "[INFO] Starting ngrok -> ${LOCAL_URL}"
echo "[INFO] Copy the Forwarding https://... URL shown below."
echo "[INFO] Keep this terminal open for the external tunnel. Press Ctrl+C to stop ngrok."
echo ""

ngrok http "${PORT}" --log=stdout
