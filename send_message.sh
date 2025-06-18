#!/bin/bash
# Send a test message to the MQTT topic

CONFIG_FILE="src/service_config.json"
MESSAGE="$1"

if [ ! -f "$CONFIG_FILE" ]; then
    echo "Configuration file not found: $CONFIG_FILE"
    echo "Run ./install.sh first"
    exit 1
fi

if [ -z "$MESSAGE" ]; then
    echo "Usage: $0 \"message to send\""
    exit 1
fi

echo "Sending message: $MESSAGE"
python3 src/bitnet_runner.py --config "$CONFIG_FILE" send "$MESSAGE"
