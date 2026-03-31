#!/usr/bin/env bash
# AgriFinConnect Rwanda - Automated Deployment Script
# Location: /www/wwwroot/agrifin.online/deploy.sh

set -euo pipefail

# --- Configuration ---
PROJECT_ROOT="/www/wwwroot/agrifin.online"
VENV_PATH="$PROJECT_ROOT/venv"

# Define absolute paths to the virtual environment binaries.
VENV_PIP="$VENV_PATH/bin/pip"
VENV_PYTHON="$VENV_PATH/bin/python"

echo ">>> Starting AgriFin Deployment: $(date)"

# Move to the project root.
cd "$PROJECT_ROOT" || exit 1

# 1. Sync with GitHub (force sync method)
echo ">>> Fetching latest code from GitHub..."
git fetch origin
git reset --hard origin/main

# 2. Fix aaPanel .user.ini lock (prevents Vite build from crashing)
if [ -f "$PROJECT_ROOT/frontend/dist/.user.ini" ]; then
    echo ">>> Unlocking aaPanel .user.ini file..."
    sudo chattr -i "$PROJECT_ROOT/frontend/dist/.user.ini" 2>/dev/null || true
    rm -f "$PROJECT_ROOT/frontend/dist/.user.ini" || true
fi

# 3. Update backend dependencies using venv pip
if [ -f "requirements.txt" ]; then
    echo ">>> Installing Python requirements in Virtual Env..."
    "$VENV_PIP" install --upgrade pip
    # Prevent stale cached wheels from keeping an older numpy/joblib/sklearn runtime.
    "$VENV_PIP" install --no-cache-dir -r requirements.txt
fi

# 4. Build frontend (React/Vite)
if [ -d "frontend" ]; then
    echo ">>> Building React Frontend..."
    cd frontend || exit 1
    npm install
    chmod -R +x node_modules/.bin/
    npm run build
    cd "$PROJECT_ROOT" || exit 1
fi

# 5. Run Django tasks using venv python
if [ -d "backend" ]; then
    echo ">>> Running Django Migrations & Static Collection..."
    cd backend || exit 1
    "$VENV_PYTHON" manage.py migrate --noinput
    "$VENV_PYTHON" manage.py collectstatic --noinput
    echo ">>> Verifying model runtime and artifact loading..."
    "$VENV_PYTHON" manage.py shell -c "from api.model_health import get_model_health; h=get_model_health(); print(h); import sys; sys.exit(0 if h.get('status') == 'ok' else 1)"
    cd "$PROJECT_ROOT" || exit 1
fi

# 6. Restart the service
echo ">>> Restarting AgriFin Gunicorn Service..."
sudo systemctl daemon-reload
sudo systemctl restart agrifin

echo ">>> AgriFin Deployment Complete Successfully!"