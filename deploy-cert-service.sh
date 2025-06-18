#!/bin/bash

# Deployment script for certificate service
set -e

# Configuration
RESOURCE_GROUP="rg-Makerspace2025"
LOCATION="westus2"
ACR_NAME=""
CONTAINER_APP_NAME=""

echo "Deploying Makerspace Certificate Service..."

# Get outputs from infrastructure deployment
echo "Getting infrastructure outputs..."
OUTPUTS=$(az deployment group show \
  --resource-group $RESOURCE_GROUP \
  --name "main" \
  --query "properties.outputs" \
  --output json)

ACR_NAME=$(echo $OUTPUTS | jq -r '.containerRegistryName.value')
CONTAINER_APP_NAME=$(echo $OUTPUTS | jq -r '.containerAppName.value')
ACR_LOGIN_SERVER=$(echo $OUTPUTS | jq -r '.containerRegistryLoginServer.value // empty')

if [ -z "$ACR_NAME" ] || [ -z "$CONTAINER_APP_NAME" ]; then
  echo "Error: Could not get required outputs from infrastructure deployment"
  echo "Make sure the infrastructure is deployed first with: az deployment group create ..."
  exit 1
fi

echo "Container Registry: $ACR_NAME"
echo "Container App: $CONTAINER_APP_NAME"

# Login to Azure Container Registry
echo "Logging in to Azure Container Registry..."
az acr login --name $ACR_NAME

# Build and push Docker image
echo "Building and pushing Docker image..."
cd cert-service

# Tag image
IMAGE_TAG="$(date +%Y%m%d-%H%M%S)"
FULL_IMAGE_NAME="${ACR_NAME}.azurecr.io/cert-service:${IMAGE_TAG}"
LATEST_IMAGE_NAME="${ACR_NAME}.azurecr.io/cert-service:latest"

# Build image
docker build -t $FULL_IMAGE_NAME -t $LATEST_IMAGE_NAME .

# Push image
docker push $FULL_IMAGE_NAME
docker push $LATEST_IMAGE_NAME

echo "Image pushed: $FULL_IMAGE_NAME"

# Update Container App to use new image
echo "Updating Container App configuration..."
az containerapp update \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --image $FULL_IMAGE_NAME

# Get Container App URL
CONTAINER_APP_URL=$(az containerapp show \
  --name $CONTAINER_APP_NAME \
  --resource-group $RESOURCE_GROUP \
  --query "properties.configuration.ingress.fqdn" \
  --output tsv)

echo ""
echo "Deployment complete!"
echo "Container App URL: https://$CONTAINER_APP_URL"
echo "Health check: https://$CONTAINER_APP_URL/health"
echo "CA Certificate: https://$CONTAINER_APP_URL/ca-certificate"
echo ""
echo "Test device registration:"
echo "curl -X POST https://$CONTAINER_APP_URL/register-device -H 'Content-Type: application/json' -d '{\"deviceId\": \"test-device-001\"}'"
