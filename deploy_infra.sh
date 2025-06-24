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
export RESOURCE_GROUP="$RESOURCE_GROUP"
export CONTAINER_REGISTRY_NAME="$CONTAINER_REGISTRY_NAME"
export EVENTGRID_NAMESPACE="$EVENTGRID_NAMESPACE"

# Certificate Files
export CLIENT_CERT="client1-authnID.pem"
export CLIENT_KEY="client1-authnID.key" 
export CA_CERT="intermediate_ca.crt"
export ROOT_CA_CERT="root_ca.crt"

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
test_mqtt_connection() {
    local test_result=0
    
    # Check if required files exist
    if [ ! -f "client1-authnID.pem" ] || [ ! -f "client1-authnID.key" ] || [ ! -f "intermediate_ca.crt" ]; then
        echo "Warning: Required certificate files not found. Skipping MQTT test."
        return 1
    fi
    
    # Check if mosquitto_pub is available
    if ! command -v mosquitto_pub &> /dev/null; then
        echo "Warning: mosquitto_pub not found. Skipping MQTT test."
        echo "Please install mosquitto-clients: sudo apt-get install mosquitto-clients"
        return 1
    fi
    
    echo "Testing MQTT connection to $MQTT_HOSTNAME:8883..."
    
    # Create test message
    local test_message='{"timestamp":"'$(date -Iseconds)'","temperature":23.5,"test":true}'
    local test_topic="devices/client1-authnID/telemetry"
    
    # Test MQTT publish with certificate authentication
    timeout 10 mosquitto_pub \
        -h "$MQTT_HOSTNAME" \
        -p 8883 \
        --cert client1-authnID.pem \
        --key client1-authnID.key \
        --cafile intermediate_ca.crt \
        -t "$test_topic" \
        -m "$test_message" \
        -q 1 \
        --insecure 2>/dev/null
    
    test_result=$?
    
    if [ $test_result -eq 0 ]; then
        echo "✓ MQTT connection test successful"
        echo "  Published test message to topic: $test_topic"
        return 0
    else
        echo "✗ MQTT connection test failed (exit code: $test_result)"
        echo "  This may be expected if the MQTT endpoint is not yet fully configured"
        return 1
    fi
}

# Run MQTT test if hostname is available
if [ -n "$MQTT_HOSTNAME" ] && [ "$MQTT_HOSTNAME" != "null" ]; then
    test_mqtt_connection || echo "MQTT test completed with warnings"
else
    echo "MQTT hostname not available. Skipping connection test."
fi

echo ""
echo "Deployment completed successfully!"
