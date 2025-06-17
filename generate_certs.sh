#!/bin/bash
# Certificate generation script for MQTT TLS authentication using step-cli

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERTS_DIR="$SCRIPT_DIR/certs"
CA_NAME="MakerspaceCA"
CLIENT_AUTHN_ID="client1-authnID"
CLIENT_NAME="client1"
PROVISIONER_NAME="Makerspace2025Provisioner"

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
if [ ! -d ~/.step ]; then
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

# Generate client certificate with authentication ID
if [ ! -f "${CLIENT_AUTHN_ID}.pem" ]; then
    echo "Generating client certificate with authentication ID: $CLIENT_AUTHN_ID"
    echo "Enter the CA password when prompted:"
    step certificate create \
        "$CLIENT_AUTHN_ID" \
        "${CLIENT_AUTHN_ID}.pem" \
        "${CLIENT_AUTHN_ID}.key" \
        --ca ~/.step/certs/intermediate_ca.crt \
        --ca-key ~/.step/secrets/intermediate_ca_key \
        --no-password \
        --insecure \
        --not-after 2400h
    
    echo "Client certificate generated: ${CLIENT_AUTHN_ID}.pem"
    echo "Client private key generated: ${CLIENT_AUTHN_ID}.key"
else
    echo "Client certificate already exists: ${CLIENT_AUTHN_ID}.pem"
fi

# Generate thumbprint for Azure Event Grid client configuration
echo "Certificate thumbprint for Azure Event Grid:"
step certificate fingerprint "${CLIENT_AUTHN_ID}.pem"

# Copy certificates to accessible location
echo "Copying certificates to main directory..."
cp "${CLIENT_AUTHN_ID}.pem" "../${CLIENT_AUTHN_ID}.pem"
cp "${CLIENT_AUTHN_ID}.key" "../${CLIENT_AUTHN_ID}.key"
cp ~/.step/certs/intermediate_ca.crt "../intermediate_ca.crt"
cp ~/.step/certs/root_ca.crt "../root_ca.crt"

# Create certificate JSON for Azure deployment
echo "Creating certificate JSON for Azure deployment..."
INTERMEDIATE_CERT_B64=$(base64 -w 0 ~/.step/certs/intermediate_ca.crt)
cat > "../ca-cert.json" << EOF
{
    "properties": {
        "description": "Makerspace CA intermediate certificate for device authentication",
        "encodedCertificate": "-----BEGIN CERTIFICATE-----
${INTERMEDIATE_CERT_B64}
-----END CERTIFICATE-----"
    }
}
EOF

echo ""
echo "Certificate generation completed successfully!"
echo ""
echo "Generated files:"
echo "  - ${CLIENT_AUTHN_ID}.pem (client certificate)"
echo "  - ${CLIENT_AUTHN_ID}.key (client private key)"
echo "  - intermediate_ca.crt (intermediate CA certificate for Azure upload)"
echo "  - root_ca.crt (root CA certificate)"
echo "  - ca-cert.json (CA certificate JSON for Azure CLI deployment)"
echo ""
echo "Thumbprint for Azure Event Grid client configuration:"
step certificate fingerprint "${CLIENT_AUTHN_ID}.pem"
echo ""
echo "Next steps:"
echo "1. Upload intermediate_ca.crt to Azure Event Grid namespace CA certificates"
echo "2. Create MQTT client in Azure Event Grid with:"
echo "   - Client name: $CLIENT_NAME"
echo "   - Authentication name: $CLIENT_AUTHN_ID"
echo "   - Validation scheme: SubjectMatchesAuthenticationName"
echo "3. Use ${CLIENT_AUTHN_ID}.pem and ${CLIENT_AUTHN_ID}.key for MQTT client connection"
echo ""
echo "Azure CLI command to upload CA certificate:"
echo "az eventgrid namespace ca-certificate create -g <resource-group> --namespace-name <namespace> -n makerspace-ca --certificate @./ca-cert.json"
