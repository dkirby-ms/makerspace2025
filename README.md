# Makerspace 2025

A comprehensive IoT and AI platform combining Azure IoT Hub with BitNet inference for distributed Pi device networks.

## Quick Start

### Azure IoT Hub Deployment
Deploy the IoT Hub infrastructure:
```bash
cd infra
az group create --name rg-Makerspace2025-IoT --location westus2
az deployment group create --resource-group rg-Makerspace2025-IoT --template-file main.bicep --parameters iotHubName=Makerspace2025IoTHub
```

### BitNet MQTT Service
Install and manage the BitNet MQTT service for Pi devices:
```bash
./install.sh      # Install the service
./start_service.sh # Start the service
./stop_service.sh  # Stop the service
./uninstall.sh     # Completely remove the service
```

See `src/README.md` for detailed documentation.
