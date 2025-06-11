#!/bin/bash
# Start the BitNet MQTT service

CONFIG_FILE="src/service_config.json"

if [ ! -f "$CONFIG_FILE" ]; then
    echo "Configuration file not found: $CONFIG_FILE"
    echo "Run ./install.sh first"
    exit 1
fi

echo "Starting BitNet MQTT Service..."
python3 src/bitnet_runner.py --config "$CONFIG_FILE" service
