#!/bin/bash
# Complete deployment script for Makerspace IoT Certificate Management System
# This script generates certificates first, then deploys Azure resources with certificates included

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Configuration
RESOURCE_GROUP="${RESOURCE_GROUP:-rg-makerspace2025}"
LOCATION="${LOCATION:-westus2}"
EVENTGRID_NAMESPACE="${EVENTGRID_NAMESPACE:-makerspace-eventgrid}"
CONTAINER_APP_NAME="${CONTAINER_APP_NAME:-makerspace-cert-service}"

echo "========================================"
echo "Makerspace 2025 IoT Deployment"
echo "========================================"
echo "Resource Group: $RESOURCE_GROUP"
echo "Location: $LOCATION"
echo "Event Grid Namespace: $EVENTGRID_NAMESPACE"
echo "Container App: $CONTAINER_APP_NAME"
echo ""

# Step 1: Generate certificates
echo "Step 1: Generating certificates..."
./generate_certs.sh

# Verify certificates were generated
if [ ! -f "intermediate_ca.crt" ]; then
    echo "Error: Certificate generation failed. intermediate_ca.crt not found."
    exit 1
fi

# Prepare certificate for Bicep parameter (preserve PEM format)
echo "Preparing certificate for deployment..."
CA_CERT_CONTENT=$(cat intermediate_ca.crt)

# Step 2: Create resource group
echo "Step 2: Creating resource group..."
az group create \
    --name "$RESOURCE_GROUP" \
    --location "$LOCATION" \
    --output table

# Step 3: Deploy infrastructure with certificates
echo "Step 3: Deploying Azure infrastructure with certificates..."
cd infra

DEPLOYMENT_OUTPUT=$(az deployment group create \
    --resource-group "$RESOURCE_GROUP" \
    --template-file main.bicep \
    --parameters \
        eventGridNamespaceName="$EVENTGRID_NAMESPACE" \
        containerAppName="$CONTAINER_APP_NAME" \
        location="$LOCATION" \
        caCertificateContent="$CA_CERT_CONTENT" \
        deployCaCertificate=true \
    --output json)

echo "Infrastructure deployment completed successfully!"

# Extract outputs
CONTAINER_REGISTRY_NAME=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.properties.outputs.containerRegistryName.value')
MQTT_HOSTNAME=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.properties.outputs.mqttHostname.value')
CONTAINER_APP_URL=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.properties.outputs.containerAppUrl.value')

cd ..

# Step 4: Build and deploy certificate service
echo "Step 4: Building and deploying certificate service..."
./deploy_cert_service.sh "$RESOURCE_GROUP" "$CONTAINER_REGISTRY_NAME" "$CONTAINER_APP_NAME"

# Step 5: Display deployment summary
echo ""
echo "========================================"
echo "Deployment Summary"
echo "========================================"
echo "Resource Group: $RESOURCE_GROUP"
echo "Event Grid Namespace: $EVENTGRID_NAMESPACE"
echo "MQTT Hostname: $MQTT_HOSTNAME"
echo "Container App URL: $CONTAINER_APP_URL"
echo "Container Registry: $CONTAINER_REGISTRY_NAME"
echo ""
echo "Certificate files:"
echo "  - client1-authnID.pem (client certificate)"
echo "  - client1-authnID.key (client private key)"
echo "  - intermediate_ca.crt (intermediate CA)"
echo "  - root_ca.crt (root CA)"
echo ""
echo "Next steps:"
echo "1. Test MQTT connection using client certificate"
echo "2. Test device registration via certificate service"
echo "3. Deploy applications to devices"
echo ""
echo "Deployment completed successfully!"
