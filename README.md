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

### Certificate Service (`cert-service/`)

#### Core Components

**`certificateManager.ts`**
- Generates CA certificates and device certificates
- Uses node-forge for X.509 certificate operations
- Supports configurable certificate subjects and validity periods

**`eventGridClient.ts`**
- Manages device registration in Event Grid namespace
- Creates MQTT clients for devices
- Handles device lifecycle (register, unregister, status)

**`appDeploymentManager.ts`**
- Handles automated app deployment to devices
- Clones repositories and builds applications
- Packages apps with device-specific configurations

**`index.ts`**
- Express.js web server
- REST API endpoints for device management
- Health checks and monitoring

## API Reference

### Device Management

#### Register Device
```http
POST /register-device
Content-Type: application/json

{
  "deviceId": "device-001"
}
```

**Response:**
```json
{
  "success": true,
  "deviceId": "device-001",
  "authenticationName": "device-001-authnID",
  "clientName": "device-device-001",
  "certificate": "-----BEGIN CERTIFICATE-----...",
  "privateKey": "-----BEGIN PRIVATE KEY-----...",
  "caCertificate": "-----BEGIN CERTIFICATE-----...",
  "validityDays": 365,
  "mqttHostname": "makerspace-eventgrid.westus2-1.ts.eventgrid.azure.net",
  "instructions": {
    "message": "Use the provided certificate and private key for MQTT authentication",
    "port": 8883,
    "protocol": "mqtts"
  },
  "appDeployment": {
    "enabled": true,
    "status": "deployed",
    "deploymentId": "deploy-abc123",
    "message": "bitnet_runner app deployed successfully"
  }
}
```

#### Get Device Status
```http
GET /device/{deviceId}/status
```

#### List All Devices
```http
GET /devices
```

#### Unregister Device
```http
DELETE /device/{deviceId}
```

### App Deployment

#### Deploy App to Device
```http
POST /device/{deviceId}/deploy-app
Content-Type: application/json

{
  "gitRepository": "https://github.com/bitnet_runner.git",
  "targetPath": "/opt/makerspace/apps/bitnet_runner",
  "postInstallCommands": ["npm install", "npm run build"],
  "requiredFiles": ["package.json"]
}
```

#### Get App Deployment Status
```http
GET /device/{deviceId}/app-status
```

### System Endpoints

#### Health Check
```http
GET /health
```

#### Get CA Certificate
```http
GET /ca-certificate
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
| `ENABLE_APP_DEPLOYMENT` | Enable app deployment | `false` |
| `BITNET_RUNNER_REPO` | Default app repository | `https://github.com/bitnet_runner.git` |
| `APP_DEPLOYMENT_TEMP_DIR` | Temp directory for builds | `/tmp/makerspace-deployments` |

### Azure Role Requirements

The App Service managed identity needs:
- `EventGrid Data Contributor` role on the Event Grid namespace
- `Reader` role on the resource group

## Device Client Integration

### Python Example

```python
from device_config import ConfigManager
from enhanced_device_client_with_app_deployment import EnhancedMakerspaceIoTDevice

# Create device configuration
config = ConfigManager.from_environment("my-device-001")

# Initialize device client
device = EnhancedMakerspaceIoTDevice(
    device_id=config.device_id,
    cert_service_url=config.cert_service_url
)

# Register device and get certificates
registration_data = device.register_device()

# Connect to MQTT broker
device.connect_mqtt()

# Start publishing telemetry
device.start_telemetry_loop()
```

## Development

### Local Development

```bash
cd cert-service
npm install
npm run dev
```

### Testing

```bash
# Run unit tests
npm test

# Run integration tests
./test_app_deployment.sh

# Test MQTT connection
python3 enhanced_device_client_with_app_deployment.py
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

**App Deployment Failing**
- Check git repository is accessible
- Verify build tools (npm, git) are installed on App Service
- Check deployment logs for specific errors

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

## File Structure

```text
makerspace2025/
├── infra/                          # Azure infrastructure templates
│   ├── main.bicep                  # Main deployment template
│   ├── eventGrid.bicep            # Event Grid configuration
│   ├── appService.bicep           # App Service configuration
│   └── containerApps.bicep        # Container Apps (alternative)
├── cert-service/                   # Certificate management service
│   ├── src/
│   │   ├── index.ts               # Main application
│   │   ├── certificateManager.ts  # Certificate operations
│   │   ├── eventGridClient.ts     # Event Grid integration
│   │   ├── appDeploymentManager.ts # App deployment logic
│   │   ├── config.ts              # Configuration management
│   │   ├── templates.ts           # HTML templates
│   │   ├── utils.ts               # Utility functions
│   │   └── middleware.ts          # Express middleware
│   ├── public/                    # Static assets
│   │   ├── styles.css            # Application styles
│   │   └── scripts/              # Client-side JavaScript
│   ├── Dockerfile                # Container configuration
│   └── package.json              # Node.js dependencies
├── scripts/
│   ├── generate_certs.sh         # Certificate generation
│   ├── deploy-cert-service.sh    # Service deployment
│   └── test_app_deployment.sh    # Integration testing
├── device_config.py              # Python device configuration
├── enhanced_device_client_with_app_deployment.py # Python client example
└── README.md                     # This file
```

## Future Enhancements

1. **Certificate Revocation List (CRL)** - Implement certificate revocation
2. **Azure Key Vault Integration** - Store CA certificate securely
3. **Device Provisioning Service** - Integration with Azure IoT Device Provisioning
4. **Certificate Renewal** - Automatic certificate renewal before expiry
5. **Audit Logging** - Enhanced logging for compliance
6. **Rate Limiting** - Prevent abuse of certificate issuance
7. **Multi-tenant Support** - Support multiple organizations
8. **Real-time Monitoring** - WebSocket-based real-time device monitoring
9. **Batch Operations** - Support for bulk device registration
10. **Custom App Templates** - Support for different app deployment templates

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
