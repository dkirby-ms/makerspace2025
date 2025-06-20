#!/usr/bin/env python3
"""
Enhanced Makerspace IoT Device Client with App Deployment Support
Handles device enrollment, certificate management, and MQTT connectivity
"""

import os
import os
import json
import time
import ssl
import logging
import requests
import threading
from pathlib import Path
from typing import Dict, Any, Optional
from dataclasses import dataclass, asdict
from device_config import ConfigManager, DeviceConfig
import paho.mqtt.client as mqtt


@dataclass
class RegistrationResponse:
    """Device registration response from certificate service"""
    success: bool
    deviceId: str  # Server sends camelCase
    registration: Dict[str, Any]
    certificate: Dict[str, str]
    
    @property
    def device_id(self) -> str:
        """Provide snake_case property for Python conventions"""
        return self.deviceId
    
    @property
    def authentication_name(self) -> str:
        """Extract authentication name from registration"""
        return self.registration.get('authenticationName', '')
    
    @property
    def client_name(self) -> str:
        """Extract client name from registration"""
        return self.registration.get('clientName', '')
    
    @property
    def certificate_pem(self) -> str:
        """Extract certificate PEM from certificate"""
        return self.certificate.get('certificate', '')
    
    @property
    def private_key_pem(self) -> str:
        """Extract private key PEM from certificate"""
        return self.certificate.get('privateKey', '')
    
    @property
    def public_key_pem(self) -> str:
        """Extract public key PEM from certificate"""
        return self.certificate.get('publicKey', '')
    
    # Legacy properties for backward compatibility
    @property
    def certificate_data(self) -> str:
        return self.certificate_pem
    
    @property
    def private_key(self) -> str:
        return self.private_key_pem
    
    @property
    def ca_certificate(self) -> str:
        # CA certificate would need to be fetched separately
        return ""
    
    @property
    def validity_days(self) -> int:
        # Default validity, could be extracted from certificate if needed
        return 365
    
    @property
    def mqtt_hostname(self) -> str:
        """Extract MQTT hostname from registration"""
        return self.registration.get('mqttHostname', '')
    
    @property
    def app_deployment(self) -> Dict[str, Any]:
        """Extract app deployment info from registration"""
        return self.registration.get('appDeployment', {})
    
    @property
    def ca_certificate_url(self) -> str:
        """CA certificate URL - will be set separately by the client"""
        return ""
    
    @property
    def instructions(self) -> Dict[str, Any]:
        # Default MQTT instructions
        return {
            "message": "Use the provided certificate and private key for MQTT authentication",
            "port": 8883,
            "protocol": "mqtts"
        }


class EnhancedMakerspaceIoTDevice:
    """Enhanced IoT device client with enrollment and app deployment support"""
    
    def __init__(self, device_id: str, cert_service_url: str, cert_dir: str = "./certs"):
        self.device_id = device_id
        self.cert_service_url = cert_service_url.rstrip('/')
        self.cert_dir = Path(cert_dir)
        self.mqtt_client: Optional[mqtt.Client] = None
        self.registration_data: Optional[RegistrationResponse] = None
        self.ca_certificate_pem: str = ""
        self.is_connected = False
        self.telemetry_thread: Optional[threading.Thread] = None
        self.stop_telemetry = threading.Event()
        
        # Setup logging
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
        )
        self.logger = logging.getLogger(f"MakerspaceDevice-{device_id}")
        
        # Ensure certificate directory exists
        self.cert_dir.mkdir(parents=True, exist_ok=True)
        
        # Certificate file paths
        self.cert_file = self.cert_dir / "device.crt"
        self.key_file = self.cert_dir / "device.key"
        self.ca_file = self.cert_dir / "ca.crt"
        
    def register_device(self) -> RegistrationResponse:
        """Register device with certificate service and get certificates"""
        self.logger.info(f"Registering device {self.device_id} with certificate service")
        
        try:
            # Check if already registered and certificates exist
            if self._certificates_exist():
                self.logger.info("Certificates already exist, attempting to use existing registration")
                if self._load_existing_registration():
                    return self.registration_data
            
            # Register with certificate service
            registration_url = f"{self.cert_service_url}/register-device"
            payload = {"deviceId": self.device_id}  # Server expects camelCase
            
            self.logger.info(f"Calling registration endpoint: {registration_url}")
            response = requests.post(
                registration_url,
                json=payload,
                headers={"Content-Type": "application/json"},
                timeout=30
            )
            
            if response.status_code == 200:
                data = response.json()
                self.registration_data = RegistrationResponse(**data)
                
                # Fetch CA certificate separately
                ca_cert = self._fetch_ca_certificate()
                if ca_cert:
                    self.ca_certificate_pem = ca_cert
                
                # Save certificates and registration data
                self._save_certificates()
                self._save_registration_data()
                self.logger.info("Device registration successful")
                return self.registration_data
                
            elif response.status_code == 409:
                self.logger.warning("Device already registered, attempting to retrieve existing data")
                if self._load_existing_registration():
                    return self.registration_data
                else:
                    raise Exception("Device already registered but cannot retrieve existing data")
            else:
                error_msg = f"Registration failed with status {response.status_code}: {response.text}"
                self.logger.error(error_msg)
                raise Exception(error_msg)
                
        except requests.RequestException as e:
            error_msg = f"Network error during registration: {str(e)}"
            self.logger.error(error_msg)
            raise Exception(error_msg)
    
    def _fetch_ca_certificate(self) -> str:
        """Fetch CA certificate from the service"""
        try:
            ca_url = f"{self.cert_service_url}/ca-certificate"
            response = requests.get(ca_url, timeout=10)
            if response.status_code == 200:
                return response.text
            else:
                self.logger.warning(f"Failed to fetch CA certificate: {response.status_code}")
                return ""
        except Exception as e:
            self.logger.warning(f"Error fetching CA certificate: {e}")
            return ""
            
    def _certificates_exist(self) -> bool:
        """Check if certificate files exist"""
        return all([
            self.cert_file.exists(),
            self.key_file.exists(),
            self.ca_file.exists()
        ])
        
    def _save_certificates(self):
        """Save certificates to files"""
        if not self.registration_data:
            raise Exception("No registration data available")
            
        # Save device certificate
        with open(self.cert_file, 'w') as f:
            f.write(self.registration_data.certificate_pem)
            
        # Save private key
        with open(self.key_file, 'w') as f:
            f.write(self.registration_data.private_key_pem)
            
        # Save CA certificate if available
        if self.ca_certificate_pem:
            with open(self.ca_file, 'w') as f:
                f.write(self.ca_certificate_pem)
        else:
            self.logger.warning("CA certificate not available")
            
        # Set appropriate permissions
        os.chmod(self.key_file, 0o600)  # Private key should be readable only by owner
        os.chmod(self.cert_file, 0o644)
        if self.ca_file.exists():
            os.chmod(self.ca_file, 0o644)
        
        self.logger.info(f"Certificates saved to {self.cert_dir}")
        
    def _save_registration_data(self):
        """Save registration data to file for future use"""
        if not self.registration_data:
            return
            
        registration_file = self.cert_dir / "registration.json"
        with open(registration_file, 'w') as f:
            json.dump(asdict(self.registration_data), f, indent=2)
            
    def _load_existing_registration(self) -> bool:
        """Load existing registration data from file"""
        registration_file = self.cert_dir / "registration.json"
        
        if not registration_file.exists():
            return False
            
        try:
            with open(registration_file, 'r') as f:
                data = json.load(f)
                self.registration_data = RegistrationResponse(**data)
                self.logger.info("Loaded existing registration data")
                return True
        except Exception as e:
            self.logger.warning(f"Failed to load existing registration: {e}")
            return False
            
    def connect_mqtt(self, mqtt_hostname: str = None) -> bool:
        """Connect to MQTT broker using device certificates"""
        if not self.registration_data:
            raise Exception("Device not registered. Call register_device() first.")
            
        if not self._certificates_exist():
            raise Exception("Certificate files not found")
        
        # Determine MQTT hostname
        if mqtt_hostname:
            broker_hostname = mqtt_hostname
        else:
            # Try to get from environment or construct from service URL
            broker_hostname = os.getenv('MQTT_HOSTNAME')
            if not broker_hostname:
                # Construct default hostname (this should be configured properly)
                self.logger.warning("MQTT hostname not provided, using default pattern")
                broker_hostname = "makerspace-eventgrid.westus2-1.ts.eventgrid.azure.net"
            
        try:
            # Create MQTT client
            self.mqtt_client = mqtt.Client(
                client_id=self.registration_data.client_name,
                protocol=mqtt.MQTTv311
            )
            
            # Setup SSL/TLS
            context = ssl.create_default_context(ssl.Purpose.SERVER_AUTH)
            context.check_hostname = False
            context.verify_mode = ssl.CERT_REQUIRED
            context.load_verify_locations(str(self.ca_file))
            context.load_cert_chain(str(self.cert_file), str(self.key_file))
            
            self.mqtt_client.tls_set_context(context)
            
            # Setup callbacks
            self.mqtt_client.on_connect = self._on_connect
            self.mqtt_client.on_disconnect = self._on_disconnect
            self.mqtt_client.on_message = self._on_message
            self.mqtt_client.on_log = self._on_log
            
            # Connect to broker
            port = 8883  # Default MQTTS port
            self.logger.info(f"Connecting to MQTT broker {broker_hostname}:{port}")
            
            self.mqtt_client.connect(broker_hostname, port, 60)
            self.mqtt_client.loop_start()
            
            # Wait for connection
            timeout = 10
            start_time = time.time()
            while not self.is_connected and (time.time() - start_time) < timeout:
                time.sleep(0.1)
                
            if self.is_connected:
                self.logger.info("MQTT connection established")
                return True
            else:
                self.logger.error("MQTT connection timeout")
                return False
                
        except Exception as e:
            self.logger.error(f"MQTT connection failed: {e}")
            return False
            
    def _on_connect(self, client, userdata, flags, rc):
        """MQTT connect callback"""
        if rc == 0:
            self.is_connected = True
            self.logger.info("MQTT connected successfully")
            
            # Subscribe to device command topics
            command_topic = f"devices/{self.device_id}/commands"
            client.subscribe(command_topic)
            self.logger.info(f"Subscribed to {command_topic}")
        else:
            self.logger.error(f"MQTT connection failed with code {rc}")
            
    def _on_disconnect(self, client, userdata, rc):
        """MQTT disconnect callback"""
        self.is_connected = False
        if rc != 0:
            self.logger.warning(f"Unexpected MQTT disconnection: {rc}")
        else:
            self.logger.info("MQTT disconnected")
            
    def _on_message(self, client, userdata, msg):
        """MQTT message callback"""
        try:
            topic = msg.topic
            payload = msg.payload.decode('utf-8')
            self.logger.info(f"Received message on {topic}: {payload}")
            
            # Handle commands
            if topic.endswith('/commands'):
                self._handle_command(payload)
                
        except Exception as e:
            self.logger.error(f"Error processing message: {e}")
            
    def _on_log(self, client, userdata, level, buf):
        """MQTT log callback"""
        self.logger.debug(f"MQTT Log: {buf}")
        
    def _handle_command(self, command_payload: str):
        """Handle incoming commands"""
        try:
            command = json.loads(command_payload)
            cmd_type = command.get('type', 'unknown')
            
            self.logger.info(f"Processing command: {cmd_type}")
            
            if cmd_type == 'ping':
                self.publish_status({'status': 'online', 'timestamp': time.time()})
            elif cmd_type == 'get_info':
                self.publish_device_info()
            else:
                self.logger.warning(f"Unknown command type: {cmd_type}")
                
        except json.JSONDecodeError:
            self.logger.error("Invalid JSON in command payload")
            
    def publish_telemetry(self, data: Dict[str, Any]) -> bool:
        """Publish telemetry data"""
        if not self.is_connected or not self.mqtt_client:
            self.logger.error("MQTT not connected")
            return False
            
        try:
            topic = f"devices/{self.device_id}/telemetry"
            payload = json.dumps({
                'timestamp': time.time(),
                'device_id': self.device_id,
                **data
            })
            
            result = self.mqtt_client.publish(topic, payload)
            if result.rc == 0:
                self.logger.debug(f"Telemetry published to {topic}")
                return True
            else:
                self.logger.error(f"Failed to publish telemetry: {result.rc}")
                return False
                
        except Exception as e:
            self.logger.error(f"Error publishing telemetry: {e}")
            return False
            
    def publish_status(self, status_data: Dict[str, Any]) -> bool:
        """Publish device status"""
        if not self.is_connected or not self.mqtt_client:
            self.logger.error("MQTT not connected")
            return False
            
        try:
            topic = f"devices/{self.device_id}/status"
            payload = json.dumps({
                'timestamp': time.time(),
                'device_id': self.device_id,
                **status_data
            })
            
            result = self.mqtt_client.publish(topic, payload)
            return result.rc == 0
            
        except Exception as e:
            self.logger.error(f"Error publishing status: {e}")
            return False
            
    def publish_device_info(self) -> bool:
        """Publish device information"""
        info = {
            'device_id': self.device_id,
            'client_name': self.registration_data.client_name if self.registration_data else 'unknown',
            'authentication_name': self.registration_data.authentication_name if self.registration_data else 'unknown',
            'certificate_validity_days': 365,  # Default validity
            'app_deployment_enabled': False,  # Would need to be determined from service response
            'python_version': os.sys.version,
            'timestamp': time.time()
        }
        
        return self.publish_status(info)
        
    def start_telemetry_loop(self, interval: int = 30):
        """Start publishing telemetry data in a loop"""
        if self.telemetry_thread and self.telemetry_thread.is_alive():
            self.logger.warning("Telemetry loop already running")
            return
            
        self.stop_telemetry.clear()
        self.telemetry_thread = threading.Thread(target=self._telemetry_loop, args=(interval,))
        self.telemetry_thread.daemon = True
        self.telemetry_thread.start()
        self.logger.info(f"Started telemetry loop with {interval}s interval")
        
    def stop_telemetry_loop(self):
        """Stop the telemetry loop"""
        if self.telemetry_thread:
            self.stop_telemetry.set()
            self.telemetry_thread.join(timeout=5)
            self.logger.info("Stopped telemetry loop")
            
    def _telemetry_loop(self, interval: int):
        """Telemetry publishing loop"""
        while not self.stop_telemetry.is_set():
            try:
                # Generate sample telemetry data
                telemetry = {
                    'temperature': 20.0 + (time.time() % 10),  # Simulated temperature
                    'humidity': 50.0 + (time.time() % 20),     # Simulated humidity
                    'uptime': time.time(),
                    'memory_usage': 75.5,  # Simulated memory usage
                    'connected': self.is_connected
                }
                
                if self.publish_telemetry(telemetry):
                    self.logger.debug("Telemetry sent successfully")
                else:
                    self.logger.warning("Failed to send telemetry")
                    
            except Exception as e:
                self.logger.error(f"Error in telemetry loop: {e}")
                
            # Wait for next interval or stop signal
            if not self.stop_telemetry.wait(interval):
                continue
            else:
                break
                
    def disconnect(self):
        """Disconnect from MQTT broker and cleanup"""
        self.logger.info("Disconnecting device client")
        
        # Stop telemetry loop
        self.stop_telemetry_loop()
        
        # Disconnect MQTT
        if self.mqtt_client:
            self.mqtt_client.loop_stop()
            self.mqtt_client.disconnect()
            self.is_connected = False
            
    def get_device_status(self) -> Dict[str, Any]:
        """Get device status from certificate service"""
        try:
            status_url = f"{self.cert_service_url}/device/{self.device_id}/status"
            response = requests.get(status_url, timeout=10)
            
            if response.status_code == 200:
                return response.json()
            else:
                self.logger.error(f"Failed to get device status: {response.status_code}")
                return {}
                
        except Exception as e:
            self.logger.error(f"Error getting device status: {e}")
            return {}
            
    def get_app_deployment_status(self) -> Dict[str, Any]:
        """Get app deployment status from certificate service"""
        try:
            app_status_url = f"{self.cert_service_url}/device/{self.device_id}/app-status"
            response = requests.get(app_status_url, timeout=10)
            
            if response.status_code == 200:
                return response.json()
            else:
                self.logger.error(f"Failed to get app deployment status: {response.status_code}")
                return {}
                
        except Exception as e:
            self.logger.error(f"Error getting app deployment status: {e}")
            return {}


def main():
    """Main function for standalone execution"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Makerspace IoT Device Client')
    parser.add_argument('device_id', help='Device ID for registration')
    parser.add_argument('--cert-service-url', default='http://localhost:3000',
                        help='Certificate service URL')
    parser.add_argument('--cert-dir', default='./certs',
                        help='Directory to store certificates')
    parser.add_argument('--telemetry-interval', type=int, default=30,
                        help='Telemetry publishing interval in seconds')
    parser.add_argument('--no-telemetry', action='store_true',
                        help='Disable automatic telemetry publishing')
    parser.add_argument('--log-level', choices=['DEBUG', 'INFO', 'WARNING', 'ERROR'],
                        default='INFO', help='Logging level')
    
    args = parser.parse_args()
    
    # Setup logging
    logging.getLogger().setLevel(getattr(logging, args.log_level))
    
    # Validate device ID
    if not ConfigManager.validate_device_id(args.device_id):
        print(f"Error: Invalid device ID '{args.device_id}'")
        print("Device ID must be 3-50 characters and contain only alphanumeric characters, hyphens, and underscores")
        return 1
        
    # Create device client
    device = EnhancedMakerspaceIoTDevice(
        device_id=args.device_id,
        cert_service_url=args.cert_service_url,
        cert_dir=args.cert_dir
    )
    
    try:
        # Register device
        print(f"Registering device {args.device_id}...")
        registration = device.register_device()
        print(f"✅ Device registered successfully!")
        print(f"   Authentication Name: {registration.authentication_name}")
        print(f"   Client Name: {registration.client_name}")
        print(f"   Certificate Valid for: {registration.validity_days} days")
        
        if registration.app_deployment:
            print(f"   App Deployment: {registration.app_deployment}")
            
        # Connect to MQTT
        print("Connecting to MQTT broker...")
        if device.connect_mqtt():
            print("✅ MQTT connection established!")
            
            # Publish device info
            device.publish_device_info()
            
            # Start telemetry if not disabled
            if not args.no_telemetry:
                print(f"Starting telemetry loop (interval: {args.telemetry_interval}s)")
                device.start_telemetry_loop(args.telemetry_interval)
                
            # Keep running
            print("Device client running. Press Ctrl+C to exit...")
            try:
                while True:
                    time.sleep(1)
            except KeyboardInterrupt:
                print("\nShutting down...")
                
        else:
            print("❌ Failed to connect to MQTT broker")
            return 1
            
    except Exception as e:
        print(f"❌ Error: {e}")
        return 1
        
    finally:
        device.disconnect()
        print("Device client stopped.")
        
    return 0


if __name__ == "__main__":
    import sys
    sys.exit(main())
