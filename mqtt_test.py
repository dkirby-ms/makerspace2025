#!/usr/bin/env python3
"""
Simple MQTT test script to verify connectivity.
"""

import json
import time
import sys
from datetime import datetime
import paho.mqtt.client as mqtt

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("Connected to MQTT broker successfully")
        client.subscribe("bitnet/chat")
        print("Subscribed to topic: bitnet/chat")
    else:
        print(f"Failed to connect to MQTT broker: {rc}")

def on_message(client, userdata, msg):
    try:
        payload = json.loads(msg.payload.decode())
        timestamp = payload.get('timestamp', 'unknown')
        device_id = payload.get('device_id', 'unknown')
        content = payload.get('content', '')
        print(f"[{timestamp}] {device_id}: {content}")
    except:
        print(f"Raw message: {msg.payload.decode()}")

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 mqtt_test.py <broker_host> [port]")
        print("Example: python3 mqtt_test.py localhost 1883")
        sys.exit(1)
    
    broker = sys.argv[1]
    port = int(sys.argv[2]) if len(sys.argv) > 2 else 1883
    
    print(f"Connecting to MQTT broker: {broker}:{port}")
    
    client = mqtt.Client()
    client.on_connect = on_connect
    client.on_message = on_message
    
    try:
        client.connect(broker, port, 60)
        client.loop_start()
        
        print("Listening for messages... Press Ctrl+C to exit")
        
        # Send a test message after connection
        time.sleep(2)
        test_msg = {
            "id": "test-message",
            "device_id": "mqtt-test",
            "content": "MQTT connectivity test message",
            "timestamp": datetime.now().isoformat(),
            "message_type": "test"
        }
        client.publish("bitnet/chat", json.dumps(test_msg))
        print("Sent test message")
        
        while True:
            time.sleep(1)
            
    except KeyboardInterrupt:
        print("\nDisconnecting...")
        client.loop_stop()
        client.disconnect()
    except Exception as e:
        print(f"Error: {e}")

if __name__ == "__main__":
    main()
