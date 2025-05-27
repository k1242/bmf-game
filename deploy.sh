#!/bin/bash

# Pull latest changes
git pull

# Create necessary directories
mkdir -p certbot/conf certbot/www

# Stop existing containers
docker compose down

# Build and start services
docker compose up -d --build

# Wait for nginx to start
echo "Waiting for services to start..."
sleep 10

# Initial SSL certificate (run only once)
if [ ! -d "./certbot/conf/live/qdiag.xyz" ]; then
    echo "Obtaining initial SSL certificate..."
    
    # Use docker compose exec instead of run
    docker compose exec certbot certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email khoruzhii.ka@gmail.com \
        --agree-tos \
        --no-eff-email \
        --non-interactive \
        -d qdiag.xyz
    
    # Check if certificate was obtained successfully
    if [ -d "./certbot/conf/live/qdiag.xyz" ]; then
        echo "SSL certificate obtained successfully!"
        # Update nginx config for SSL
        cp nginx/nginx-ssl.conf nginx/nginx.conf
        docker compose restart nginx
    else
        echo "Failed to obtain SSL certificate. Please check your domain and try again."
    fi
else
    echo "SSL certificate already exists."
fi

echo "Deployment complete!"