#!/bin/bash
# Certificate service deployment script
# This script builds and deploys the certificate service container

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Parameters
RESOURCE_GROUP="${1:-rg-makerspace2025}"
CONTAINER_REGISTRY_NAME="${2}"
CONTAINER_APP_NAME="${3:-makerspace-cert-service}"

if [ -z "$CONTAINER_REGISTRY_NAME" ]; then
    echo "Error: Container registry name is required"
    echo "Usage: $0 <resource-group> <container-registry-name> [container-app-name]"
    exit 1
fi

echo "Deploying certificate service..."
echo "Resource Group: $RESOURCE_GROUP"
echo "Container Registry: $CONTAINER_REGISTRY_NAME"
echo "Container App: $CONTAINER_APP_NAME"

# Login to Azure Container Registry
echo "Logging in to Azure Container Registry..."
az acr login --name "$CONTAINER_REGISTRY_NAME"

# Build and push Docker image
echo "Building and pushing Docker image..."
cd cert-service

# Create image tags
IMAGE_TAG="$(date +%Y%m%d-%H%M%S)"
FULL_IMAGE_NAME="${CONTAINER_REGISTRY_NAME}.azurecr.io/cert-service:${IMAGE_TAG}"
LATEST_IMAGE_NAME="${CONTAINER_REGISTRY_NAME}.azurecr.io/cert-service:latest"

# Build image
echo "Building Docker image..."
docker build -t "$FULL_IMAGE_NAME" -t "$LATEST_IMAGE_NAME" .

# Push image
echo "Pushing image to registry..."
docker push "$FULL_IMAGE_NAME"
docker push "$LATEST_IMAGE_NAME"

# Update container app with new image
echo "Updating container app with new image..."
az containerapp update \
    --resource-group "$RESOURCE_GROUP" \
    --name "$CONTAINER_APP_NAME" \
    --image "$LATEST_IMAGE_NAME" \
    --output table

echo "Certificate service deployment completed successfully!"
echo "Image: $LATEST_IMAGE_NAME"
