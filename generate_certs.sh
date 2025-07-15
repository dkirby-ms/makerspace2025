#!/bin/bash
# Certificate generation script for MQTT TLS authentication using step-cli

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CERTS_DIR="$SCRIPT_DIR/certs"
CA_NAME="MakerspaceCA"
CLIENT_AUTHN_ID="client1-authnID"
CLIENT_NAME="client1"
PROVISIONER_NAME="Makerspace2025Provisioner"

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
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
done

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
    if [ -n "$CA_PASSWORD" ]; then
        echo "Using provided password for CA initialization..."
        echo "$CA_PASSWORD" | step ca init \
            --deployment-type standalone \
            --name "$CA_NAME" \
            --dns localhost \
            --address 127.0.0.1:443 \
            --provisioner "$PROVISIONER_NAME" \
            --password-file /dev/stdin
    else
        echo "You will be prompted for a password. Remember this password for the next step."
        step ca init \
            --deployment-type standalone \
            --name "$CA_NAME" \
            --dns localhost \
            --address 127.0.0.1:443 \
            --provisioner "$PROVISIONER_NAME"
    fi
    
    echo "CA initialization completed."
    echo "Note: The intermediate CA was created with EC keys. Regenerating with RSA..."
    
    # Backup the existing intermediate CA
    mv ~/.step/certs/intermediate_ca.crt ~/.step/certs/intermediate_ca_ec.crt.bak
    mv ~/.step/secrets/intermediate_ca_key ~/.step/secrets/intermediate_ca_key_ec.bak
    
    # Generate new RSA intermediate CA
    if [ -n "$CA_PASSWORD" ]; then
        echo "$CA_PASSWORD" | step certificate create \
            "$CA_NAME Intermediate CA" \
            ~/.step/certs/intermediate_ca.crt \
            ~/.step/secrets/intermediate_ca_key \
            --profile intermediate-ca \
            --ca ~/.step/certs/root_ca.crt \
            --ca-key ~/.step/secrets/root_ca_key \
            --ca-password-file /dev/stdin \
            --no-password \
            --insecure \
            --kty RSA \
            --size 2048
    else
        step certificate create \
            "$CA_NAME Intermediate CA" \
            ~/.step/certs/intermediate_ca.crt \
            ~/.step/secrets/intermediate_ca_key \
            --profile intermediate-ca \
            --ca ~/.step/certs/root_ca.crt \
            --ca-key ~/.step/secrets/root_ca_key \
            --no-password \
            --insecure \
            --kty RSA \
            --size 2048
    fi
    echo "RSA intermediate CA generated successfully."
else
    echo "CA already exists, skipping initialization."
fi

# Generate client certificate with authentication ID
if [ ! -f "${CLIENT_AUTHN_ID}.pem" ]; then
    echo "Generating client certificate with authentication ID: $CLIENT_AUTHN_ID"
    if [ -n "$CA_PASSWORD" ]; then
        echo "Using provided password for certificate generation..."
        echo "$CA_PASSWORD" | step certificate create \
            "$CLIENT_AUTHN_ID" \
            "${CLIENT_AUTHN_ID}.pem" \
            "${CLIENT_AUTHN_ID}.key" \
            --ca ~/.step/certs/intermediate_ca.crt \
            --ca-key ~/.step/secrets/intermediate_ca_key \
            --ca-password-file /dev/stdin \
            --kty RSA \
            --size 2048 \
            --no-password \
            --insecure \
            --not-after 2400h
    else
        echo "Enter the CA password when prompted:"
        step certificate create \
            "$CLIENT_AUTHN_ID" \
            "${CLIENT_AUTHN_ID}.pem" \
            "${CLIENT_AUTHN_ID}.key" \
            --ca ~/.step/certs/intermediate_ca.crt \
            --ca-key ~/.step/secrets/intermediate_ca_key \
            --kty RSA \
            --size 2048 \
            --no-password \
            --insecure \
            --not-after 2400h
    fi
    
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
cp ~/.step/certs/intermediate_ca.crt "./intermediate_ca.crt"
cp ~/.step/certs/root_ca.crt "./root_ca.crt"

# Create certificate JSON for Azure deployment (removed - not needed with new flow)
echo "Creating certificate data for Bicep deployment..."
echo "Intermediate CA certificate is ready for Bicep parameter at: $CERTS_DIR/../intermediate_ca.crt"

echo ""
echo "Certificate generation completed successfully!"
echo ""
echo "Generated files:"
echo "  - ${CLIENT_AUTHN_ID}.pem (client certificate)"
echo "  - ${CLIENT_AUTHN_ID}.key (client private key)"
echo "  - intermediate_ca.crt (intermediate CA certificate for Azure deployment)"
echo "  - root_ca.crt (root CA certificate)"
echo ""
echo "Thumbprint for Azure Event Grid client configuration:"
step certificate fingerprint "${CLIENT_AUTHN_ID}.pem"
echo ""
echo "Next steps:"
echo "1. Run ./deploy_infra.sh to deploy Azure infrastructure with certificates"
echo "2. The intermediate CA certificate will be automatically included in the deployment"
echo ""
echo "Usage examples:"
echo "  ./generate_certs.sh                    # Prompt for password interactively"
echo "  ./generate_certs.sh --password mypass  # Use provided password"
echo "  ./deploy_infra.sh --password mypass    # Deploy with password"
