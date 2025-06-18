#!/usr/bin/env python3
"""
Example IoT device client that registers with the certificate service
and connects to Azure Event Grid MQTT broker.
"""

import requests
import json
import ssl
import time
import paho.mqtt.client as mqtt
from pathlib import Path
import tempfile
import os


class MakerspaceIoTDevice:
    def __init__(self, device_id: str, cert_service_url: str):
        self.device_id = device_id
        self.cert_service_url = cert_service_url.rstrip('/')
        self.mqtt_client = None
        self.cert_files = {}
        
    def register_device(self) -> dict:
        """Register device and get certificate from certificate service."""
        print(f"Registering device: {self.device_id}")
        
        response = requests.post(
            f"{self.cert_service_url}/register-device",
            json={"deviceId": self.device_id},
            timeout=30
        )
        
        if response.status_code == 409:
            print("Device already registered")
            return self.get_device_status()
        elif response.status_code != 200:
            raise Exception(f"Registration failed: {response.status_code} - {response.text}")
        
        registration_data = response.json()
        print(f"Device registered successfully: {registration_data['clientName']}")
        
        # Save certificates to temporary files
        self._save_certificates(registration_data)
        
        return registration_data
    
    def get_device_status(self) -> dict:
        """Get device registration status."""
        response = requests.get(
            f"{self.cert_service_url}/device/{self.device_id}/status",
            timeout=10
        )
        
        if response.status_code == 404:
            raise Exception("Device not registered")
        elif response.status_code != 200:
            raise Exception(f"Status check failed: {response.status_code} - {response.text}")
        
        return response.json()
    
    def get_ca_certificate(self) -> str:
        """Download CA certificate."""
        response = requests.get(
            f"{self.cert_service_url}/ca-certificate",
            timeout=10
        )
        
        if response.status_code != 200:
            raise Exception(f"CA certificate download failed: {response.status_code}")
        
        return response.text
    
    def _save_certificates(self, registration_data: dict):
        """Save certificates to temporary files."""
        temp_dir = tempfile.mkdtemp(prefix=f"device_{self.device_id}_")
        
        # Save device certificate
        cert_path = Path(temp_dir) / "device_cert.pem"
        with open(cert_path, 'w') as f:
            f.write(registration_data['certificate'])
        
        # Save device private key
        key_path = Path(temp_dir) / "device_key.pem"
        with open(key_path, 'w') as f:
            f.write(registration_data['privateKey'])
        
        # Save CA certificate
        ca_cert = self.get_ca_certificate()
        ca_path = Path(temp_dir) / "ca_cert.pem"
        with open(ca_path, 'w') as f:
            f.write(ca_cert)
        
        self.cert_files = {
            'cert': str(cert_path),
            'key': str(key_path),
            'ca': str(ca_path),
            'temp_dir': temp_dir
        }
        
        print(f"Certificates saved to: {temp_dir}")
    
    def connect_mqtt(self, mqtt_hostname: str) -> bool:
        """Connect to MQTT broker using device certificate."""
        if not self.cert_files:
            raise Exception("No certificates available. Register device first.")
        
        print(f"Connecting to MQTT broker: {mqtt_hostname}")
        
        # Create SSL context
        context = ssl.create_default_context(ssl.Purpose.SERVER_AUTH)
        context.load_cert_chain(self.cert_files['cert'], self.cert_files['key'])
        context.load_verify_locations(self.cert_files['ca'])
        
        # Create MQTT client
        self.mqtt_client = mqtt.Client(self.device_id)
        self.mqtt_client.tls_set_context(context)
        
        # Set callbacks
        self.mqtt_client.on_connect = self._on_mqtt_connect
        self.mqtt_client.on_disconnect = self._on_mqtt_disconnect
        self.mqtt_client.on_message = self._on_mqtt_message
        
        try:
            self.mqtt_client.connect(mqtt_hostname, 8883, 60)
            self.mqtt_client.loop_start()
            
            # Wait for connection
            time.sleep(2)
            return True
            
        except Exception as e:
            print(f"MQTT connection failed: {e}")
            return False
    
    def _on_mqtt_connect(self, client, userdata, flags, rc):
        """MQTT connection callback."""
        if rc == 0:
            print("Connected to MQTT broker")
            # Subscribe to device command topic
            topic = f"devices/{self.device_id}/commands"
            client.subscribe(topic)
            print(f"Subscribed to: {topic}")
        else:
            print(f"MQTT connection failed with code: {rc}")
    
    def _on_mqtt_disconnect(self, client, userdata, rc):
        """MQTT disconnection callback."""
        print("Disconnected from MQTT broker")
    
    def _on_mqtt_message(self, client, userdata, msg):
        """MQTT message callback."""
        print(f"Received message on {msg.topic}: {msg.payload.decode()}")
    
    def publish_telemetry(self, data: dict):
        """Publish telemetry data."""
        if not self.mqtt_client:
            raise Exception("Not connected to MQTT broker")
        
        topic = f"devices/{self.device_id}/telemetry"
        payload = json.dumps(data)
        
        result = self.mqtt_client.publish(topic, payload)
        if result.rc == 0:
            print(f"Published to {topic}: {payload}")
        else:
            print(f"Failed to publish: {result.rc}")
    
    def publish_status(self, status: str):
        """Publish device status."""
        if not self.mqtt_client:
            raise Exception("Not connected to MQTT broker")
        
        topic = f"devices/{self.device_id}/status"
        payload = json.dumps({"status": status, "timestamp": time.time()})
        
        result = self.mqtt_client.publish(topic, payload)
        if result.rc == 0:
            print(f"Published status: {status}")
        else:
            print(f"Failed to publish status: {result.rc}")
    
    def cleanup(self):
        """Clean up resources."""
        if self.mqtt_client:
            self.mqtt_client.loop_stop()
            self.mqtt_client.disconnect()
        
        # Clean up temporary files
        if self.cert_files and 'temp_dir' in self.cert_files:
            import shutil
            shutil.rmtree(self.cert_files['temp_dir'], ignore_errors=True)
            print("Cleaned up temporary files")


def main():
    """Example usage of the MakerspaceIoTDevice."""
    
    # Configuration
    DEVICE_ID = "test-device-001"
    CERT_SERVICE_URL = "https://makerspace-cert-service.azurewebsites.net"
    MQTT_HOSTNAME = "makerspace-eventgrid.eastus-1.eventgrid.azure.net"
    
    device = MakerspaceIoTDevice(DEVICE_ID, CERT_SERVICE_URL)
    
    try:
        # Register device and get certificate
        registration = device.register_device()
        print(f"Registration: {json.dumps(registration, indent=2)}")
        
        # Connect to MQTT broker
        if device.connect_mqtt(MQTT_HOSTNAME):
            # Publish status
            device.publish_status("online")
            
            # Publish some telemetry data
            for i in range(5):
                telemetry = {
                    "temperature": 20 + i,
                    "humidity": 60 + i,
                    "timestamp": time.time()
                }
                device.publish_telemetry(telemetry)
                time.sleep(2)
            
            # Publish offline status
            device.publish_status("offline")
            
            # Keep connection alive for a bit
            time.sleep(5)
        
    except Exception as e:
        print(f"Error: {e}")
    
    finally:
        device.cleanup()


if __name__ == "__main__":
    main()
