#!/usr/bin/env python3
"""
Configuration management for IoT device clients
"""

import os
from typing import Dict, Any, Optional
from dataclasses import dataclass


@dataclass
class MqttConfig:
    """MQTT connection configuration"""
    hostname: str
    port: int = 8883
    keepalive: int = 60
    protocol_version: int = 4  # MQTTv3.1.1
    
    
@dataclass
class CertificateConfig:
    """Certificate configuration"""
    cert_path: str
    key_path: str
    ca_path: str
    
    
@dataclass
class DeviceConfig:
    """Device configuration"""
    device_id: str
    cert_service_url: str
    mqtt: MqttConfig
    certificates: Optional[CertificateConfig] = None
    

class ConfigManager:
    """Manages device configuration from environment variables and files"""
    
    DEFAULT_CERT_SERVICE_URL = "http://localhost:3000"
    DEFAULT_MQTT_PORT = 8883
    DEFAULT_KEEPALIVE = 60
    
    @classmethod
    def from_environment(cls, device_id: str) -> DeviceConfig:
        """Create configuration from environment variables"""
        cert_service_url = os.getenv("CERT_SERVICE_URL", cls.DEFAULT_CERT_SERVICE_URL)
        mqtt_hostname = os.getenv("MQTT_HOSTNAME", "")
        mqtt_port = int(os.getenv("MQTT_PORT", cls.DEFAULT_MQTT_PORT))
        
        mqtt_config = MqttConfig(
            hostname=mqtt_hostname,
            port=mqtt_port,
            keepalive=int(os.getenv("MQTT_KEEPALIVE", cls.DEFAULT_KEEPALIVE))
        )
        
        # Check for existing certificate files
        cert_config = None
        cert_path = os.getenv("DEVICE_CERT_PATH")
        key_path = os.getenv("DEVICE_KEY_PATH") 
        ca_path = os.getenv("CA_CERT_PATH")
        
        if cert_path and key_path and ca_path:
            cert_config = CertificateConfig(
                cert_path=cert_path,
                key_path=key_path,
                ca_path=ca_path
            )
        
        return DeviceConfig(
            device_id=device_id,
            cert_service_url=cert_service_url,
            mqtt=mqtt_config,
            certificates=cert_config
        )
    
    @classmethod
    def validate_device_id(cls, device_id: str) -> bool:
        """Validate device ID format"""
        if not device_id or not isinstance(device_id, str):
            return False
        
        if len(device_id) < 3 or len(device_id) > 50:
            return False
            
        # Allow alphanumeric characters, hyphens, and underscores
        import re
        return bool(re.match(r'^[a-zA-Z0-9_-]+$', device_id))
    
    @classmethod
    def get_config_summary(cls, config: DeviceConfig) -> Dict[str, Any]:
        """Get a summary of the configuration for logging"""
        return {
            "device_id": config.device_id,
            "cert_service_url": config.cert_service_url,
            "mqtt_hostname": config.mqtt.hostname,
            "mqtt_port": config.mqtt.port,
            "has_certificates": config.certificates is not None
        }
