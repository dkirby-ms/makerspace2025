# Certificate Service

This directory contains the Node.js/TypeScript certificate management service.

See the main [README.md](../README.md) for complete documentation.

## Quick Development Setup

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## Environment Variables Required

```bash
EVENTGRID_NAMESPACE_NAME=your-namespace
EVENTGRID_RESOURCE_GROUP=your-resource-group  
AZURE_SUBSCRIPTION_ID=your-subscription-id
```

For complete API documentation and deployment instructions, see the main project README.

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
