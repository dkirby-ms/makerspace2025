# Certificate Service

## Overview
This service issues X.509 certificates to IoT devices and registers them as MQTT clients in Azure Event Grid namespace.

## Features
- Generate CA certificates and device certificates
- Register devices as MQTT clients in Event Grid
- REST API for device management
- Containerized deployment on Azure App Service

## API Endpoints

### Health Check
```
GET /health
```

### Get CA Certificate
```
GET /ca-certificate
```
Returns the CA certificate in PEM format for device verification.

### Register Device
```
POST /register-device
Content-Type: application/json

{
  "deviceId": "device-001"
}
```
Generates a certificate for the device and registers it in Event Grid.

### Get Device Status
```
GET /device/{deviceId}/status
```

### List Devices
```
GET /devices
```

### Unregister Device
```
DELETE /device/{deviceId}
```

## Environment Variables
- `EVENTGRID_NAMESPACE_NAME`: Event Grid namespace name
- `EVENTGRID_RESOURCE_GROUP`: Resource group containing Event Grid
- `AZURE_SUBSCRIPTION_ID`: Azure subscription ID
- `CA_CERT_SUBJECT`: CA certificate subject (optional)
- `CERT_VALIDITY_DAYS`: Certificate validity in days (default: 365)

## Development

### Prerequisites
- Node.js 18+
- TypeScript
- Azure CLI (for deployment)

### Setup
```bash
cd cert-service
npm install
npm run build
npm start
```

### Docker Build
```bash
docker build -t cert-service .
docker run -p 3000:3000 cert-service
```

## Deployment
The service deploys automatically as part of the infrastructure template to Azure App Service with container support.
