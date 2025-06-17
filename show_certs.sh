#!/bin/bash
# Display certificate information for MQTT authentication

set -e

echo "Certificate Information"
echo "======================"

if [ -f "client1-authnID.pem" ]; then
    echo "✓ Client certificate found: client1-authnID.pem"
    
    if command -v step &> /dev/null; then
        echo "Certificate details:"
        step certificate inspect client1-authnID.pem --short
        echo ""
        echo "Thumbprint (for Azure Event Grid):"
        step certificate fingerprint client1-authnID.pem
    else
        echo "Install step-cli to view certificate details"
    fi
else
    echo "✗ Client certificate not found: client1-authnID.pem"
    echo "Run ./generate_certs.sh to create certificates"
fi

echo ""

if [ -f "client1-authnID.key" ]; then
    echo "✓ Client private key found: client1-authnID.key"
else
    echo "✗ Client private key not found: client1-authnID.key"
fi

if [ -f "ca.crt" ]; then
    echo "✓ CA certificate found: ca.crt"
else
    echo "✗ CA certificate not found: ca.crt"
fi

echo ""
echo "TLS Configuration in src/service_config.json:"
if [ -f "src/service_config.json" ]; then
    grep -A 10 '"mqtt"' src/service_config.json | grep -E '"use_tls"|"ca_certs"|"certfile"|"keyfile"' || echo "TLS settings not configured"
else
    echo "Configuration file not found"
fi
