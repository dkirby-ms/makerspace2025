#!/bin/bash
# Certificate generation script for MQTT TLS authentication using step-cli

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERTS_DIR="$SCRIPT_DIR/certs"
CA_NAME="MqttAppSamplesCA"
CLIENT_NAME="client1-authnID"
PROVISIONER_NAME="MqttAppSamplesCAProvisioner"

echo "Generating certificates for MQTT TLS authentication..."

# Check if step-cli is installed
if ! command -v step &> /dev/null; then
    echo "Error: step-cli is not installed. Please install it first:"
    echo "  For Ubuntu/Debian: wget -O- https://dl.smallstep.com/gh-release-header | bash && sudo apt install step-cli"
    echo "  For other systems: visit https://smallstep.com/docs/step-cli/installation/"
    exit 1
fi

# Create certificates directory
mkdir -p "$CERTS_DIR"
cd "$CERTS_DIR"

# Initialize step CA if not already done
if [ ! -d ".step" ]; then
    echo "Initializing Certificate Authority..."
    echo "You will be prompted for a password. Remember this password for the next step."
    step ca init \
        --deployment-type standalone \
        --name "$CA_NAME" \
        --dns localhost \
        --address 127.0.0.1:443 \
        --provisioner "$PROVISIONER_NAME"
    
    echo "CA initialization completed."
else
    echo "CA already exists, skipping initialization."
fi

# Generate client certificate
if [ ! -f "${CLIENT_NAME}.pem" ]; then
    echo "Generating client certificate..."
    echo "Enter the CA password when prompted:"
    step certificate create \
        "$CLIENT_NAME" \
        "${CLIENT_NAME}.pem" \
        "${CLIENT_NAME}.key" \
        --ca .step/certs/intermediate_ca.crt \
        --ca-key .step/secrets/intermediate_ca_key \
        --no-password \
        --insecure \
        --not-after 2400h
    
    echo "Client certificate generated: ${CLIENT_NAME}.pem"
    echo "Client private key generated: ${CLIENT_NAME}.key"
else
    echo "Client certificate already exists: ${CLIENT_NAME}.pem"
fi

# Generate thumbprint
echo "Certificate thumbprint:"
step certificate fingerprint "${CLIENT_NAME}.pem"

# Copy certificates to accessible location
echo "Copying certificates to main directory..."
cp "${CLIENT_NAME}.pem" "../${CLIENT_NAME}.pem"
cp "${CLIENT_NAME}.key" "../${CLIENT_NAME}.key"
cp ".step/certs/root_ca.crt" "../ca.crt"

echo ""
echo "Certificate generation completed successfully!"
echo ""
echo "Generated files:"
echo "  - ${CLIENT_NAME}.pem (client certificate)"
echo "  - ${CLIENT_NAME}.key (client private key)"
echo "  - ca.crt (CA certificate)"
echo ""
echo "Thumbprint (copy this for Azure Event Grid client configuration):"
step certificate fingerprint "${CLIENT_NAME}.pem"
echo ""
echo "Next steps:"
echo "1. Configure your MQTT broker to use these certificates"
echo "2. Update src/service_config.json with TLS settings:"
echo "   - Set 'use_tls': true"
echo "   - Set certificate paths if needed"
echo "3. If using Azure Event Grid, create a client with the thumbprint above"
