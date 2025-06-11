#!/bin/bash
# Script to install systemd service

set -e

if [[ $EUID -ne 0 ]]; then
   echo "This script must be run as root (use sudo)"
   exit 1
fi

SERVICE_FILE="/etc/systemd/system/bitnet-mqtt.service"

echo "Installing systemd service..."

# Copy service file
cp src/bitnet-mqtt.service "$SERVICE_FILE"

# Update paths in service file to absolute paths
CURRENT_DIR=$(pwd)
sed -i "s|WorkingDirectory=.*|WorkingDirectory=$CURRENT_DIR|g" "$SERVICE_FILE"
sed -i "s|ExecStart=.*|ExecStart=/usr/bin/python3 $CURRENT_DIR/src/bitnet_runner.py --config $CURRENT_DIR/src/service_config.json service|g" "$SERVICE_FILE"
sed -i "s|Environment=PYTHONPATH=.*|Environment=PYTHONPATH=$CURRENT_DIR|g" "$SERVICE_FILE"

# Reload systemd
systemctl daemon-reload

# Enable service
systemctl enable bitnet-mqtt.service

echo "Systemd service installed successfully!"
echo ""
echo "Service commands:"
echo "  Start:   sudo systemctl start bitnet-mqtt"
echo "  Stop:    sudo systemctl stop bitnet-mqtt"
echo "  Status:  sudo systemctl status bitnet-mqtt"
echo "  Logs:    sudo journalctl -u bitnet-mqtt -f"
