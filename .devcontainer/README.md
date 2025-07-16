# Codespaces Setup

This repository is configured with GitHub Codespaces for a consistent development environment.

## Quick Start

1. Click the "Code" button on GitHub
2. Select "Create codespace on main"
3. Wait for the environment to build (first time may take 3-5 minutes)
4. Once ready, source the environment variables: `source .env.test`

## What's Included

The Codespace comes pre-configured with:

- **Node.js 22** with TypeScript support
- **Azure CLI** for Azure resource management
- **step-cli** for certificate management
- **mosquitto** for MQTT operations
- **Docker** for containerization
- **kubectl** for Kubernetes management
- **GitHub CLI** for GitHub operations

## VS Code Extensions

The following extensions are automatically installed:

- Azure Bicep support
- TypeScript language support
- Azure resource management tools
- Container Apps support
- JSON and YAML support
- Prettier for code formatting

## Development Tasks

Use the Command Palette (Ctrl+Shift+P) and search for "Tasks" to run:

- **Install Dependencies**: Install npm packages for the certificate service
- **Start Certificate Service**: Run the development server
- **Run Tests**: Execute the test suite
- **Generate Certificates**: Create certificates using step-cli
- **Test MQTT Connection**: Test connectivity to Azure Event Grid
- **Deploy Infrastructure**: Deploy Bicep templates to Azure
- **Deploy Certificate Service**: Deploy the service to Azure

## Port Forwarding

The following ports are automatically forwarded:

- **3000**: Certificate Service (development server)
- **8883**: MQTT Broker
- **8080**: Additional development server

## Environment Variables

The `.env.test` file is automatically mounted and contains all necessary configuration for:

- Azure subscription details
- Certificate paths and content
- MQTT broker configuration
- Service URLs

## Debugging

Two debug configurations are available:

1. **Debug Certificate Service**: Debug the main application
2. **Debug Tests**: Debug Jest test runs

Access these through the Run and Debug panel (Ctrl+Shift+D).

## File Structure

```text
.devcontainer/
├── devcontainer.json    # Main Codespace configuration
├── Dockerfile          # Custom container definition
└── setup.sh           # Post-creation setup script

.vscode/
├── tasks.json         # Development tasks
└── launch.json        # Debug configurations
```

## Troubleshooting

If you encounter issues:

1. Check the terminal output during setup
2. Ensure all scripts have execute permissions: `chmod +x *.sh`
3. Verify environment variables are loaded: `echo $CERT_SERVICE_URL`
4. Restart the Codespace if needed

## Manual Setup

If automatic setup fails, run these commands:

```bash
# Source environment variables
source .env.test

# Install certificate service dependencies
cd cert-service && npm install

# Make scripts executable
chmod +x ../*.sh

# Verify tools are installed
step version
mosquitto_pub --help
az version
```
