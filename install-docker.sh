#!/bin/bash

# Docker and Docker Compose installation script for Debian
# Run with: sudo bash install-docker.sh

set -e

echo "Starting Docker installation..."

# Update package list
apt-get update

# Install prerequisites
apt-get install -y apt-transport-https ca-certificates curl gnupg lsb-release

# Add Docker's official GPG key
curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg

# Add Docker repository
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/debian $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null

# Update package list again
apt-get update

# Install Docker Engine
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin

# Install Docker Compose plugin
apt-get install -y docker-compose-plugin

# Start and enable Docker service
systemctl start docker
systemctl enable docker

# Add current user to docker group (if not root)
if [ "$SUDO_USER" ]; then
    usermod -aG docker $SUDO_USER
    echo "User $SUDO_USER added to docker group"
    echo "Please log out and log back in for group changes to take effect"
fi

# Verify installation
echo "Verifying installation..."
docker --version
docker compose version

echo "Docker installation completed successfully!"
echo "To run Docker without sudo, please log out and log back in."
