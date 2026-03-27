#!/usr/bin/env bash
set -euo pipefail

echo "Starting deploy steps..."

# aaPanel can lock this file with immutable bit and block cleanup/rebuild.
if [ -f frontend/dist/.user.ini ]; then
  chattr -i frontend/dist/.user.ini 2>/dev/null || true
  sudo chattr -i frontend/dist/.user.ini 2>/dev/null || true
  rm -f frontend/dist/.user.ini || true
fi

if [ -f requirements.txt ]; then
  pip install -r requirements.txt
fi

if [ -d frontend ]; then
  cd frontend
  if [ -f package-lock.json ]; then
    npm ci
  else
    npm install
  fi
  npm run build
  cd - >/dev/null
fi

if [ -d backend ]; then
  cd backend
  python manage.py migrate --noinput
  python manage.py collectstatic --noinput
  cd - >/dev/null
fi

echo "Deploy steps completed."