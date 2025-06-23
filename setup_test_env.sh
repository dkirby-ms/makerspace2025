#!/bin/bash

# Configuration script for test environment setup
# Sets up environment variables for the test deployment script

set -e

# Default values
DEFAULT_CERT_SERVICE_URL="http://localhost:3000"
DEFAULT_MQTT_HOSTNAME=""

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${BLUE}======================================${NC}"
echo -e "${BLUE}  Makerspace Test Environment Setup${NC}"
echo -e "${BLUE}======================================${NC}"
echo

# Function to prompt for input with default
prompt_with_default() {
    local prompt=$1
    local default=$2
    local var_name=$3
    
    echo -e "${YELLOW}$prompt${NC}"
    if [ -n "$default" ]; then
        echo -e "Default: ${GREEN}$default${NC}"
        read -p "Enter value (or press Enter for default): " value
        if [ -z "$value" ]; then
            value="$default"
        fi
    else
        read -p "Enter value: " value
    fi
    
    export "$var_name"="$value"
}

# Certificate Service URL
echo "1. Certificate Service Configuration"
echo "   The URL where your certificate service is running"
echo
prompt_with_default "Certificate Service URL:" "$DEFAULT_CERT_SERVICE_URL" "CERT_SERVICE_URL"
echo

# MQTT Hostname
echo "2. MQTT Broker Configuration"
echo "   The hostname of your MQTT broker for connection testing"
echo "   Leave empty to skip MQTT connection tests"
echo
prompt_with_default "MQTT Hostname (optional):" "$DEFAULT_MQTT_HOSTNAME" "MQTT_HOSTNAME"
echo

# Create environment file
ENV_FILE=".env.test"
cat > "$ENV_FILE" << EOF
# Test Environment Configuration
# Generated on $(date)

# Certificate Service URL
export CERT_SERVICE_URL="$CERT_SERVICE_URL"

# MQTT Broker Hostname (optional)
export MQTT_HOSTNAME="$MQTT_HOSTNAME"

# Additional test configuration
export TEST_TIMEOUT=60
export TEST_VERBOSE=true
EOF

echo -e "${GREEN}✓ Environment configuration saved to $ENV_FILE${NC}"
echo

# Source the environment file
source "$ENV_FILE"

echo -e "${BLUE}Configuration Summary:${NC}"
echo -e "Certificate Service URL: ${GREEN}$CERT_SERVICE_URL${NC}"
echo -e "MQTT Hostname: ${GREEN}${MQTT_HOSTNAME:-not set}${NC}"
echo

echo -e "${YELLOW}To run the tests:${NC}"
echo -e "  ${GREEN}source $ENV_FILE && ./test_deployment.sh${NC}"
echo
echo -e "${YELLOW}Or run directly:${NC}"
echo -e "  ${GREEN}CERT_SERVICE_URL=\"$CERT_SERVICE_URL\" MQTT_HOSTNAME=\"$MQTT_HOSTNAME\" ./test_deployment.sh${NC}"
echo
