#!/bin/bash

# Stop BitNet MQTT Service
# This script stops the running BitNet MQTT service

CONFIG_FILE="src/service_config.json"
SERVICE_NAME="bitnet-mqtt"

echo "Stopping BitNet MQTT Service..."

# Check if running as systemd service
if systemctl is-active --quiet "$SERVICE_NAME" 2>/dev/null; then
    echo "Stopping systemd service..."
    sudo systemctl stop "$SERVICE_NAME"
    echo "Service stopped."
    exit 0
fi

# Check for running processes
PIDS=$(pgrep -f "bitnet_runner.py.*service")

if [ -z "$PIDS" ]; then
    echo "No BitNet MQTT service processes found running."
    exit 0
fi

echo "Found running service processes: $PIDS"
echo "Stopping processes..."

# Send SIGTERM first for graceful shutdown
for pid in $PIDS; do
    echo "Sending SIGTERM to process $pid..."
    kill -TERM "$pid" 2>/dev/null
done

# Wait for graceful shutdown
sleep 3

# Check if processes are still running
REMAINING_PIDS=$(pgrep -f "bitnet_runner.py.*service")

if [ -n "$REMAINING_PIDS" ]; then
    echo "Some processes still running, sending SIGKILL..."
    for pid in $REMAINING_PIDS; do
        echo "Sending SIGKILL to process $pid..."
        kill -KILL "$pid" 2>/dev/null
    done
    sleep 1
fi

# Final check
FINAL_PIDS=$(pgrep -f "bitnet_runner.py.*service")
if [ -z "$FINAL_PIDS" ]; then
    echo "All BitNet MQTT service processes stopped successfully."
else
    echo "Warning: Some processes may still be running: $FINAL_PIDS"
fi
