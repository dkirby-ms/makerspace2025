# BitNet MQTT Service for Pi Devices

A Python application that creates an intelligent IoT network using BitNet inference and MQTT messaging. Multiple Pi devices can run this service to form a distributed AI network where devices communicate and respond to each other using BitNet-generated content.

## Features

- **MQTT Communication**: Subscribe and publish to MQTT topics for device-to-device communication
- **BitNet Integration**: Uses BitNet inference to generate intelligent responses to messages
- **Background Service**: Runs as a daemon service on Pi devices
- **Device Identification**: Each device has a unique identifier for network communication
- **Smart Response Logic**: Configurable criteria for when to respond to messages
- **Context Awareness**: Maintains conversation context for better responses
- **Flexible Configuration**: JSON-based configuration for all service parameters
- **Systemd Integration**: Can be installed as a system service for automatic startup

## Architecture

```
Pi Device 1 ←→ MQTT Broker ←→ Pi Device 2
     ↓              ↓              ↓
  BitNet        Message         BitNet
 Inference      Routing        Inference
```

## Prerequisites

- Python 3.6 or higher
- BitNet repository cloned at `../BitNet` (or specify custom path)
- BitNet properly built with `llama-cli` binary available
- MQTT broker accessible from Pi devices (local or remote)

## Quick Start

1. **Install the service:**
   ```bash
   ./install.sh
   ```

2. **Configure MQTT settings:**
   Edit `src/service_config.json` to set your MQTT broker details:
   ```json
   {
     "mqtt": {
       "broker": "your-mqtt-broker.local",
       "port": 1883,
       "topic": "bitnet/chat"
     }
   }
   ```

3. **Test BitNet inference:**
   ```bash
   python3 src/bitnet_runner.py --config src/service_config.json test "Hello world"
   ```

4. **Start the service:**
   ```bash
   ./start_service.sh
   ```

## Usage

### Service Commands

**Run as foreground service:**
```bash
python3 src/bitnet_runner.py --config src/service_config.json service
```

**Send manual message:**
```bash
python3 src/bitnet_runner.py --config src/service_config.json send "Hello network!"
./send_message.sh "Hello from Pi device"
```

**Test inference:**
```bash
python3 src/bitnet_runner.py --config src/service_config.json test "What is IoT?"
```

**Validate setup:**
```bash
python3 src/bitnet_runner.py --config src/service_config.json validate
```

### Systemd Service (Optional)

**Install as system service:**
```bash
sudo ./install_systemd.sh
```

**Control systemd service:**
```bash
sudo systemctl start bitnet-mqtt    # Start service
sudo systemctl stop bitnet-mqtt     # Stop service  
sudo systemctl status bitnet-mqtt   # Check status
sudo journalctl -u bitnet-mqtt -f   # View logs
```

## Configuration

The service uses JSON configuration files. Create a default template:

```bash
python3 src/bitnet_runner.py --create-config my_config.json
```

### Configuration Options

```json
{
  "mqtt": {
    "broker": "localhost",           // MQTT broker hostname/IP
    "port": 1883,                   // MQTT broker port
    "topic": "bitnet/chat",         // MQTT topic for communication
    "keepalive": 60,               // MQTT keepalive interval
    "use_tls": false,              // Enable TLS encryption
    "username": "",                // MQTT username (optional)
    "password": ""                 // MQTT password (optional)
  },
  "device_id": "",                 // Custom device ID (auto-generated if empty)
  "bitnet_path": "../BitNet",      // Path to BitNet repository
  "bitnet_params": {
    "model_path": "",              // Custom model path (optional)
    "n_predict": 128,              // Number of tokens to generate
    "threads": 2,                  // Number of CPU threads
    "ctx_size": 2048,              // Context window size
    "temperature": 0.8,            // Generation temperature
    "conversation": false          // Conversation mode
  },
  "response_criteria": {
    "default_respond": true,       // Whether to respond by default
    "probability": 0.8,            // Probability of responding (0.0-1.0)
    "message_types": ["general"],  // Message types to respond to
    "content_filters": ["help"]    // Keywords that trigger responses
  },
  "response_delay": 2.0,           // Delay before responding (seconds)
  "log_level": "INFO",             // Logging level
  "log_file": "service.log",       // Log file path
  "prompt_template": "..."         // Template for generating prompts
}
```

### Response Criteria

Control when your device responds to messages:

- **default_respond**: Base behavior for unknown messages
- **probability**: Random chance of responding (0.0 = never, 1.0 = always)
- **message_types**: Only respond to specific message types
- **content_filters**: Keywords that trigger responses

### Prompt Templates

Customize how BitNet generates responses using template variables:

- `{device_id}`: Sending device ID
- `{own_device_id}`: This device's ID  
- `{content}`: Message content
- `{context}`: Recent conversation history

## Message Format

Messages are JSON objects with this structure:

```json
{
  "id": "unique-message-id",
  "device_id": "sender-device-id", 
  "content": "message text",
  "timestamp": "2025-06-11T10:30:00",
  "message_type": "general"
}
```

### Message Types

- **general**: Normal conversation messages
- **question**: Direct questions  
- **response**: Responses to other messages
- **presence**: Device join/leave notifications
- **manual**: Manually sent messages

## Network Scenarios

### Home Automation Network
```json
{
  "response_criteria": {
    "content_filters": ["temperature", "lights", "security", "help"],
    "probability": 1.0
  }
}
```

### Educational Network  
```json
{
  "response_criteria": {
    "content_filters": ["explain", "what", "how", "?"],
    "message_types": ["question", "general"]
  }
}
```

### Monitoring Network
```json
{
  "response_criteria": {
    "default_respond": false,
    "content_filters": ["alert", "error", "status"]
  }
}
```

## Troubleshooting

**Service won't start:**
- Check BitNet setup: `python3 src/bitnet_runner.py validate`
- Verify MQTT broker connectivity
- Check log file for error details

**No responses generated:**
- Test inference: `python3 src/bitnet_runner.py test "hello"`
- Check response criteria configuration
- Monitor logs for generation attempts

**MQTT connection issues:**
- Verify broker hostname and port
- Check firewall settings
- Test with MQTT client tools (mosquitto_pub/sub)

**High resource usage:**
- Reduce `bitnet_params.threads`
- Lower `bitnet_params.n_predict`
- Increase `response_delay`

## Files Structure

```
/home/dakir/makerspace2025/
├── src/
│   ├── bitnet_runner.py          # Main service application
│   ├── service_config.json       # Service configuration
│   ├── bitnet-mqtt.service       # Systemd service file
│   └── README.md                 # This documentation
├── install.sh                    # Installation script
├── install_systemd.sh           # Systemd installation
├── start_service.sh             # Service startup script
├── send_message.sh              # Send test messages
└── requirements.txt             # Python dependencies
```
