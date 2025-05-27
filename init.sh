#!/bin/bash

# Script to initialize Let's Encrypt certificates

domains=(qdiag.xyz)
rsa_key_size=4096
data_path="./certbot"
email="your-email@example.com" # Change this!
staging=0 # Set to 1 if you're testing your setup to avoid hitting rate limits

echo "### BMF Game SSL Setup ###"

# Create required directories
echo "### Creating required directories..."
mkdir -p "$data_path/conf"
mkdir -p "$data_path/www"
mkdir -p "frontend"

# Copy frontend files to volume directory
echo "### Copying frontend files..."
cp index.html styles.css script.js timer.js tutorial.js frontend/

# First, start with HTTP configuration
echo "### Starting services with HTTP configuration..."
cp nginx-http.conf nginx.conf
docker compose up -d

# Wait for services to be ready
echo "### Waiting for services to start..."
sleep 10

# Test if HTTP is working
echo "### Testing HTTP access..."
if curl -f http://qdiag.xyz/bmf/ > /dev/null 2>&1; then
    echo "HTTP is working!"
else
    echo "ERROR: HTTP is not accessible. Please check your firewall and nginx configuration."
    exit 1
fi

# Download TLS parameters
echo "### Downloading recommended TLS parameters..."
curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot-nginx/certbot_nginx/_internal/tls_configs/options-ssl-nginx.conf > "$data_path/conf/options-ssl-nginx.conf"
curl -s https://raw.githubusercontent.com/certbot/certbot/master/certbot/certbot/ssl-dhparams.pem > "$data_path/conf/ssl-dhparams.pem"

# Request Let's Encrypt certificate
echo "### Requesting Let's Encrypt certificate for $domains..."

# Select appropriate email arg
case "$email" in
  "") email_arg="--register-unsafely-without-email" ;;
  *) email_arg="--email $email" ;;
esac

# Enable staging mode if needed
if [ $staging != "0" ]; then staging_arg="--staging"; fi

# Run certbot
docker compose run --rm certbot \
  certonly --webroot -w /var/www/certbot \
    $staging_arg \
    $email_arg \
    -d $domains \
    --rsa-key-size $rsa_key_size \
    --agree-tos \
    --force-renewal

# Check if certificate was obtained
if [ ! -f "$data_path/conf/live/$domains/fullchain.pem" ]; then
    echo "ERROR: Certificate was not obtained. The site will continue running on HTTP."
    echo "Please check the error messages above."
    exit 1
fi

echo "### Certificate obtained! Switching to HTTPS configuration..."

# Copy HTTPS nginx configuration
cat > nginx.conf << 'EOF'
user nginx;
worker_processes auto;
error_log /var/log/nginx/error.log warn;
pid /var/run/nginx.pid;

events {
    worker_connections 1024;
}

http {
    include /etc/nginx/mime.types;
    default_type application/octet-stream;
    
    log_format main '$remote_addr - $remote_user [$time_local] "$request" '
                    '$status $body_bytes_sent "$http_referer" '
                    '"$http_user_agent" "$http_x_forwarded_for"';
    
    access_log /var/log/nginx/access.log main;
    
    sendfile on;
    tcp_nopush on;
    keepalive_timeout 65;
    gzip on;
    
    # HTTP server - redirect to HTTPS
    server {
        listen 80;
        server_name qdiag.xyz;
        
        location /.well-known/acme-challenge/ {
            root /var/www/certbot;
        }
        
        location / {
            return 301 https://$server_name$request_uri;
        }
    }
    
    # HTTPS server
    server {
        listen 443 ssl;
        server_name qdiag.xyz;
        
        ssl_certificate /etc/letsencrypt/live/qdiag.xyz/fullchain.pem;
        ssl_certificate_key /etc/letsencrypt/live/qdiag.xyz/privkey.pem;
        
        # Include recommended SSL parameters
        include /etc/letsencrypt/options-ssl-nginx.conf;
        ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;
        
        # HSTS
        add_header Strict-Transport-Security "max-age=63072000" always;
        
        # Frontend location
        location /bmf/ {
            root /usr/share/nginx/html;
            try_files $uri $uri/ /bmf/index.html;
            
            # Cache static assets
            location ~* \.(css|js|png|jpg|jpeg|gif|ico|svg)$ {
                expires 1d;
                add_header Cache-Control "public, immutable";
            }
        }
        
        # API proxy
        location /api/ {
            proxy_pass http://backend:5000/api/;
            proxy_set_header Host $host;
            proxy_set_header X-Real-IP $remote_addr;
            proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
            proxy_set_header X-Forwarded-Proto $scheme;
            
            # CORS headers
            add_header 'Access-Control-Allow-Origin' 'https://qdiag.xyz' always;
            add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS' always;
            add_header 'Access-Control-Allow-Headers' 'DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range' always;
            
            if ($request_method = 'OPTIONS') {
                return 204;
            }
        }
        
        # Default redirect to /bmf/
        location = / {
            return 301 /bmf/;
        }
    }
}
EOF

# Restart nginx with new configuration
echo "### Restarting services with HTTPS configuration..."
docker compose restart nginx

# Setup auto-renewal
echo "### Setting up certificate auto-renewal..."
docker compose up -d certbot

echo "### Done! Your site should now be available at https://$domains"
echo "### The certificates will auto-renew every 12 hours."