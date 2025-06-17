#!/usr/bin/env python3

import json
import ssl
import time
import paho.mqtt.client as mqtt
from datetime import datetime
import argparse
import os

class EventGridMqttClient:
    def __init__(self, config_file="mqtt_config.json", device_id="pi-device-01"):
        """Initialize MQTT client for Event Grid broker"""
        self.device_id = device_id
        self.config = self.load_config(config_file)
        self.client = None
        
    def load_config(self, config_file):
        """Load MQTT configuration from JSON file"""
        try:
            with open(config_file, 'r') as f:
                return json.load(f)
        except FileNotFoundError:
            print(f"Configuration file {config_file} not found.")
            print("Please run deploy_eventgrid_mqtt.sh first to create the configuration.")
            exit(1)
    
    def on_connect(self, client, userdata, flags, rc):
        """Callback for when the client connects to the broker"""
        if rc == 0:
            print(f"Connected successfully to Event Grid MQTT broker")
            # Subscribe to device command topic
            command_topic = self.config["mqtt_broker"]["topics"]["commands"].format(device_id=self.device_id)
            client.subscribe(command_topic)
            print(f"Subscribed to: {command_topic}")
        else:
            print(f"Failed to connect, return code {rc}")
    
    def on_disconnect(self, client, userdata, rc):
        """Callback for when the client disconnects"""
        print(f"Disconnected from MQTT broker, return code {rc}")
    
    def on_message(self, client, userdata, msg):
        """Callback for when a message is received"""
        print(f"Received message on {msg.topic}: {msg.payload.decode()}")
    
    def on_publish(self, client, userdata, mid):
        """Callback for when a message is published"""
        print(f"Message published (mid: {mid})")
    
    def setup_tls(self):
        """Configure TLS/SSL for secure connection"""
        broker_config = self.config["mqtt_broker"]
        device_certs = broker_config["client_certificates"][self.device_id]
        
        # Check if certificate files exist
        cert_file = device_certs["cert"]
        key_file = device_certs["key"]
        ca_file = broker_config["ca_certificate"]
        
        for file_path in [cert_file, key_file, ca_file]:
            if not os.path.exists(file_path):
                print(f"Certificate file not found: {file_path}")
                print("Please run generate_certificates.sh first.")
                exit(1)
        
        # Configure TLS context
        context = ssl.create_default_context(ssl.Purpose.SERVER_AUTH)
        context.load_verify_locations(ca_file)
        context.load_cert_chain(cert_file, key_file)
        context.check_hostname = False
        context.verify_mode = ssl.CERT_REQUIRED
        
        self.client.tls_set_context(context)
        print(f"TLS configured with certificates for {self.device_id}")
    
    def connect(self):
        """Connect to the MQTT broker"""
        broker_config = self.config["mqtt_broker"]
        
        # Create MQTT client
        self.client = mqtt.Client(client_id=self.device_id)
        
        # Set callbacks
        self.client.on_connect = self.on_connect
        self.client.on_disconnect = self.on_disconnect
        self.client.on_message = self.on_message
        self.client.on_publish = self.on_publish
        
        # Setup TLS
        self.setup_tls()
        
        # Connect to broker
        hostname = broker_config["hostname"]
        port = broker_config["port"]
        
        print(f"Connecting to {hostname}:{port} as {self.device_id}")
        self.client.connect(hostname, port, 60)
        
        # Start network loop
        self.client.loop_start()
    
    def publish_telemetry(self, data):
        """Publish telemetry data"""
        if not self.client:
            print("Not connected to broker")
            return
        
        topic = self.config["mqtt_broker"]["topics"]["telemetry"].format(device_id=self.device_id)
        
        # Add timestamp to data
        telemetry_data = {
            "device_id": self.device_id,
            "timestamp": datetime.utcnow().isoformat(),
            "data": data
        }
        
        payload = json.dumps(telemetry_data)
        result = self.client.publish(topic, payload, qos=1)
        
        if result.rc == mqtt.MQTT_ERR_SUCCESS:
            print(f"Published telemetry to {topic}")
        else:
            print(f"Failed to publish telemetry, error: {result.rc}")
    
    def publish_status(self, status):
        """Publish device status"""
        if not self.client:
            print("Not connected to broker")
            return
        
        topic = self.config["mqtt_broker"]["topics"]["status"].format(device_id=self.device_id)
        
        status_data = {
            "device_id": self.device_id,
            "timestamp": datetime.utcnow().isoformat(),
            "status": status
        }
        
        payload = json.dumps(status_data)
        result = self.client.publish(topic, payload, qos=1)
        
        if result.rc == mqtt.MQTT_ERR_SUCCESS:
            print(f"Published status to {topic}")
        else:
            print(f"Failed to publish status, error: {result.rc}")
    
    def disconnect(self):
        """Disconnect from the broker"""
        if self.client:
            self.client.loop_stop()
            self.client.disconnect()

def main():
    parser = argparse.ArgumentParser(description='Test Event Grid MQTT broker connection')
    parser.add_argument('--device-id', default='pi-device-01', 
                       choices=['pi-device-01', 'pi-device-02', 'pi-device-03', 'mqtt-explorer'],
                       help='Device ID to use for connection')
    parser.add_argument('--config', default='mqtt_config.json',
                       help='MQTT configuration file')
    parser.add_argument('--mode', choices=['telemetry', 'status', 'listen'], default='telemetry',
                       help='Test mode: send telemetry, send status, or listen for messages')
    
    args = parser.parse_args()
    
    # Create MQTT client
    client = EventGridMqttClient(config_file=args.config, device_id=args.device_id)
    
    try:
        # Connect to broker
        client.connect()
        time.sleep(2)  # Wait for connection
        
        if args.mode == 'telemetry':
            # Send sample telemetry data
            sample_data = {
                "temperature": 23.5,
                "humidity": 45.2,
                "pressure": 1013.25,
                "motion_detected": False
            }
            client.publish_telemetry(sample_data)
            
        elif args.mode == 'status':
            # Send status update
            client.publish_status("online")
            
        elif args.mode == 'listen':
            print("Listening for messages. Press Ctrl+C to exit...")
            try:
                while True:
                    time.sleep(1)
            except KeyboardInterrupt:
                print("\nStopping...")
        
        time.sleep(2)  # Wait for messages to be sent
        
    except Exception as e:
        print(f"Error: {e}")
    finally:
        client.disconnect()

if __name__ == "__main__":
    main()
