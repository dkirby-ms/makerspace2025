#!/bin/bash

# Uninstall BitNet MQTT Service
# This script removes all components of the BitNet MQTT service

SERVICE_NAME="bitnet-mqtt"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"
USER_SERVICE_FILE="$HOME/.config/systemd/user/${SERVICE_NAME}.service"

echo "Uninstalling BitNet MQTT Service..."
echo "======================================="

# Stop the service first
echo "1. Stopping service..."
./stop_service.sh

# Remove systemd service if it exists
if [ -f "$SERVICE_FILE" ]; then
    echo "2. Removing system-wide systemd service..."
    sudo systemctl disable "$SERVICE_NAME" 2>/dev/null
    sudo rm -f "$SERVICE_FILE"
    sudo systemctl daemon-reload
    echo "   System service removed."
elif [ -f "$USER_SERVICE_FILE" ]; then
    echo "2. Removing user systemd service..."
    systemctl --user disable "$SERVICE_NAME" 2>/dev/null
    rm -f "$USER_SERVICE_FILE"
    systemctl --user daemon-reload
    echo "   User service removed."
else
    echo "2. No systemd service found to remove."
fi

# Remove Python dependencies (optional)
read -p "3. Remove Python dependencies? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "   Removing Python packages..."
    if [ -f "requirements.txt" ]; then
        pip3 uninstall -y -r requirements.txt 2>/dev/null || echo "   Some packages may not have been installed via pip"
    fi
    echo "   Python dependencies removed."
else
    echo "   Skipping Python dependency removal."
fi

# Clean up log files
echo "4. Cleaning up log files..."
find . -name "*.log" -type f -delete 2>/dev/null
find . -name "service.log*" -type f -delete 2>/dev/null
echo "   Log files cleaned."

# Clean up temporary files
echo "5. Cleaning up temporary files..."
find . -name "*.pyc" -type f -delete 2>/dev/null
find . -name "__pycache__" -type d -exec rm -rf {} + 2>/dev/null
find . -name ".bitnet_*" -type f -delete 2>/dev/null
echo "   Temporary files cleaned."

# Remove configuration backups (optional)
if ls src/*.json.bak 1> /dev/null 2>&1; then
    read -p "6. Remove configuration backups? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -f src/*.json.bak
        echo "   Configuration backups removed."
    else
        echo "   Keeping configuration backups."
    fi
else
    echo "6. No configuration backups found."
fi

# Remove device-specific generated configs (optional)
if ls src/*_device_*.json 1> /dev/null 2>&1; then
    read -p "7. Remove generated device configurations? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        rm -f src/*_device_*.json
        echo "   Generated device configurations removed."
    else
        echo "   Keeping generated device configurations."
    fi
else
    echo "7. No generated device configurations found."
fi

# Verify uninstallation
echo "8. Verifying uninstallation..."

# Check for running processes
RUNNING_PIDS=$(pgrep -f "bitnet_runner.py" 2>/dev/null)
if [ -n "$RUNNING_PIDS" ]; then
    echo "   Warning: BitNet processes still running: $RUNNING_PIDS"
else
    echo "   ✓ No BitNet processes running"
fi

# Check systemd services
if systemctl list-units --all | grep -q "$SERVICE_NAME"; then
    echo "   Warning: systemd service may still be registered"
else
    echo "   ✓ No systemd service found"
fi

echo ""
echo "Uninstallation completed!"
echo "======================================="
echo ""
echo "The following items were preserved:"
echo "- Source code and scripts"
echo "- Main configuration files (src/service_config.json)"
echo "- BitNet repository (if external)"
echo ""
echo "To completely remove the project:"
echo "  rm -rf /path/to/makerspace2025"
echo ""
echo "To reinstall:"
echo "  ./install.sh"
