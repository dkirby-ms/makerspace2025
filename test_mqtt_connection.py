#!/usr/bin/env python3
"""
Test MQTT connection to Azure Event Grid using certificate authentication
"""
import ssl
import paho.mqtt.client as mqtt
import json
import time

# Connection parameters
MQTT_HOST = "makerspace-eventgrid.westus2-1.ts.eventgrid.azure.net"
MQTT_PORT = 8883
CLIENT_ID = "client1-authnID"
CERT_FILE = "client1-authnID.pem"
KEY_FILE = "client1-authnID.key"
CA_FILE = "intermediate_ca.crt"

def on_connect(client, userdata, flags, rc):
    """Callback for when the client receives a CONNACK response from the server."""
    if rc == 0:
        print("Connected successfully!")
        # Subscribe to test topic
        client.subscribe("devices/+/telemetry")
        print("Subscribed to devices/+/telemetry")
        
        # Publish a test message
        test_message = {
            "temperature": 25.5,
            "humidity": 60.2,
            "timestamp": "2025-06-17T21:30:00Z"
        }
        client.publish("devices/client1/telemetry", json.dumps(test_message))
        print("Published test message to devices/client1/telemetry")
        
    else:
        print(f"Failed to connect, return code {rc}")
        error_messages = {
            1: "Connection refused - incorrect protocol version",
            2: "Connection refused - invalid client identifier",
            3: "Connection refused - server unavailable", 
            4: "Connection refused - bad username or password",
            5: "Connection refused - not authorised"
        }
        print(f"Error: {error_messages.get(rc, 'Unknown error')}")

def on_message(client, userdata, msg):
    """Callback for when a PUBLISH message is received from the server."""
    print(f"Received message on topic {msg.topic}: {msg.payload.decode()}")

def on_publish(client, userdata, mid):
    """Callback for when a message is published."""
    print(f"Message published with id: {mid}")

def on_disconnect(client, userdata, rc):
    """Callback for when the client disconnects from the broker."""
    if rc != 0:
        print(f"Unexpected disconnection, return code: {rc}")
    else:
        print("Disconnected successfully")

def main():
    print("Testing MQTT connection to Azure Event Grid...")
    print(f"Host: {MQTT_HOST}")
    print(f"Port: {MQTT_PORT}")
    print(f"Client ID: {CLIENT_ID}")
    print(f"Certificate: {CERT_FILE}")
    print(f"CA Certificate: {CA_FILE}")
    print()
    
    # Create MQTT client
    client = mqtt.Client(client_id=CLIENT_ID)
    
    # Set callbacks
    client.on_connect = on_connect
    client.on_message = on_message
    client.on_publish = on_publish
    client.on_disconnect = on_disconnect
    
    # Configure TLS
    try:
        context = ssl.create_default_context(ssl.Purpose.SERVER_AUTH)
        context.check_hostname = True
        context.verify_mode = ssl.CERT_REQUIRED
        
        # Load CA certificate
        context.load_verify_locations(CA_FILE)
        
        # Load client certificate and key
        context.load_cert_chain(CERT_FILE, KEY_FILE)
        
        client.tls_set_context(context)
        
        print("TLS context configured successfully")
        
    except Exception as e:
        print(f"Error configuring TLS: {e}")
        return
    
    # Connect to broker
    try:
        print("Attempting to connect...")
        client.connect(MQTT_HOST, MQTT_PORT, 60)
        
        # Start the loop to process network traffic and dispatch callbacks
        client.loop_start()
        
        # Keep the script running for 10 seconds to allow message exchange
        time.sleep(10)
        
        # Stop the loop and disconnect
        client.loop_stop()
        client.disconnect()
        
    except Exception as e:
        print(f"Connection error: {e}")

if __name__ == "__main__":
    main()
