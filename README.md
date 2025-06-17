# Makerspace 2025

A comprehensive IoT and AI platform combining Azure IoT Hub with BitNet inference for distributed Pi device networks.

## Quick Start

### Azure Event Grid MQTT Deployment
Deploy the Event Grid namespace with MQTT broker:
```bash
cd infra
az group create --name rg-Makerspace2025-IoT --location westus2
az deployment group create --resource-group rg-Makerspace2025-IoT --template-file main.bicep --parameters eventGridNamespaceName=makerspace-eventgrid
```

### Certificate Chain Authentication Setup
Generate certificates and configure Azure Event Grid MQTT authentication:
```bash
# 1. Generate CA and client certificates
./generate_certs.sh

# 2. Deploy CA certificate to Azure Event Grid
./deploy_ca_cert.sh -g rg-Makerspace2025-IoT -n makerspace-eventgrid
```

### BitNet MQTT Service
Install and manage the BitNet MQTT service for Pi devices:
```bash
./install.sh      # Install the service (includes certificate generation)
./start_service.sh # Start the service
./stop_service.sh  # Stop the service
./uninstall.sh     # Completely remove the service
```

### Certificate Management
For MQTT TLS authentication:
```bash
./generate_certs.sh  # Generate CA and client certificates
./show_certs.sh      # Display certificate information
```

The certificate generation follows Azure Event Grid MQTT certificate chain authentication:
- Creates step-cli Certificate Authority with root and intermediate certificates
- Generates client certificates with proper authentication ID format
- Uploads intermediate CA certificate to Azure Event Grid namespace
- Configures MQTT client with SubjectMatchesAuthenticationName validation

For detailed setup instructions, see `docs/certificate-authentication.md`.

See `src/README.md` for detailed documentation.
