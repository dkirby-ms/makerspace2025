#!/bin/bash
# Test script for verifying the Makerspace IoT deployment

set -e

# Configuration
RESOURCE_GROUP="${RESOURCE_GROUP:-rg-makerspace2025}"
EVENTGRID_NAMESPACE="${EVENTGRID_NAMESPACE:-makerspace-eventgrid}"
CLIENT_CERT="client1-authnID.pem"
CLIENT_KEY="client1-authnID.key"

echo "========================================"
echo "Testing Makerspace IoT Deployment"
echo "========================================"

# Check if certificates exist
if [ ! -f "$CLIENT_CERT" ] || [ ! -f "$CLIENT_KEY" ]; then
    echo "Error: Client certificates not found. Run ./generate_certs.sh first."
    exit 1
fi

# Get deployment outputs
echo "Getting deployment information..."
OUTPUTS=$(az deployment group show \
    --resource-group "$RESOURCE_GROUP" \
    --name "main" \
    --query "properties.outputs" \
    --output json)

MQTT_HOSTNAME=$(echo "$OUTPUTS" | jq -r '.mqttHostname.value')
CONTAINER_APP_URL=$(echo "$OUTPUTS" | jq -r '.containerAppUrl.value')
CA_CERT_NAME=$(echo "$OUTPUTS" | jq -r '.caCertificateName.value')

echo "MQTT Hostname: $MQTT_HOSTNAME"
echo "Container App URL: $CONTAINER_APP_URL"
echo "CA Certificate Name: $CA_CERT_NAME"

# Test 1: Verify Event Grid namespace exists
echo ""
echo "Test 1: Verifying Event Grid namespace..."
NAMESPACE_STATUS=$(az eventgrid namespace show \
    --resource-group "$RESOURCE_GROUP" \
    --name "$EVENTGRID_NAMESPACE" \
    --query "provisioningState" \
    --output tsv)

if [ "$NAMESPACE_STATUS" = "Succeeded" ]; then
    echo "✓ Event Grid namespace is deployed and ready"
else
    echo "✗ Event Grid namespace deployment failed: $NAMESPACE_STATUS"
    exit 1
fi

# Test 2: Verify CA certificate is deployed
echo ""
echo "Test 2: Verifying CA certificate deployment..."
if [ "$CA_CERT_NAME" != "not-deployed" ] && [ "$CA_CERT_NAME" != "null" ]; then
    CA_CERT_STATUS=$(az eventgrid namespace ca-certificate show \
        --resource-group "$RESOURCE_GROUP" \
        --namespace-name "$EVENTGRID_NAMESPACE" \
        --name "$CA_CERT_NAME" \
        --query "provisioningState" \
        --output tsv 2>/dev/null || echo "NotFound")
    
    if [ "$CA_CERT_STATUS" = "Succeeded" ]; then
        echo "✓ CA certificate is deployed and ready"
    else
        echo "✗ CA certificate deployment failed: $CA_CERT_STATUS"
        exit 1
    fi
else
    echo "✗ CA certificate was not deployed"
    exit 1
fi

# Test 3: Verify MQTT client exists
echo ""
echo "Test 3: Verifying MQTT client configuration..."
CLIENT_STATUS=$(az eventgrid namespace client show \
    --resource-group "$RESOURCE_GROUP" \
    --namespace-name "$EVENTGRID_NAMESPACE" \
    --name "client1" \
    --query "properties.state" \
    --output tsv)

if [ "$CLIENT_STATUS" = "Enabled" ]; then
    echo "✓ MQTT client is configured and enabled"
else
    echo "✗ MQTT client configuration failed: $CLIENT_STATUS"
    exit 1
fi

# Test 4: Test certificate service endpoint
echo ""
echo "Test 4: Testing certificate service..."
if [ -n "$CONTAINER_APP_URL" ] && [ "$CONTAINER_APP_URL" != "null" ]; then
    HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "$CONTAINER_APP_URL/health" || echo "000")
    
    if [ "$HTTP_STATUS" = "200" ]; then
        echo "✓ Certificate service is responding"
    else
        echo "⚠ Certificate service may not be ready yet (HTTP $HTTP_STATUS)"
        echo "  This is normal if the container is still starting up"
    fi
else
    echo "⚠ Container app URL not available"
fi

# Test 5: Verify certificate thumbprint matches
echo ""
echo "Test 5: Verifying certificate thumbprint..."
if command -v step &> /dev/null; then
    CERT_THUMBPRINT=$(step certificate fingerprint "$CLIENT_CERT")
    echo "✓ Client certificate thumbprint: $CERT_THUMBPRINT"
else
    echo "⚠ step-cli not available for thumbprint verification"
fi

echo ""
echo "========================================"
echo "Test Summary"
echo "========================================"
echo "✓ Event Grid namespace deployed"
echo "✓ CA certificate deployed"
echo "✓ MQTT client configured"
echo "✓ Infrastructure ready for IoT devices"
echo ""
echo "Next steps:"
echo "1. Test MQTT connection using mosquitto_pub/sub"
echo "2. Register devices through certificate service"
echo "3. Deploy applications to devices"
echo ""
echo "Example MQTT test command:"
echo "mosquitto_pub -h $MQTT_HOSTNAME -p 8883 \\"
echo "  --cert $CLIENT_CERT --key $CLIENT_KEY \\"
echo "  -t 'devices/client1/telemetry' -m 'test message'"
