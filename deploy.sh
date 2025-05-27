#!/bin/bash

# Pull latest changes
git pull

# Stop existing containers
docker-compose down

# Build and start services
docker-compose up -d --build

# Wait for nginx to start
sleep 10

# Initial SSL certificate (run only once)
if [ ! -d "./certbot/conf/live/qdiag.xyz" ]; then
    echo "Obtaining initial SSL certificate..."
    docker-compose run --rm certbot certonly \
        --webroot \
        --webroot-path=/var/www/certbot \
        --email khoruzhii.ka@gmail.com \
        --agree-tos \
        --no-eff-email \
        -d qdiag.xyz
    
    # Update nginx config for SSL
    cp nginx/nginx-ssl.conf nginx/nginx.conf
    docker-compose restart nginx
fi

echo "Deployment complete!"