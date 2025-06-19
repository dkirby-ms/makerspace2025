#!/usr/bin/env python3
"""
Enhanced example IoT device client that registers with the certificate service
and demonstrates the new app deployment feature.
"""

import requests
import json
import ssl
import time
import paho.mqtt.client as mqtt
from pathlib import Path
import tempfile
import os


class EnhancedMakerspaceIoTDevice:
    def __init__(self, device_id: str, cert_service_url: str):
        self.device_id = device_id
        self.cert_service_url = cert_service_url.rstrip('/')
        self.mqtt_client = None
        self.cert_files = {}
        self.app_deployment_info = None
        
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
        
        # Check app deployment status
        if 'appDeployment' in registration_data:
            self.app_deployment_info = registration_data['appDeployment']
            self._handle_app_deployment()
        
        # Save certificates to temporary files
        self._save_certificates(registration_data)
        
        return registration_data
    
    def _handle_app_deployment(self):
        """Handle app deployment information from registration response."""
        app_info = self.app_deployment_info
        
        if not app_info['enabled']:
            print("📱 App deployment is disabled on the server")
            return
            
        if app_info['status'] == 'deployed':
            print(f"✅ App deployment successful!")
            print(f"   Deployment ID: {app_info['deploymentId']}")
            print(f"   Message: {app_info['message']}")
            
            if app_info.get('appPath'):
                print(f"   App package: {app_info['appPath']}")
                
            if app_info.get('configFiles'):
                print(f"   Config files created: {len(app_info['configFiles'])}")
                for config_file in app_info['configFiles']:
                    print(f"     - {config_file}")
                    
            print("\n📋 Next steps:")
            print("   1. Download the app package from the provided path")
            print("   2. Extract the package to your device")
            print("   3. Copy the device certificates to the certs/ directory")
            print("   4. Run 'npm start' to start the bitnet_runner app")
            
        elif app_info['status'] == 'failed':
            print(f"❌ App deployment failed!")
            print(f"   Deployment ID: {app_info['deploymentId']}")
            print(f"   Error: {app_info['message']}")
            print("   You can try manual deployment using the manual deploy endpoint")
            
    def deploy_app_manually(self) -> dict:
        """Manually trigger app deployment for this device."""
        print(f"Manually deploying app for device: {self.device_id}")
        
        response = requests.post(
            f"{self.cert_service_url}/device/{self.device_id}/deploy-app",
            json={},  # Use default settings
            timeout=60  # App deployment can take longer
        )
        
        if response.status_code != 200:
            raise Exception(f"Manual deployment failed: {response.status_code} - {response.text}")
        
        deployment_data = response.json()
        print(f"Manual deployment result: {'SUCCESS' if deployment_data['success'] else 'FAILED'}")
        
        return deployment_data
    
    def get_app_status(self) -> dict:
        """Get app deployment status for this device."""
        response = requests.get(
            f"{self.cert_service_url}/device/{self.device_id}/app-status",
            timeout=30
        )
        
        if response.status_code != 200:
            raise Exception(f"Failed to get app status: {response.status_code} - {response.text}")
        
        return response.json()
    
    def get_device_status(self) -> dict:
        """Get device registration status."""
        response = requests.get(
            f"{self.cert_service_url}/device/{self.device_id}/status",
            timeout=30
        )
        
        if response.status_code != 200:
            raise Exception(f"Failed to get device status: {response.status_code} - {response.text}")
        
        return response.json()
    
    def _save_certificates(self, registration_data: dict):
        """Save certificates to temporary files for MQTT connection."""
        # Create temporary directory for certificates
        cert_dir = tempfile.mkdtemp(prefix=f"makerspace_{self.device_id}_")
        
        # Save device certificate
        cert_path = os.path.join(cert_dir, 'device.crt')
        with open(cert_path, 'w') as f:
            f.write(registration_data['certificate'])
        
        # Save device private key
        key_path = os.path.join(cert_dir, 'device.key')
        with open(key_path, 'w') as f:
            f.write(registration_data['privateKey'])
        
        # Save CA certificate if provided
        ca_path = None
        if 'caCertificate' in registration_data:
            ca_path = os.path.join(cert_dir, 'ca.crt')
            with open(ca_path, 'w') as f:
                f.write(registration_data['caCertificate'])
        
        self.cert_files = {
            'cert': cert_path,
            'key': key_path,
            'ca': ca_path,
            'dir': cert_dir
        }
        
        print(f"Certificates saved to: {cert_dir}")
    
    def connect_mqtt(self, registration_data: dict) -> bool:
        """Connect to MQTT broker using device certificates."""
        if not self.cert_files:
            raise Exception("Certificates not available. Register device first.")
        
        mqtt_hostname = registration_data['mqttHostname'].replace('{region}', 'westus2')
        mqtt_port = registration_data['instructions']['port']
        
        print(f"Connecting to MQTT broker: {mqtt_hostname}:{mqtt_port}")
        
        # Create SSL context
        ssl_context = ssl.create_default_context(ssl.Purpose.SERVER_AUTH)
        ssl_context.load_cert_chain(self.cert_files['cert'], self.cert_files['key'])
        
        if self.cert_files['ca']:
            ssl_context.load_verify_locations(self.cert_files['ca'])
        
        # Create MQTT client
        self.mqtt_client = mqtt.Client(
            client_id=registration_data['clientName'],
            protocol=mqtt.MQTTv5
        )
        
        # Set SSL context
        self.mqtt_client.tls_set_context(ssl_context)
        
        # Set callbacks
        self.mqtt_client.on_connect = self._on_connect
        self.mqtt_client.on_message = self._on_message
        self.mqtt_client.on_disconnect = self._on_disconnect
        
        try:
            # Connect to broker
            self.mqtt_client.connect(mqtt_hostname, mqtt_port, 60)
            self.mqtt_client.loop_start()
            
            # Wait for connection
            time.sleep(2)
            
            return True
            
        except Exception as e:
            print(f"MQTT connection failed: {e}")
            return False
    
    def _on_connect(self, client, userdata, flags, rc, properties=None):
        """Callback for successful MQTT connection."""
        if rc == 0:
            print("✅ Connected to MQTT broker successfully")
            
            # Subscribe to device command topic
            command_topic = f"devices/{self.device_id}/commands"
            client.subscribe(command_topic, qos=1)
            print(f"Subscribed to: {command_topic}")
            
            # Publish initial telemetry
            self.publish_telemetry({"status": "connected", "app_deployment": self.app_deployment_info})
            
        else:
            print(f"❌ Failed to connect to MQTT broker. Return code: {rc}")
    
    def _on_message(self, client, userdata, msg):
        """Callback for received MQTT messages."""
        try:
            topic = msg.topic
            payload = json.loads(msg.payload.decode())
            print(f"📨 Received message on {topic}: {payload}")
            
            # Handle commands
            if topic.endswith('/commands'):
                self._handle_command(payload)
                
        except Exception as e:
            print(f"Error processing message: {e}")
    
    def _on_disconnect(self, client, userdata, rc):
        """Callback for MQTT disconnection."""
        print(f"🔌 Disconnected from MQTT broker. Return code: {rc}")
    
    def _handle_command(self, command: dict):
        """Handle received commands."""
        command_type = command.get('type', 'unknown')
        
        if command_type == 'ping':
            print("🏓 Received ping command")
            self.publish_telemetry({"response": "pong", "timestamp": time.time()})
            
        elif command_type == 'status':
            print("📊 Received status request")
            self.publish_telemetry({
                "device_id": self.device_id,
                "status": "online",
                "app_deployment": self.app_deployment_info,
                "timestamp": time.time()
            })
            
        else:
            print(f"❓ Unknown command type: {command_type}")
    
    def publish_telemetry(self, data: dict):
        """Publish telemetry data to MQTT broker."""
        if not self.mqtt_client or not self.mqtt_client.is_connected():
            print("⚠️ MQTT client not connected")
            return
        
        topic = f"devices/{self.device_id}/telemetry"
        payload = json.dumps({
            **data,
            "device_id": self.device_id,
            "timestamp": time.time()
        })
        
        result = self.mqtt_client.publish(topic, payload, qos=1)
        print(f"📤 Published telemetry to {topic}")
    
    def cleanup(self):
        """Cleanup resources."""
        if self.mqtt_client:
            self.mqtt_client.loop_stop()
            self.mqtt_client.disconnect()
        
        # Remove temporary certificate files
        if self.cert_files and self.cert_files['dir']:
            import shutil
            shutil.rmtree(self.cert_files['dir'], ignore_errors=True)
            print("Cleaned up temporary certificates")


def main():
    """Example usage of the enhanced device client."""
    import argparse
    
    parser = argparse.ArgumentParser(description='Enhanced Makerspace IoT Device Client with App Deployment')
    parser.add_argument('--device-id', required=True, help='Device ID')
    parser.add_argument('--cert-service', default='http://localhost:3000', help='Certificate service URL')
    parser.add_argument('--no-mqtt', action='store_true', help='Skip MQTT connection')
    parser.add_argument('--manual-deploy', action='store_true', help='Trigger manual app deployment')
    parser.add_argument('--app-status', action='store_true', help='Check app deployment status')
    
    args = parser.parse_args()
    
    device = EnhancedMakerspaceIoTDevice(args.device_id, args.cert_service)
    
    try:
        if args.app_status:
            print("📱 Checking app deployment status...")
            status = device.get_app_status()
            print(json.dumps(status, indent=2))
            return
            
        if args.manual_deploy:
            print("🚀 Triggering manual app deployment...")
            result = device.deploy_app_manually()
            print(json.dumps(result, indent=2))
            return
        
        # Register device (includes automatic app deployment if enabled)
        registration_data = device.register_device()
        print("\n✅ Device registration completed")
        
        if not args.no_mqtt:
            print("\n🔌 Connecting to MQTT broker...")
            if device.connect_mqtt(registration_data):
                print("\n🎉 Device is online and ready!")
                print("Press Ctrl+C to disconnect...")
                
                # Send periodic telemetry
                try:
                    while True:
                        time.sleep(30)
                        device.publish_telemetry({
                            "temperature": 22.5,
                            "humidity": 45.2,
                            "uptime": time.time()
                        })
                        
                except KeyboardInterrupt:
                    print("\n👋 Shutting down...")
            else:
                print("❌ Failed to connect to MQTT broker")
        
    except Exception as e:
        print(f"❌ Error: {e}")
        
    finally:
        device.cleanup()


if __name__ == "__main__":
    main()
