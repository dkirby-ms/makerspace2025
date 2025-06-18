# Makerspace IoT Certificate Management System

## Overview

This solution provides a complete certificate management system for IoT devices connecting to Azure Event Grid MQTT broker. The system consists of:

1. **Azure Infrastructure** - Event Grid namespace with MQTT broker capabilities
2. **Certificate Service** - Containerized web service running on Azure App Service
3. **Device Registration** - Automatic device registration and certificate issuance

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

## Components

### 1. Infrastructure (Bicep Templates)

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

### 2. Certificate Service (`cert-service/`)

#### Core Components

**`certificateManager.ts`**
- Generates CA certificates and device certificates
- Uses node-forge for X.509 certificate operations
- Supports configurable certificate subjects and validity periods

**`eventGridClient.ts`**
- Manages device registration in Event Grid namespace
- Creates MQTT clients for devices
- Handles device lifecycle (register, unregister, status)

**`index.ts`**
- Express.js web server
- REST API endpoints for device management
- Health checks and monitoring

#### API Endpoints

- `GET /health` - Service health check
- `GET /ca-certificate` - Download CA certificate
- `POST /register-device` - Register new device and issue certificate
- `GET /device/{deviceId}/status` - Check device registration status
- `GET /devices` - List all registered devices
- `DELETE /device/{deviceId}` - Unregister device

## Deployment

### Prerequisites

1. Azure CLI installed and logged in
2. Docker installed (for local builds)
3. Appropriate Azure permissions (Contributor role)

### Step 1: Deploy Infrastructure

```bash
# Create resource group
az group create --name makerspace-rg --location eastus

# Deploy infrastructure
az deployment group create \
  --resource-group makerspace-rg \
  --template-file infra/main.bicep \
  --parameters eventGridNamespaceName=makerspace-eventgrid \
               appServiceName=makerspace-cert-service
```

### Step 2: Deploy Certificate Service

```bash
# Run deployment script
./deploy-cert-service.sh
```

Or manually:

```bash
# Get infrastructure outputs
OUTPUTS=$(az deployment group show --resource-group makerspace-rg --name "main" --query "properties.outputs" --output json)
ACR_NAME=$(echo $OUTPUTS | jq -r '.containerRegistryName.value')
APP_SERVICE_NAME=$(echo $OUTPUTS | jq -r '.appServiceName.value')

# Build and push container
cd cert-service
az acr login --name $ACR_NAME
docker build -t ${ACR_NAME}.azurecr.io/cert-service:latest .
docker push ${ACR_NAME}.azurecr.io/cert-service:latest

# Update App Service
az webapp config container set \
  --name $APP_SERVICE_NAME \
  --resource-group makerspace-rg \
  --docker-custom-image-name ${ACR_NAME}.azurecr.io/cert-service:latest

az webapp restart --name $APP_SERVICE_NAME --resource-group makerspace-rg
```

## Device Integration

### 1. Register Device

```bash
curl -X POST https://your-app-service.azurewebsites.net/register-device \
  -H "Content-Type: application/json" \
  -d '{"deviceId": "sensor-001"}'
```

Response includes:
- Device certificate (X.509 PEM format)
- Private key
- MQTT connection details
- Authentication name

### 2. Connect to MQTT

Use the issued certificate and private key to connect:

```python
import paho.mqtt.client as mqtt
import ssl

# MQTT connection details from registration response
mqtt_host = "makerspace-eventgrid.eastus-1.eventgrid.azure.net"
mqtt_port = 8883
device_id = "sensor-001"

# Configure SSL context with issued certificate
context = ssl.create_default_context(ssl.Purpose.SERVER_AUTH)
context.load_cert_chain("device_cert.pem", "device_key.pem")
context.load_verify_locations("ca_cert.pem")

# Create MQTT client
client = mqtt.Client(device_id)
client.tls_set_context(context)

# Connect and publish
client.connect(mqtt_host, mqtt_port, 60)
client.publish(f"devices/{device_id}/telemetry", "Hello from device!")
```

## Security Considerations

### Certificate Management
- CA private key should be stored securely (Azure Key Vault in production)
- Device certificates have configurable validity periods
- Certificate revocation not implemented (devices should be unregistered)

### Authentication
- Uses client certificate authentication
- Subject name matches authentication name in Event Grid
- Managed identity for service-to-service authentication

### Network Security
- HTTPS-only for certificate service
- MQTTS (TLS) for device connections
- App Service has system-assigned managed identity

## Monitoring and Maintenance

### Health Checks
- `/health` endpoint for service monitoring
- Docker health checks in container
- Azure Application Insights integration available

### Logging
- Structured logging with Morgan middleware
- Device registration events logged
- Error handling with proper HTTP status codes

### Scaling
- App Service can scale horizontally
- Stateless service design
- Certificate generation is CPU-intensive (consider scaling up for high loads)

## Development

### Local Development

```bash
cd cert-service
npm install
npm run dev
```

### Testing

```bash
npm test
npm run build
```

### Docker Local Testing

```bash
docker build -t cert-service .
docker run -p 3000:3000 \
  -e EVENTGRID_NAMESPACE_NAME=test \
  -e EVENTGRID_RESOURCE_GROUP=test \
  -e AZURE_SUBSCRIPTION_ID=test \
  cert-service
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `EVENTGRID_NAMESPACE_NAME` | Event Grid namespace name | Required |
| `EVENTGRID_RESOURCE_GROUP` | Resource group name | Required |
| `AZURE_SUBSCRIPTION_ID` | Azure subscription ID | Required |
| `CA_CERT_SUBJECT` | CA certificate subject | `/C=US/ST=CA/L=SanFrancisco/O=Makerspace/OU=IT/CN=Makerspace CA` |
| `CERT_VALIDITY_DAYS` | Certificate validity period | `365` |
| `PORT` | Service port | `3000` |

### Azure Role Requirements

The App Service managed identity needs:
- `EventGrid Data Contributor` role on the Event Grid namespace
- `Reader` role on the resource group

## Troubleshooting

### Common Issues

**Certificate Service Not Starting**
- Check environment variables are set correctly
- Verify managed identity has required permissions
- Check Application Insights logs

**Device Registration Failing**
- Verify Event Grid namespace exists and is accessible
- Check device ID format (alphanumeric, hyphens, underscores only)
- Verify service has EventGrid Data Contributor role

**MQTT Connection Issues**
- Ensure device uses correct certificate and private key
- Verify MQTT hostname format
- Check device authentication name matches certificate subject

### Debugging

```bash
# Check App Service logs
az webapp log tail --name makerspace-cert-service --resource-group makerspace-rg

# Check container logs
docker logs <container-id>

# Test API endpoints
curl https://your-app-service.azurewebsites.net/health
curl https://your-app-service.azurewebsites.net/devices
```

## Future Enhancements

1. **Certificate Revocation List (CRL)** - Implement certificate revocation
2. **Azure Key Vault Integration** - Store CA certificate securely
3. **Device Provisioning Service** - Integration with Azure IoT Device Provisioning
4. **Certificate Renewal** - Automatic certificate renewal before expiry
5. **Audit Logging** - Enhanced logging for compliance
6. **Rate Limiting** - Prevent abuse of certificate issuance
7. **Multi-tenant Support** - Support multiple organizations
