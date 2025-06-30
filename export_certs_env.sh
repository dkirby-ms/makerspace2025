#!/bin/bash

# Export certificate content as environment variables for Azure Container Apps

echo "📋 Extracting certificate content for environment variables..."

CERT_DIR="/home/saitcho/makerspace2025/certs"
CLIENT_CERT="$CERT_DIR/client1-authnID.pem"
CLIENT_KEY="$CERT_DIR/client1-authnID.key"
CA_CERT="$CERT_DIR/root_ca.crt"

# Check if files exist
if [ ! -f "$CLIENT_CERT" ]; then
    echo "❌ Client certificate not found: $CLIENT_CERT"
    exit 1
fi

if [ ! -f "$CLIENT_KEY" ]; then
    echo "❌ Client key not found: $CLIENT_KEY"
    exit 1
fi

if [ ! -f "$CA_CERT" ]; then
    echo "❌ CA certificate not found: $CA_CERT"
    exit 1
fi

echo "✅ All certificate files found"
echo ""

# Extract certificate content (escape newlines for environment variables)
echo "📄 Certificate content for Azure Container Apps environment variables:"
echo ""

echo "MQTT_CLIENT_CERT_CONTENT:"
echo "=========================="
awk '{printf "%s\\n", $0}' "$CLIENT_CERT"
echo ""
echo ""

echo "MQTT_CLIENT_KEY_CONTENT:"
echo "========================"
awk '{printf "%s\\n", $0}' "$CLIENT_KEY"
echo ""
echo ""

echo "MQTT_CA_CERT_CONTENT:"
echo "===================="
awk '{printf "%s\\n", $0}' "$CA_CERT"
echo ""
echo ""

echo "💡 Copy these values to Azure Container Apps environment variables"
echo "💡 Or use Azure CLI:"
echo ""
echo "az containerapp update \\"
echo "  --name makerspace-cert-service \\"
echo "  --resource-group your-rg \\"
echo "  --set-env-vars \\"
echo "    'MQTT_CLIENT_CERT_CONTENT=$(awk '{printf \"%s\\\\n\", \$0}' \"$CLIENT_CERT\")' \\"
echo "    'MQTT_CLIENT_KEY_CONTENT=$(awk '{printf \"%s\\\\n\", \$0}' \"$CLIENT_KEY\")' \\"
echo "    'MQTT_CA_CERT_CONTENT=$(awk '{printf \"%s\\\\n\", \$0}' \"$CA_CERT\")'"
