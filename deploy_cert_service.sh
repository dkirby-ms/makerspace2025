#!/bin/bash
# Certificate service deployment script
# This script builds and deploys the certificate service container

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load environment variables from .env file if it exists
if [ -f "$SCRIPT_DIR/.env" ]; then
    echo "Loading environment variables from .env file..."
    export $(grep -v '^#' "$SCRIPT_DIR/.env" | xargs)
elif [ -f "$SCRIPT_DIR/.env.test" ]; then
    echo "Loading environment variables from .env.test file..."
    source "$SCRIPT_DIR/.env.test"
else
    echo "No .env file found. Copy .env.template to .env and customize values."
fi

# Parameters from environment variables with defaults
RESOURCE_GROUP="${RESOURCE_GROUP:-rg-makerspace2025}"
CONTAINER_REGISTRY_NAME="${CONTAINER_REGISTRY_NAME}"
CONTAINER_APP_NAME="${CONTAINER_APP_NAME:-makerspace-cert-service}"

# Validate required environment variables
if [ -z "$CONTAINER_REGISTRY_NAME" ]; then
    echo "Error: Container registry name is required"
    echo "Set CONTAINER_REGISTRY_NAME environment variable or include it in .env file"
    echo ""
    echo "Required environment variables:"
    echo "  CONTAINER_REGISTRY_NAME - Azure Container Registry name"
    echo ""
    echo "Optional environment variables:"
    echo "  RESOURCE_GROUP - Azure resource group (default: rg-makerspace2025)"
    echo "  CONTAINER_APP_NAME - Container app name (default: makerspace-cert-service)"
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
