#!/usr/bin/env python3
"""
BitNet MQTT Runner - A background service that monitors MQTT topics and uses BitNet for intelligent responses.
"""

import os
import sys
import json
import time
import uuid
import signal
import socket
import logging
import argparse
import threading
import subprocess
from pathlib import Path
from datetime import datetime
from typing import Optional, Dict, Any, Callable

import paho.mqtt.client as mqtt


class MqttMessage:
    """Represents an MQTT message with metadata."""
    
    def __init__(self, device_id: str, content: str, timestamp: datetime = None, message_type: str = "general"):
        self.device_id = device_id
        self.content = content
        self.timestamp = timestamp or datetime.now()
        self.message_type = message_type
        self.id = str(uuid.uuid4())
        
    def to_dict(self) -> Dict[str, Any]:
        """Convert message to dictionary for JSON serialization."""
        return {
            "id": self.id,
            "device_id": self.device_id,
            "content": self.content,
            "timestamp": self.timestamp.isoformat(),
            "message_type": self.message_type
        }
        
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'MqttMessage':
        """Create message from dictionary."""
        msg = cls(
            device_id=data["device_id"],
            content=data["content"],
            message_type=data.get("message_type", "general")
        )
        msg.id = data.get("id", str(uuid.uuid4()))
        if "timestamp" in data:
            msg.timestamp = datetime.fromisoformat(data["timestamp"])
        return msg


class BitNetInference:
    """Handles BitNet inference execution."""
    
    def __init__(self, bitnet_path: str = "../BitNet"):
        self.bitnet_path = Path(bitnet_path).resolve()
        self.inference_script = self.bitnet_path / "run_inference.py"
        self.logger = logging.getLogger(f"{__name__}.BitNetInference")
        
    def validate_setup(self) -> bool:
        """Verify that BitNet repository and required files exist."""
        if not self.bitnet_path.exists():
            self.logger.error(f"BitNet repository not found at: {self.bitnet_path}")
            return False
            
        if not self.inference_script.exists():
            self.logger.error(f"Inference script not found at: {self.inference_script}")
            return False
            
        build_dir = self.bitnet_path / "build"
        if not build_dir.exists():
            self.logger.error(f"Build directory not found at: {build_dir}")
            return False
            
        return True
        
    def generate_response(self, prompt: str, **kwargs) -> Optional[str]:
        """Generate response using BitNet inference."""
        if not self.validate_setup():
            return None
            
        # Build command arguments
        cmd = [
            sys.executable,
            str(self.inference_script),
            "-p", prompt,
            "-n", str(kwargs.get('n_predict', 128)),
            "-t", str(kwargs.get('threads', 2)),
            "-c", str(kwargs.get('ctx_size', 2048)),
            "-temp", str(kwargs.get('temperature', 0.8))
        ]
        
        model_path = kwargs.get('model_path')
        if model_path:
            cmd.extend(["-m", model_path])
            
        if kwargs.get('conversation', False):
            cmd.append("-cnv")
            
        self.logger.debug(f"Executing inference with command: {' '.join(cmd)}")
        
        try:
            # Change to BitNet directory for execution
            original_cwd = os.getcwd()
            os.chdir(self.bitnet_path)
            
            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout
            )
            
            os.chdir(original_cwd)
            
            if result.returncode == 0:
                response = result.stdout.strip()
                self.logger.info(f"Generated response ({len(response)} chars)")
                return response
            else:
                self.logger.error(f"Inference failed with return code: {result.returncode}")
                if result.stderr:
                    self.logger.error(f"Error output: {result.stderr}")
                return None
                
        except subprocess.TimeoutExpired:
            self.logger.error("Inference timed out after 5 minutes")
            return None
        except Exception as e:
            self.logger.error(f"Unexpected error during inference: {e}")
            return None
        finally:
            os.chdir(original_cwd)


class MqttBitNetService:
    """Main service that combines MQTT communication with BitNet inference."""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.device_id = self._generate_device_id()
        self.running = False
        self.mqtt_client = None
        self.bitnet = BitNetInference(config.get('bitnet_path', '../BitNet'))
        self.message_history = []
        self.response_callbacks = []
        
        self.setup_logging()
        self.logger = logging.getLogger(f"{__name__}.MqttBitNetService")
        
    def setup_logging(self):
        """Configure logging for the service."""
        log_level = getattr(logging, self.config.get('log_level', 'INFO').upper())
        logging.basicConfig(
            level=log_level,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler(self.config.get('log_file', 'bitnet_mqtt_service.log')),
                logging.StreamHandler(sys.stdout)
            ]
        )
        
    def _generate_device_id(self) -> str:
        """Generate unique device identifier."""
        custom_id = self.config.get('device_id')
        if custom_id:
            return custom_id
            
        hostname = socket.gethostname()
        mac_suffix = hex(uuid.getnode())[-6:]
        return f"bitnet-{hostname}-{mac_suffix}"
        
    def _should_respond(self, message: MqttMessage) -> bool:
        """Determine if the service should respond to a message."""
        # Don't respond to own messages
        if message.device_id == self.device_id:
            return False
            
        # Apply custom response criteria
        response_criteria = self.config.get('response_criteria', {})
        
        # Check message type filter
        allowed_types = response_criteria.get('message_types', ['general'])
        if message.message_type not in allowed_types:
            return False
            
        # Check content filters
        content_filters = response_criteria.get('content_filters', [])
        for filter_item in content_filters:
            if filter_item.lower() in message.content.lower():
                return True
                
        # Check response probability
        response_probability = response_criteria.get('probability', 1.0)
        if response_probability < 1.0:
            import random
            if random.random() > response_probability:
                return False
                
        # Default behavior based on configuration
        return response_criteria.get('default_respond', True)
        
    def _generate_prompt(self, message: MqttMessage, context: list) -> str:
        """Generate prompt for BitNet based on message and context."""
        prompt_template = self.config.get('prompt_template', 
            "You are a helpful AI assistant in an IoT network. "
            "Device {device_id} said: '{content}'. "
            "Recent context: {context}. "
            "Provide a helpful, concise response."
        )
        
        # Prepare context string
        context_str = ""
        if context:
            recent_messages = context[-3:]  # Last 3 messages for context
            context_str = " | ".join([f"{msg.device_id}: {msg.content}" for msg in recent_messages])
        
        prompt = prompt_template.format(
            device_id=message.device_id,
            content=message.content,
            context=context_str,
            own_device_id=self.device_id
        )
        
        return prompt
        
    def on_mqtt_connect(self, client, userdata, flags, rc):
        """Callback for MQTT connection."""
        if rc == 0:
            self.logger.info("Connected to MQTT broker")
            topic = self.config['mqtt']['topic']
            client.subscribe(topic)
            self.logger.info(f"Subscribed to topic: {topic}")
            
            # Send initial presence message
            presence_msg = MqttMessage(
                device_id=self.device_id,
                content=f"Device {self.device_id} joined the network",
                message_type="presence"
            )
            self.publish_message(presence_msg)
        else:
            self.logger.error(f"Failed to connect to MQTT broker: {rc}")
            
    def on_mqtt_message(self, client, userdata, msg):
        """Callback for received MQTT messages."""
        try:
            payload = json.loads(msg.payload.decode())
            message = MqttMessage.from_dict(payload)
            
            self.logger.info(f"Received message from {message.device_id}: {message.content[:100]}...")
            
            # Add to message history
            self.message_history.append(message)
            if len(self.message_history) > 100:  # Keep last 100 messages
                self.message_history.pop(0)
                
            # Decide whether to respond
            if self._should_respond(message):
                self._handle_response(message)
                
        except json.JSONDecodeError as e:
            self.logger.error(f"Failed to decode MQTT message: {e}")
        except Exception as e:
            self.logger.error(f"Error processing MQTT message: {e}")
            
    def _handle_response(self, message: MqttMessage):
        """Handle generating and sending a response to a message."""
        def response_worker():
            try:
                self.logger.info(f"Generating response to message from {message.device_id}")
                
                # Generate prompt with context
                prompt = self._generate_prompt(message, self.message_history[:-1])
                
                # Get BitNet inference parameters
                inference_params = self.config.get('bitnet_params', {})
                
                # Generate response
                response_content = self.bitnet.generate_response(prompt, **inference_params)
                
                if response_content:
                    # Create response message
                    response_msg = MqttMessage(
                        device_id=self.device_id,
                        content=response_content,
                        message_type="response"
                    )
                    
                    # Add delay to avoid flooding
                    delay = self.config.get('response_delay', 2.0)
                    time.sleep(delay)
                    
                    # Publish response
                    self.publish_message(response_msg)
                    self.logger.info(f"Published response to {message.device_id}")
                else:
                    self.logger.warning("Failed to generate response")
                    
            except Exception as e:
                self.logger.error(f"Error in response worker: {e}")
                
        # Run response generation in background thread
        thread = threading.Thread(target=response_worker, daemon=True)
        thread.start()
        
    def publish_message(self, message: MqttMessage):
        """Publish a message to MQTT topic."""
        if self.mqtt_client and self.mqtt_client.is_connected():
            topic = self.config['mqtt']['topic']
            payload = json.dumps(message.to_dict())
            self.mqtt_client.publish(topic, payload)
            self.logger.debug(f"Published message: {message.content[:50]}...")
        else:
            self.logger.error("MQTT client not connected")
            
    def start(self):
        """Start the MQTT BitNet service."""
        if not self.bitnet.validate_setup():
            self.logger.error("BitNet setup validation failed")
            return False
            
        self.logger.info(f"Starting MQTT BitNet Service with device ID: {self.device_id}")
        
        # Setup MQTT client
        self.mqtt_client = mqtt.Client()
        self.mqtt_client.on_connect = self.on_mqtt_connect
        self.mqtt_client.on_message = self.on_mqtt_message
        
        # Configure MQTT authentication if provided
        mqtt_config = self.config['mqtt']
        if 'username' in mqtt_config and 'password' in mqtt_config:
            self.mqtt_client.username_pw_set(mqtt_config['username'], mqtt_config['password'])
            
        # Configure TLS if enabled
        if mqtt_config.get('use_tls', False):
            ca_certs = mqtt_config.get('ca_certs', None)
            certfile = mqtt_config.get('certfile', None)
            keyfile = mqtt_config.get('keyfile', None)
            
            if ca_certs or certfile or keyfile:
                # Use custom certificates
                self.mqtt_client.tls_set(
                    ca_certs=ca_certs,
                    certfile=certfile,
                    keyfile=keyfile
                )
            else:
                # Use default TLS
                self.mqtt_client.tls_set()
            
        try:
            # Connect to MQTT broker
            self.mqtt_client.connect(
                mqtt_config['broker'],
                mqtt_config.get('port', 1883),
                mqtt_config.get('keepalive', 60)
            )
            
            self.running = True
            self.mqtt_client.loop_start()
            
            self.logger.info("Service started successfully")
            return True
            
        except Exception as e:
            self.logger.error(f"Failed to start service: {e}")
            return False
            
    def stop(self):
        """Stop the MQTT BitNet service."""
        self.logger.info("Stopping MQTT BitNet Service")
        self.running = False
        
        if self.mqtt_client:
            # Send goodbye message
            goodbye_msg = MqttMessage(
                device_id=self.device_id,
                content=f"Device {self.device_id} leaving the network",
                message_type="presence"
            )
            self.publish_message(goodbye_msg)
            time.sleep(1)  # Give time for message to send
            
            self.mqtt_client.loop_stop()
            self.mqtt_client.disconnect()
            
        self.logger.info("Service stopped")
        
    def send_manual_message(self, content: str, message_type: str = "manual"):
        """Send a manual message to the MQTT topic."""
        message = MqttMessage(
            device_id=self.device_id,
            content=content,
            message_type=message_type
        )
        self.publish_message(message)
        
    def run_forever(self):
        """Run the service until interrupted."""
        try:
            while self.running:
                time.sleep(1)
        except KeyboardInterrupt:
            self.logger.info("Received interrupt signal")
        finally:
            self.stop()


def load_config(config_path: str) -> Dict[str, Any]:
    """Load configuration from JSON file."""
    try:
        with open(config_path, 'r') as f:
            return json.load(f)
    except FileNotFoundError:
        print(f"Configuration file not found: {config_path}")
        sys.exit(1)
    except json.JSONDecodeError as e:
        print(f"Invalid JSON in configuration file: {e}")
        sys.exit(1)


def create_default_config() -> Dict[str, Any]:
    """Create default configuration."""
    return {
        "mqtt": {
            "broker": "localhost",
            "port": 1883,
            "topic": "bitnet/chat",
            "keepalive": 60,
            "use_tls": False,
            "ca_certs": "ca.crt",
            "certfile": "client1-authnID.pem",
            "keyfile": "client1-authnID.key",
            "username": "",
            "password": ""
        },
        "bitnet_path": "../BitNet",
        "bitnet_params": {
            "n_predict": 128,
            "threads": 2,
            "ctx_size": 2048,
            "temperature": 0.8,
            "conversation": False
        },
        "response_criteria": {
            "default_respond": True,
            "probability": 1.0,
            "message_types": ["general", "question"],
            "content_filters": []
        },
        "response_delay": 2.0,
        "log_level": "INFO",
        "log_file": "bitnet_mqtt_service.log",
        "prompt_template": "You are a helpful AI assistant in an IoT network. Device {device_id} said: '{content}'. Recent context: {context}. Provide a helpful, concise response."
    }


def main():
    """Main entry point for the application."""
    parser = argparse.ArgumentParser(description='BitNet MQTT Service for Pi device')
    parser.add_argument(
        "--config", 
        type=str, 
        help="Path to configuration JSON file"
    )
    parser.add_argument(
        "--create-config",
        type=str,
        help="Create default configuration file at specified path"
    )
    
    subparsers = parser.add_subparsers(dest='command', help='Available commands')
    
    # Service command
    service_parser = subparsers.add_parser('service', help='Run MQTT service')
    service_parser.add_argument("--daemon", action='store_true', help="Run as daemon")
    
    # Send message command
    send_parser = subparsers.add_parser('send', help='Send manual message to MQTT topic')
    send_parser.add_argument("message", type=str, help="Message content to send")
    send_parser.add_argument("--type", type=str, default="manual", help="Message type")
    
    # Test inference command
    test_parser = subparsers.add_parser('test', help='Test BitNet inference')
    test_parser.add_argument("prompt", type=str, help="Test prompt")
    
    # Validate command
    validate_parser = subparsers.add_parser('validate', help='Validate BitNet setup')
    
    args = parser.parse_args()
    
    # Handle config creation
    if args.create_config:
        config = create_default_config()
        with open(args.create_config, 'w') as f:
            json.dump(config, f, indent=2)
        print(f"Default configuration created at: {args.create_config}")
        return
    
    # Load configuration
    if args.config:
        config = load_config(args.config)
    else:
        config = create_default_config()
        print("Using default configuration. Use --create-config to save a template.")
    
    if not args.command:
        parser.print_help()
        return
        
    # Handle commands
    if args.command == 'validate':
        bitnet = BitNetInference(config.get('bitnet_path', '../BitNet'))
        if bitnet.validate_setup():
            print("BitNet setup is valid")
        else:
            print("BitNet setup validation failed")
            sys.exit(1)
            
    elif args.command == 'test':
        bitnet = BitNetInference(config.get('bitnet_path', '../BitNet'))
        bitnet_params = config.get('bitnet_params', {})
        response = bitnet.generate_response(args.prompt, **bitnet_params)
        if response:
            print("Response:")
            print(response)
        else:
            print("Failed to generate response")
            sys.exit(1)
            
    elif args.command == 'send':
        service = MqttBitNetService(config)
        if service.start():
            time.sleep(2)  # Wait for connection
            service.send_manual_message(args.message, args.type)
            time.sleep(2)  # Wait for message to send
            service.stop()
        else:
            sys.exit(1)
            
    elif args.command == 'service':
        service = MqttBitNetService(config)
        
        def signal_handler(sig, frame):
            print("\nReceived interrupt signal, stopping service...")
            service.stop()
            sys.exit(0)
            
        signal.signal(signal.SIGINT, signal_handler)
        signal.signal(signal.SIGTERM, signal_handler)
        
        if service.start():
            print(f"Service started with device ID: {service.device_id}")
            print("Press Ctrl+C to stop...")
            service.run_forever()
        else:
            print("Failed to start service")
            sys.exit(1)


if __name__ == "__main__":
    main()
