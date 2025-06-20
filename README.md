# Makerspace 2025 IoT Certificate Management System

A comprehensive IoT certificate management platform combining Azure Event Grid MQTT broker with automated device registration and app deployment capabilities.

## Overview

This solution provides a complete certificate management system for IoT devices connecting to Azure Event Grid MQTT broker. The system consists of:

1. **Azure Infrastructure** - Event Grid namespace with MQTT broker capabilities
2. **Certificate Service** - Containerized web service running on Azure App Service  
3. **Device Registration** - Automatic device registration and certificate issuance
4. **App Deployment** - Automated deployment of bitnet_runner app to registered devices

## Architecture

```
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

### 1. Deploy Azure Infrastructure

```bash
# Create resource group
az group create --name makerspace-rg --location westus2

# Deploy infrastructure  
cd infra
az deployment group create \
  --resource-group makerspace-rg \
  --template-file main.bicep \
  --parameters eventGridNamespaceName=makerspace-eventgrid \
               appServiceName=makerspace-cert-service
```

### 2. Generate and Deploy Certificates

```bash
# Generate CA and client certificates
./generate_certs.sh

# Deploy CA certificate to Azure Event Grid
./deploy_ca_cert.sh -g makerspace-rg -n makerspace-eventgrid
```

### 3. Deploy Certificate Service

```bash
# Build and deploy the certificate service
./deploy-cert-service.sh
```

### 4. Test the System

```bash
# Test device registration and app deployment
./test_app_deployment.sh
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
