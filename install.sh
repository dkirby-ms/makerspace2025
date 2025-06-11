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
echo "2. Test the service: python3 src/bitnet_runner.py --config src/service_config.json test 'Hello world'"
echo "3. Run the service: python3 src/bitnet_runner.py --config src/service_config.json service"
echo "4. For systemd service installation (optional): sudo ./install_systemd.sh"
