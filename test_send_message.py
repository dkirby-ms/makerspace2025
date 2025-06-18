#!/usr/bin/env python3
"""
Test script to send MQTT message from a different device
"""

import json
import time
import paho.mqtt.client as mqtt
from datetime import datetime

def send_test_message():
    # Load config
    with open('src/service_config.json', 'r') as f:
        config = json.load(f)
    
    mqtt_config = config['mqtt']
    
    # Create test message
    test_message = {
        "id": "test-message-001",
        "device_id": "test-device-002",
        "content": "Hello, can you help me understand BitNet?",
        "timestamp": datetime.now().isoformat(),
        "message_type": "general"
    }
    
    # Setup MQTT client
    client = mqtt.Client()
    
    # Configure TLS if needed
    if mqtt_config.get('use_tls', False):
        certfile = mqtt_config.get('certfile')
        keyfile = mqtt_config.get('keyfile')
        if certfile and keyfile:
            client.tls_set(certfile=certfile, keyfile=keyfile)
        else:
            client.tls_set()
    
    # Connect and publish
    client.connect(mqtt_config['broker'], mqtt_config['port'], mqtt_config['keepalive'])
    
    payload = json.dumps(test_message)
    result = client.publish(mqtt_config['topic'], payload)
    
    if result.rc == mqtt.MQTT_ERR_SUCCESS:
        print(f"Published test message: {test_message['content']}")
    else:
        print(f"Failed to publish message: {result.rc}")
    
    client.disconnect()

if __name__ == "__main__":
    send_test_message()
