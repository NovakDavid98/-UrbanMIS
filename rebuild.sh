#!/bin/bash
echo "Stopping containers..."
docker compose down -v

echo "Removing old images to force rebuild..."
docker rmi urbanmis-frontend urbanmis-backend

echo "Building containers with no cache..."
docker compose build --no-cache

echo "Starting services..."
docker compose up -d

echo "Done! Access the app at http://localhost:31236"
