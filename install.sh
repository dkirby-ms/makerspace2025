#!/bin/bash
# Installation script for BitNet MQTT Service

set -e

echo "Installing BitNet MQTT Service..."

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   echo "This script should not be run as root. Please run as normal user."
   exit 1
fi

# Install Python dependencies
echo "Installing Python dependencies..."
pip3 install -r requirements.txt

# Generate certificates for TLS authentication
echo "Checking for certificates..."
if [ ! -f "client1-authnID.pem" ] || [ ! -f "client1-authnID.key" ] || [ ! -f "ca.crt" ]; then
    echo "Certificates not found. Running certificate generation..."
    echo "This will create CA and client certificates for MQTT TLS authentication."
    read -p "Do you want to generate certificates now? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        ./generate_certs.sh
    else
        echo "Skipping certificate generation. You can run './generate_certs.sh' later."
        echo "Note: TLS authentication will not work without proper certificates."
    fi
else
    echo "Certificates found - skipping generation."
fi

# Create configuration from template
CONFIG_FILE="src/service_config.json"
if [ ! -f "$CONFIG_FILE" ]; then
    echo "Creating default configuration..."
    python3 src/bitnet_runner.py --create-config "$CONFIG_FILE"
fi

# Validate BitNet setup
echo "Validating BitNet setup..."
python3 src/bitnet_runner.py --config "$CONFIG_FILE" validate

# Make scripts executable
chmod +x src/bitnet_runner.py
chmod +x install.sh
chmod +x start_service.sh
chmod +x stop_service.sh

echo "Installation completed successfully!"
echo ""
echo "Next steps:"
echo "1. Edit src/service_config.json to configure MQTT broker and other settings"
echo "   - For TLS/SSL: set 'use_tls': true and verify certificate paths"
echo "   - For Azure Event Grid: use port 8883 and provide authentication details"
echo "2. Test the service: python3 src/bitnet_runner.py --config src/service_config.json test 'Hello world'"
echo "3. Run the service: python3 src/bitnet_runner.py --config src/service_config.json service"
echo "4. For systemd service installation (optional): sudo ./install_systemd.sh"
echo ""
if [ -f "client1-authnID.pem" ]; then
    echo "Certificate information:"
    echo "  - Client certificate: client1-authnID.pem"
    echo "  - Client private key: client1-authnID.key"
    echo "  - CA certificate: ca.crt"
    echo "  - Thumbprint for Azure Event Grid:"
    step certificate fingerprint client1-authnID.pem 2>/dev/null || echo "    (run 'step certificate fingerprint client1-authnID.pem' to get thumbprint)"
fi
