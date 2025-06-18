#!/usr/bin/env python3
"""
Simple MQTT listener to debug message flow
"""

import json
import paho.mqtt.client as mqtt

def on_connect(client, userdata, flags, rc):
    if rc == 0:
        print("Connected to MQTT broker")
        client.subscribe("devices/bitnet-device/telemetry")
        print("Subscribed to topic: devices/bitnet-device/telemetry")
    else:
        print(f"Failed to connect: {rc}")

def on_message(client, userdata, msg):
    print(f"Received message on topic {msg.topic}")
    print(f"Raw payload: {msg.payload.decode()}")
    try:
        data = json.loads(msg.payload.decode())
        print(f"Parsed JSON: {data}")
    except:
        print("Failed to parse as JSON")
    print("---")

def main():
    # Load config
    with open('src/service_config.json', 'r') as f:
        config = json.load(f)
    
    mqtt_config = config['mqtt']
    
    client = mqtt.Client()
    client.on_connect = on_connect
    client.on_message = on_message
    
    # Configure TLS
    if mqtt_config.get('use_tls', False):
        certfile = mqtt_config.get('certfile')
        keyfile = mqtt_config.get('keyfile')
        if certfile and keyfile:
            client.tls_set(certfile=certfile, keyfile=keyfile)
        else:
            client.tls_set()
    
    client.connect(mqtt_config['broker'], mqtt_config['port'], mqtt_config['keepalive'])
    
    print("Listening for messages... Press Ctrl+C to stop")
    try:
        client.loop_forever()
    except KeyboardInterrupt:
        print("Stopping...")
        client.disconnect()

if __name__ == "__main__":
    main()
