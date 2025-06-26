#!/bin/bash
# Standalone MQTT Connection Test Script
# Tests MQTT connection using client certificates

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Load test environment if available
if [ -f "$SCRIPT_DIR/.env.test" ]; then
    echo "Loading test environment from .env.test..."
    source "$SCRIPT_DIR/.env.test"
fi

# Configuration - can be overridden by environment variables
MQTT_HOSTNAME="${MQTT_HOSTNAME:-}"
CLIENT_CERT="${CLIENT_CERT:-client1-authnID.pem}"
CLIENT_KEY="${CLIENT_KEY:-client1-authnID.key}"
CA_CERT="${CA_CERT:-intermediate_ca.crt}"
TEST_DEVICE_ID="${TEST_DEVICE_ID:-client1-authnID}"

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "========================================"
echo "MQTT Connection Test"
echo "========================================"

# Function to print colored status
print_status() {
    local status=$1
    local message=$2
    case $status in
        "PASS")
            echo -e "${GREEN}✓ PASS${NC}: $message"
            ;;
        "FAIL")
            echo -e "${RED}✗ FAIL${NC}: $message"
            ;;
        "WARN")
            echo -e "${YELLOW}⚠ WARN${NC}: $message"
            ;;
        "INFO")
            echo -e "ℹ INFO: $message"
            ;;
    esac
}

# Check if MQTT hostname is provided
if [ -z "$MQTT_HOSTNAME" ]; then
    print_status "FAIL" "MQTT_HOSTNAME not set"
    echo "Usage: MQTT_HOSTNAME=your-mqtt-broker.com $0"
    echo "   or: $0 <mqtt-hostname>"
    exit 1
fi

# Override hostname if provided as argument
if [ $# -eq 1 ]; then
    MQTT_HOSTNAME="$1"
fi

echo "MQTT Hostname: $MQTT_HOSTNAME"
echo "Client Certificate: $CLIENT_CERT"
echo "Client Key: $CLIENT_KEY"
echo "Device ID: $TEST_DEVICE_ID"
echo ""

# Test MQTT connection function
test_mqtt_connection() {
    print_status "INFO" "Starting MQTT connection test..."
    
    # Check if required files exist
    if [ ! -f "$CLIENT_CERT" ]; then
        print_status "FAIL" "Client certificate not found: $CLIENT_CERT"
        return 1
    fi
    
    if [ ! -f "$CLIENT_KEY" ]; then
        print_status "FAIL" "Client key not found: $CLIENT_KEY"
        return 1
    fi
    
    print_status "PASS" "Required certificate files found"
    
    # Check if mosquitto_pub is available
    if ! command -v mosquitto_pub &> /dev/null; then
        print_status "FAIL" "mosquitto_pub not found"
        echo "Please install mosquitto-clients: sudo apt-get install mosquitto-clients"
        return 1
    fi
    
    print_status "PASS" "mosquitto_pub is available"
    
    # Create test message
    local test_message='{"timestamp":"'$(date -Iseconds)'","temperature":23.5,"humidity":65.2,"test":true}'
    local test_topic="devices/$TEST_DEVICE_ID/telemetry"
    
    print_status "INFO" "Testing MQTT connection to $MQTT_HOSTNAME:8883..."
    print_status "INFO" "Publishing to topic: $test_topic"
    
    # Test MQTT publish with certificate authentication
    echo "Debug: Running mosquitto_pub with verbose output..."
    timeout 15 mosquitto_pub \
        -h "$MQTT_HOSTNAME" \
        -p 8883 \
        --cert "$CLIENT_CERT" \
        --key "$CLIENT_KEY" \
        -t "$test_topic" \
        -m "$test_message" \
        -q 1 \
        --insecure \
        -d
    
    local exit_code=$?
    
    if [ $exit_code -eq 0 ]; then
        
        print_status "PASS" "MQTT message published successfully"
        echo "Test message: $test_message"
        return 0
    else
        print_status "FAIL" "MQTT connection failed (exit code: $exit_code)"
        echo ""
        echo "MQTT Error Codes:"
        echo "  1: Connection refused - unacceptable protocol version"
        echo "  2: Connection refused - identifier rejected"  
        echo "  3: Connection refused - server unavailable"
        echo "  4: Connection refused - bad username or password"
        echo "  5: Connection refused - not authorized"
        echo ""
        echo "Possible causes:"
        echo "- MQTT broker is not running or not accessible"
        echo "- Certificate authentication failed"
        echo "- Network connectivity issues"
        echo "- Firewall blocking port 8883"
        return 1
    fi
}

# Test MQTT subscription (optional)
test_mqtt_subscribe() {
    print_status "INFO" "Testing MQTT subscription..."
    
    local command_topic="devices/$TEST_DEVICE_ID/commands"
    
    print_status "INFO" "Subscribing to topic: $command_topic (5 second timeout)"
    
    # Test MQTT subscribe with certificate authentication
    if timeout 5 mosquitto_sub \
        -h "$MQTT_HOSTNAME" \
        -p 8883 \
        --cert "$CLIENT_CERT" \
        --key "$CLIENT_KEY" \
        -t "$command_topic" \
        -C 1 \
        --insecure \
        -v 2>/dev/null; then
        
        print_status "PASS" "MQTT subscription test successful"
        return 0
    else
        print_status "WARN" "MQTT subscription timeout (no messages received)"
        return 0  # Not a failure, just no messages
    fi
}

# Run tests
echo "Running MQTT connection tests..."
echo ""

if test_mqtt_connection; then
    echo ""
    test_mqtt_subscribe
    echo ""
    print_status "PASS" "MQTT connection test completed successfully"
    exit 0
else
    echo ""
    print_status "FAIL" "MQTT connection test failed"
    exit 1
fi
