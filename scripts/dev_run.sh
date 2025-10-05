#!/usr/bin/env bash
set -euo pipefail

if [ -d ".venv" ]; then
  source .venv/bin/activate
else
  python -m venv .venv
  source .venv/bin/activate
  pip install -r requirements.txt
fi

if [ -f ".env" ]; then
  # shellcheck disable=SC2046
  export $(grep -v '^#' .env | xargs)
fi

if [ -z "${OPENAI_API_KEY:-}" ]; then
  echo "ERRO: defina OPENAI_API_KEY no .env ou ambiente." >&2
  exit 1
fi

export PYTHONPATH="$PWD"

python src/backend/rag/ingest.py
exec uvicorn src.backend.server_fastapi:app --host 127.0.0.1 --port 8000 --reload


