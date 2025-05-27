#!/bin/bash

# Script to initialize Let's Encrypt certificates

domains=(qdiag.xyz)
rsa_key_size=4096
data_path="./certbot"
email="khoruzhii.ka@gmail.com"
staging=0 # Set to 1 if you're testing your setup to avoid hitting rate limits

# Create required directories
echo "### Creating required directories..."
mkdir -p "$data_path/conf"
mkdir -p "$data_path/www"
mkdir -p "frontend"

# Copy frontend files to volume directory
echo "### Copying frontend files..."
cp index.html styles.css script.js timer.js tutorial.js frontend/

# Download TLS parameters
echo "### Downloading recommended TLS parameters..."
mkdir -p "$data_path/conf"
curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf > "$data_path/conf/options-ssl-nginx.conf"
curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem > "$data_path/conf/ssl-dhparams.pem"

# Create dummy certificate
echo "### Creating dummy certificate for $domains..."
path="/etc/letsencrypt/live/$domains"
mkdir -p "$data_path/conf/live/$domains"
docker compose run --rm --entrypoint "\
  openssl req -x509 -nodes -newkey rsa:1024 -days 1\
    -keyout '$path/privkey.pem' \
    -out '$path/fullchain.pem' \
    -subj '/CN=localhost'" certbot

# Start nginx
echo "### Starting nginx..."
docker compose up --force-recreate -d nginx

# Delete dummy certificate
echo "### Deleting dummy certificate for $domains..."
docker compose run --rm --entrypoint "\
  rm -Rf /etc/letsencrypt/live/$domains && \
  rm -Rf /etc/letsencrypt/archive/$domains && \
  rm -Rf /etc/letsencrypt/renewal/$domains.conf" certbot

# Request Let's Encrypt certificate
echo "### Requesting Let's Encrypt certificate for $domains..."

# Select appropriate email arg
case "$email" in
  "") email_arg="--register-unsafely-without-email" ;;
  *) email_arg="--email $email" ;;
esac

# Enable staging mode if needed
if [ $staging != "0" ]; then staging_arg="--staging"; fi

docker compose run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot \
    $staging_arg \
    $email_arg \
    -d $domains \
    --rsa-key-size $rsa_key_size \
    --agree-tos \
    --force-renewal" certbot

# Reload nginx
echo "### Reloading nginx..."
docker compose exec nginx nginx -s reload

echo "### Done! Your site should now be available at https://$domains"