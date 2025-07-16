#!/bin/bash

set -e

echo "Setting up Makerspace 2025 development environment..."

# Verify step-cli is available (installed via devcontainer feature)
echo "Verifying step-cli installation..."
if command -v step &> /dev/null; then
    echo "step-cli is available: $(step version)"
else
    echo "Warning: step-cli not found, installing manually..."
    wget -O step.deb https://dl.smallstep.com/gh-release/cli/docs-cli-install/v0.25.2/step-cli_0.25.2_amd64.deb
    sudo dpkg -i step.deb
    rm step.deb
fi

# Verify mosquitto is available (installed via Dockerfile)
echo "Verifying mosquitto installation..."
if command -v mosquitto_pub &> /dev/null; then
    echo "mosquitto is available"
else
    echo "Warning: mosquitto not found, installing..."
    sudo apt-get update
    sudo apt-get install -y mosquitto mosquitto-clients
fi

# Verify Node.js version
echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"

# Install Node.js dependencies for cert-service
echo "Installing Node.js dependencies..."
cd /workspace/cert-service
npm install

# Make scripts executable
echo "Making scripts executable..."
chmod +x /workspace/*.sh
chmod +x /workspace/.devcontainer/setup.sh

# Source environment variables if .env.test exists
if [ -f "/workspace/.env.test" ]; then
    echo "Environment file found. You can source it with: source .env.test"
fi

# Create certificates directory if it doesn't exist
mkdir -p /workspace/certs

echo "Development environment setup complete!"
echo ""
echo "Available commands:"
echo "  - step: Certificate management"
echo "  - mosquitto_pub/mosquitto_sub: MQTT client tools"
echo "  - npm: Node.js package management"
echo "  - az: Azure CLI"
echo ""
echo "To get started:"
echo "  1. Source environment variables: source .env.test"
echo "  2. Navigate to cert-service: cd cert-service"
echo "  3. Start development server: npm run dev"
