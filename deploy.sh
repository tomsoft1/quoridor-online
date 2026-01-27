#!/bin/bash
set -e

SERVER="myapp.fr"
REMOTE_DIR="/home/tomsoft/www/quoridor"
NGINX_CONF="nginx/quoridor"

echo "==> Building for production..."
npm run build

echo "==> Creating remote directory..."
ssh "$SERVER" "mkdir -p $REMOTE_DIR"

echo "==> Uploading dist..."
rsync -avz --delete dist/ "$SERVER:$REMOTE_DIR/dist/"

echo "==> Setting up nginx (if needed)..."
ssh "$SERVER" "
  if [ ! -f /etc/nginx/sites-available/quoridor ]; then
    echo 'Installing nginx config...'
    sudo tee /etc/nginx/sites-available/quoridor > /dev/null
    sudo ln -sf /etc/nginx/sites-available/quoridor /etc/nginx/sites-enabled/quoridor
    sudo nginx -t && sudo systemctl reload nginx
    echo 'Nginx configured. Run certbot for HTTPS:'
    echo '  sudo certbot --nginx -d quoridor.myapp.fr'
  else
    echo 'Nginx config already exists, skipping.'
  fi
" < "$NGINX_CONF"

echo "==> Done! https://quoridor.myapp.fr"
