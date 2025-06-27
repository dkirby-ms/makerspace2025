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

# Parse command line arguments
CA_PASSWORD=""
while [[ $# -gt 0 ]]; do
    case $1 in
        --password)
            CA_PASSWORD="$2"
            shift 2
            ;;
        --password=*)
            CA_PASSWORD="${1#*=}"
            shift
            ;;
        -h|--help)
            echo "Usage: $0 [--password <password>]"
            echo "  --password: Password for CA private key (optional, will prompt if not provided)"
            echo ""
            echo "Environment variables:"
            echo "  RESOURCE_GROUP: Azure resource group name (default: rg-makerspace2025)"
            echo "  LOCATION: Azure region (default: westus2)"
            echo "  EVENTGRID_NAMESPACE: Event Grid namespace (default: makerspace-eventgrid)"
            echo "  CONTAINER_APP_NAME: Container app name (default: makerspace-cert-service)"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

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
if [ -n "$CA_PASSWORD" ]; then
    ./generate_certs.sh --password "$CA_PASSWORD"
else
    ./generate_certs.sh
fi

# Verify certificates were generated
if [ ! -f "./certs/intermediate_ca.crt" ]; then
    echo "Error: Certificate generation failed. intermediate_ca.crt not found."
    exit 1
fi

# Prepare certificate for Bicep parameter (preserve PEM format)
echo "Preparing certificate for deployment..."
CA_CERT_CONTENT=$(cat ./certs/intermediate_ca.crt)

# Prepare intermediate private key for Bicep parameter
echo "Preparing intermediate private key for deployment..."
if [ -f ~/.step/secrets/intermediate_ca_key ]; then
    INTERMEDIATE_KEY_CONTENT=$(cat ~/.step/secrets/intermediate_ca_key)
else
    echo "Warning: Intermediate private key not found at ~/.step/secrets/intermediate_ca_key"
    echo "Using empty key content - certificate signing will not work"
    INTERMEDIATE_KEY_CONTENT=""
fi

# Step 2: Create resource group
echo "Step 2: Creating resource group..."

# Get current Azure subscription ID
AZURE_SUBSCRIPTION_ID=$(az account show --query id --output tsv)
echo "Using Azure Subscription: $AZURE_SUBSCRIPTION_ID"

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
        intermediatePrivateKeyContent="$INTERMEDIATE_KEY_CONTENT" \
        deployCaCertificate=true \
    --output json)

echo "Infrastructure deployment completed successfully!"

# Extract outputs
CONTAINER_REGISTRY_NAME=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.properties.outputs.containerRegistryName.value')
MQTT_HOSTNAME=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.properties.outputs.mqttHostname.value')
CONTAINER_APP_URL=$(echo "$DEPLOYMENT_OUTPUT" | jq -r '.properties.outputs.containerAppUrl.value')

cd ..

# Create/update test environment file
echo "Creating test environment configuration..."
cat > .env.test << EOF
# Test Environment Configuration
# Generated on $(date)

# Certificate Service URL
export CERT_SERVICE_URL="$CONTAINER_APP_URL"

# MQTT Broker Hostname
export MQTT_HOSTNAME="$MQTT_HOSTNAME"

# Resource Configuration
export EVENTGRID_RESOURCE_GROUP="$RESOURCE_GROUP"
export CONTAINER_REGISTRY_NAME="$CONTAINER_REGISTRY_NAME"
export EVENTGRID_NAMESPACE_NAME="$EVENTGRID_NAMESPACE"
export AZURE_SUBSCRIPTION_ID="$AZURE_SUBSCRIPTION_ID"

# Certificate Files
export CLIENT_CERT="certs/client1-authnID.pem"
export CLIENT_KEY="certs/client1-authnID.key" 
export CA_CERT="certs/intermediate_ca.crt"
export ROOT_CA_CERT="certs/root_ca.crt"

# Certificate Service Configuration
export INTERMEDIATE_CERT_PATH="/home/saitcho/makerspace2025/certs/intermediate_ca.crt"
export INTERMEDIATE_KEY_PATH="/home/saitcho/.step/secrets/intermediate_ca_key"
export CA_CERT_SUBJECT="/C=US/ST=CA/L=SanFrancisco/O=Makerspace/OU=IT/CN=Makerspace CA"
export CERT_VALIDITY_DAYS=365
export USE_INTERMEDIATE_CA=true
export PORT=3000

# Test Configuration
export TEST_TIMEOUT=60
export TEST_VERBOSE=true
export TEST_DEVICE_ID="client1-authnID"
EOF

echo "Test environment file updated: .env.test"

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

# Step 6: Test MQTT connection
echo "Step 6: Testing MQTT connection with certificate..."
if [ -n "$MQTT_HOSTNAME" ] && [ "$MQTT_HOSTNAME" != "null" ]; then
    echo "Running dedicated MQTT connection test..."
    if [ -x "$SCRIPT_DIR/test_mqtt_connection.sh" ]; then
        "$SCRIPT_DIR/test_mqtt_connection.sh" || echo "MQTT test completed with warnings"
    else
        echo "Warning: test_mqtt_connection.sh not found or not executable"
    fi
else
    echo "MQTT hostname not available. Skipping connection test."
fi

echo ""
echo "Deployment completed successfully!"
