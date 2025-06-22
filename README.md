# Makerspace 2025 IoT Certificate Management System

IoT certificate management platform combining Azure Event Grid MQTT broker with automated device registration and app deployment capabilities.

## Overview

This solution provides a complete certificate management system for IoT devices connecting to Azure Event Grid MQTT broker. The system consists of:

1. **Azure Infrastructure** - Event Grid namespace with MQTT broker capabilities
2. **Certificate Service** - Containerized web service running on Azure App Service  
3. **Device Registration** - Automatic device registration and certificate issuance
4. **App Deployment** - Automated deployment of bitnet_runner app to registered devices

## Architecture

```shell
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│                 │    │                 │    │                 │
│  IoT Device     │◄──►│ Certificate     │◄──►│ Event Grid      │
│                 │    │ Service         │    │ MQTT Broker     │
│                 │    │ (App Service)   │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                        Certificate Authority
                        (X.509 Certificates)
```

## Quick Start

### Prerequisites

- Azure CLI installed and logged in
- Docker installed
- step-cli installed (for certificate generation)

### Complete Deployment

Run the complete deployment script that generates certificates and deploys Azure resources:

```bash
# Set environment variables (optional - defaults provided)
export RESOURCE_GROUP="rg-makerspace2025"
export LOCATION="westus2"
export EVENTGRID_NAMESPACE="makerspace-eventgrid"
export CONTAINER_APP_NAME="makerspace-cert-service"

# Run complete deployment
./deploy.sh
```

This script will:

1. Generate CA and client certificates using step-cli
2. Create Azure resource group
3. Deploy Azure infrastructure with certificates included
4. Build and deploy the certificate service container

### Manual Step-by-Step Deployment

If you prefer to run steps manually:

#### 1. Generate Certificates

```bash
# Generate CA and client certificates
./generate_certs.sh
```

#### 2. Deploy Azure Infrastructure with Certificates

```bash
# Prepare certificate content (preserve PEM format)
CA_CERT_CONTENT=$(cat intermediate_ca.crt)

# Create resource group
az group create --name rg-makerspace2025 --location westus2

# Deploy infrastructure with certificates
cd infra
az deployment group create \
  --resource-group rg-makerspace2025 \
  --template-file main.bicep \
  --parameters \
    eventGridNamespaceName=makerspace-eventgrid \
    containerAppName=makerspace-cert-service \
    caCertificateContent="$CA_CERT_CONTENT"
```

#### 3. Deploy Certificate Service

```bash
# Get container registry name from deployment output
REGISTRY_NAME=$(az deployment group show \
  --resource-group rg-makerspace2025 \
  --name main \
  --query "properties.outputs.containerRegistryName.value" \
  --output tsv)

# Deploy certificate service
./deploy_cert_service.sh rg-makerspace2025 "$REGISTRY_NAME"
```

### Testing the Deployment

After deployment, verify everything is working correctly:

```bash
# Run deployment tests
./test_deployment.sh
```

This script will verify:

- Event Grid namespace is deployed and ready
- CA certificate is properly installed
- MQTT client is configured
- Certificate service is responding

### Manual MQTT Testing

Test MQTT connectivity using mosquitto client:

```bash
# Install mosquitto client (Ubuntu/Debian)
sudo apt-get install mosquitto-clients

# Test MQTT publish
mosquitto_pub -h <mqtt-hostname> -p 8883 \
  --cert client1-authnID.pem --key client1-authnID.key \
  -t 'devices/client1/telemetry' -m 'Hello from device'

# Test MQTT subscribe
mosquitto_sub -h <mqtt-hostname> -p 8883 \
  --cert client1-authnID.pem --key client1-authnID.key \
  -t 'devices/+/telemetry'
```

## Components

### Infrastructure (Bicep Templates)

#### `infra/main.bicep`

Main deployment template that orchestrates:

- Event Grid namespace deployment
- App Service and Container Registry deployment

#### `infra/eventGrid.bicep`

- Event Grid namespace with MQTT broker
- Topic spaces for device communication  
- Permission bindings for devices
- CA certificate configuration

#### `infra/appService.bicep`

- Azure Container Registry for storing Docker images
- App Service Plan (Linux)
- App Service with container support
- Managed identity and role assignments

## Deployment Workflow

The new streamlined deployment process:

1. **Certificate Generation** - Creates CA and client certificates using step-cli
2. **Infrastructure Deployment** - Deploys Azure resources with certificates included
3. **Service Deployment** - Builds and deploys the certificate service container
4. **Verification** - Tests the complete system functionality

This eliminates the need for post-deployment certificate configuration.
