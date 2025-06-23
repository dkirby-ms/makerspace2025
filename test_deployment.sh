#!/bin/bash

# Test Script for MQTT Endpoint Features
# Tests the deployed certificate service and MQTT functionality

set -e

# Configuration
CERT_SERVICE_URL="${CERT_SERVICE_URL:-http://localhost:3000}"
TEST_DEVICE_ID="test-device-$(date +%s)"
MQTT_HOSTNAME="${MQTT_HOSTNAME:-}"
TEST_DIR="/tmp/makerspace-test-$(date +%s)"
LOG_FILE="$TEST_DIR/test-results.log"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Test results tracking
TESTS_PASSED=0
TESTS_FAILED=0
TEST_RESULTS=()

# Create test directory
mkdir -p "$TEST_DIR"
cd "$TEST_DIR"

# Logging function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Print colored output
print_status() {
    local status=$1
    local message=$2
    case $status in
        "PASS")
            echo -e "${GREEN}✓ PASS${NC}: $message" | tee -a "$LOG_FILE"
            ((TESTS_PASSED++))
            TEST_RESULTS+=("PASS: $message")
            ;;
        "FAIL")
            echo -e "${RED}✗ FAIL${NC}: $message" | tee -a "$LOG_FILE"
            ((TESTS_FAILED++))
            TEST_RESULTS+=("FAIL: $message")
            ;;
        "INFO")
            echo -e "${BLUE}ℹ INFO${NC}: $message" | tee -a "$LOG_FILE"
            ;;
        "WARN")
            echo -e "${YELLOW}⚠ WARN${NC}: $message" | tee -a "$LOG_FILE"
            ;;
    esac
}

# Check prerequisites
check_prerequisites() {
    print_status "INFO" "Checking prerequisites..."
    
    local required_tools=("curl" "jq" "openssl" "python3" "pip3")
    local missing_tools=()
    
    for tool in "${required_tools[@]}"; do
        if ! command -v "$tool" &> /dev/null; then
            missing_tools+=("$tool")
        fi
    done
    
    if [ ${#missing_tools[@]} -gt 0 ]; then
        print_status "FAIL" "Missing required tools: ${missing_tools[*]}"
        return 1
    fi
    
    # Check if Python MQTT client is available
    if ! python3 -c "import paho.mqtt.client" 2>/dev/null; then
        print_status "WARN" "Installing paho-mqtt Python library..."
        pip3 install paho-mqtt requests --user --quiet
    fi
    
    print_status "PASS" "All prerequisites met"
}

# Test certificate service health
test_service_health() {
    print_status "INFO" "Testing certificate service health..."
    
    local response=$(curl -s -w "%{http_code}" -o /tmp/health_response.json "$CERT_SERVICE_URL/health" || echo "000")
    
    if [ "$response" = "200" ]; then
        print_status "PASS" "Certificate service is healthy"
        log "Health response: $(cat /tmp/health_response.json)"
    else
        print_status "FAIL" "Certificate service health check failed (HTTP $response)"
        return 1
    fi
}

# Test CA certificate retrieval
test_ca_certificate() {
    print_status "INFO" "Testing CA certificate retrieval..."
    
    local response=$(curl -s -w "%{http_code}" -o ca-certificate.pem "$CERT_SERVICE_URL/ca-certificate")
    
    if [ "$response" = "200" ] && [ -f "ca-certificate.pem" ]; then
        # Verify it's a valid certificate
        if openssl x509 -in ca-certificate.pem -text -noout > /dev/null 2>&1; then
            print_status "PASS" "CA certificate retrieved and validated"
            log "CA certificate subject: $(openssl x509 -in ca-certificate.pem -subject -noout)"
        else
            print_status "FAIL" "Retrieved CA certificate is invalid"
            return 1
        fi
    else
        print_status "FAIL" "Failed to retrieve CA certificate (HTTP $response)"
        return 1
    fi
}

# Test device registration
test_device_registration() {
    print_status "INFO" "Testing device registration for device ID: $TEST_DEVICE_ID"
    
    local registration_data="{\"deviceId\": \"$TEST_DEVICE_ID\"}"
    local response=$(curl -s -w "%{http_code}" -X POST \
        -H "Content-Type: application/json" \
        -d "$registration_data" \
        -o registration_response.json \
        "$CERT_SERVICE_URL/register-device")
    
    if [ "$response" = "201" ] || [ "$response" = "200" ]; then
        if cat registration_response.json | jq -e '.success == true' > /dev/null; then
            print_status "PASS" "Device registration successful"
            
            # Extract and save certificate files
            cat registration_response.json | jq -r '.certificate.certificate' > "$TEST_DEVICE_ID.pem"
            cat registration_response.json | jq -r '.certificate.privateKey' > "$TEST_DEVICE_ID.key"
            
            # Verify certificate files
            if openssl x509 -in "$TEST_DEVICE_ID.pem" -text -noout > /dev/null 2>&1; then
                print_status "PASS" "Device certificate is valid"
            else
                print_status "FAIL" "Device certificate is invalid"
                return 1
            fi
            
            # Store registration details for later tests
            echo "$TEST_DEVICE_ID" > device_id.txt
            cat registration_response.json | jq -r '.registration.authenticationName' > auth_name.txt
            cat registration_response.json | jq -r '.registration.clientName' > client_name.txt
            
        else
            print_status "FAIL" "Device registration returned success=false"
            log "Registration response: $(cat registration_response.json)"
            return 1
        fi
    else
        print_status "FAIL" "Device registration failed (HTTP $response)"
        log "Registration response: $(cat registration_response.json)"
        return 1
    fi
}

# Test MQTT connection
test_mqtt_connection() {
    print_status "INFO" "Testing MQTT connection..."
    
    if [ -z "$MQTT_HOSTNAME" ]; then
        print_status "WARN" "MQTT_HOSTNAME not set, skipping MQTT connection test"
        return 0
    fi
    
    if [ ! -f "$TEST_DEVICE_ID.pem" ] || [ ! -f "$TEST_DEVICE_ID.key" ]; then
        print_status "FAIL" "Device certificates not available for MQTT test"
        return 1
    fi
    
    # Create Python MQTT test script
    cat > mqtt_test.py << 'EOF'
#!/usr/bin/env python3
import sys
import ssl
import time
import json
import threading
import paho.mqtt.client as mqtt
from datetime import datetime

class MqttTester:
    def __init__(self, hostname, device_id, cert_file, key_file, ca_file):
        self.hostname = hostname
        self.device_id = device_id
        self.cert_file = cert_file
        self.key_file = key_file
        self.ca_file = ca_file
        self.connected = False
        self.message_received = False
        self.client = None
        
    def on_connect(self, client, userdata, flags, rc):
        if rc == 0:
            self.connected = True
            print(f"MQTT Connected with result code {rc}")
            # Subscribe to device command topic
            command_topic = f"devices/{self.device_id}/commands"
            client.subscribe(command_topic)
            print(f"Subscribed to {command_topic}")
        else:
            print(f"MQTT Connection failed with result code {rc}")
            
    def on_message(self, client, userdata, msg):
        self.message_received = True
        print(f"Message received on {msg.topic}: {msg.payload.decode()}")
        
    def on_disconnect(self, client, userdata, rc):
        self.connected = False
        print(f"MQTT Disconnected with result code {rc}")
        
    def test_connection(self, timeout=30):
        try:
            self.client = mqtt.Client(client_id=f"{self.device_id}-test")
            self.client.on_connect = self.on_connect
            self.client.on_message = self.on_message
            self.client.on_disconnect = self.on_disconnect
            
            # Configure TLS
            context = ssl.create_default_context(ssl.Purpose.SERVER_AUTH)
            context.load_verify_locations(self.ca_file)
            context.load_cert_chain(self.cert_file, self.key_file)
            context.check_hostname = False
            context.verify_mode = ssl.CERT_REQUIRED
            
            self.client.tls_set_context(context)
            
            print(f"Connecting to MQTT broker: {self.hostname}:8883")
            self.client.connect(self.hostname, 8883, 60)
            self.client.loop_start()
            
            # Wait for connection
            start_time = time.time()
            while not self.connected and (time.time() - start_time) < timeout:
                time.sleep(0.1)
                
            if not self.connected:
                print("MQTT connection timeout")
                return False
                
            # Send test message
            telemetry_topic = f"devices/{self.device_id}/telemetry"
            test_message = {
                "timestamp": datetime.now().isoformat(),
                "temperature": 23.5,
                "humidity": 65.2,
                "test": True
            }
            
            print(f"Publishing test message to {telemetry_topic}")
            self.client.publish(telemetry_topic, json.dumps(test_message))
            
            # Wait a bit for any responses
            time.sleep(2)
            
            self.client.loop_stop()
            self.client.disconnect()
            
            return True
            
        except Exception as e:
            print(f"MQTT test error: {e}")
            return False

if __name__ == "__main__":
    if len(sys.argv) != 6:
        print("Usage: mqtt_test.py <hostname> <device_id> <cert_file> <key_file> <ca_file>")
        sys.exit(1)
        
    tester = MqttTester(sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4], sys.argv[5])
    success = tester.test_connection()
    sys.exit(0 if success else 1)
EOF
    
    # Run MQTT test
    if python3 mqtt_test.py "$MQTT_HOSTNAME" "$TEST_DEVICE_ID" "$TEST_DEVICE_ID.pem" "$TEST_DEVICE_ID.key" "ca-certificate.pem" > mqtt_test.log 2>&1; then
        print_status "PASS" "MQTT connection test successful"
        log "MQTT test output: $(cat mqtt_test.log)"
    else
        print_status "FAIL" "MQTT connection test failed"
        log "MQTT test error: $(cat mqtt_test.log)"
    fi
}

# Test MQTT topics API
test_mqtt_topics_api() {
    print_status "INFO" "Testing MQTT topics API..."
    
    # Test topics page
    local response=$(curl -s -w "%{http_code}" -o topics_page.html "$CERT_SERVICE_URL/topics")
    
    if [ "$response" = "200" ]; then
        print_status "PASS" "MQTT topics page accessible"
    else
        print_status "FAIL" "MQTT topics page failed (HTTP $response)"
    fi
    
    # Test API endpoint for topic messages
    local test_topic="devices/test/telemetry"
    response=$(curl -s -w "%{http_code}" -o topic_messages.json "$CERT_SERVICE_URL/api/topic/$test_topic/messages")
    
    if [ "$response" = "200" ]; then
        print_status "PASS" "MQTT topic messages API accessible"
    else
        print_status "FAIL" "MQTT topic messages API failed (HTTP $response)"
    fi
}

# Test web interface
test_web_interface() {
    print_status "INFO" "Testing web interface..."
    
    # Test home page
    local response=$(curl -s -w "%{http_code}" -o home_page.html "$CERT_SERVICE_URL/")
    
    if [ "$response" = "200" ]; then
        if grep -q "Makerspace Certificate Service" home_page.html; then
            print_status "PASS" "Web interface home page accessible"
        else
            print_status "FAIL" "Web interface content not as expected"
        fi
    else
        print_status "FAIL" "Web interface failed (HTTP $response)"
    fi
}

# Cleanup test resources
cleanup_test_resources() {
    print_status "INFO" "Cleaning up test resources..."
    
    # Attempt to clean up test device (if endpoint exists)
    if [ -f "device_id.txt" ]; then
        local device_id=$(cat device_id.txt)
        curl -s -X DELETE "$CERT_SERVICE_URL/api/devices/$device_id" > /dev/null 2>&1 || true
    fi
    
    print_status "INFO" "Test cleanup completed"
}

# Generate test report
generate_test_report() {
    print_status "INFO" "Generating test report..."
    
    cat > test_report.html << EOF
<!DOCTYPE html>
<html>
<head>
    <title>Makerspace Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .pass { color: green; }
        .fail { color: red; }
        .summary { background: #f5f5f5; padding: 15px; margin: 20px 0; }
        .test-result { margin: 10px 0; padding: 5px; }
        pre { background: #f8f8f8; padding: 10px; overflow-x: auto; }
    </style>
</head>
<body>
    <h1>Makerspace MQTT Test Report</h1>
    <div class="summary">
        <h2>Test Summary</h2>
        <p>Tests Passed: <span class="pass">$TESTS_PASSED</span></p>
        <p>Tests Failed: <span class="fail">$TESTS_FAILED</span></p>
        <p>Test Date: $(date)</p>
        <p>Service URL: $CERT_SERVICE_URL</p>
        <p>Test Device ID: $TEST_DEVICE_ID</p>
    </div>
    
    <h2>Test Results</h2>
EOF

    for result in "${TEST_RESULTS[@]}"; do
        if [[ $result == PASS:* ]]; then
            echo "    <div class=\"test-result pass\">✓ ${result#PASS: }</div>" >> test_report.html
        else
            echo "    <div class=\"test-result fail\">✗ ${result#FAIL: }</div>" >> test_report.html
        fi
    done
    
    cat >> test_report.html << EOF
    
    <h2>Test Log</h2>
    <pre>$(cat "$LOG_FILE")</pre>
</body>
</html>
EOF

    print_status "INFO" "Test report generated: $TEST_DIR/test_report.html"
}

# Main test execution
main() {
    echo -e "${BLUE}======================================${NC}"
    echo -e "${BLUE}  Makerspace MQTT Test${NC}"
    echo -e "${BLUE}======================================${NC}"
    echo
    
    log "Starting test suite..."
    log "Service URL: $CERT_SERVICE_URL"
    log "Test Device ID: $TEST_DEVICE_ID"
    log "MQTT Hostname: ${MQTT_HOSTNAME:-not set}"
    log "Test Directory: $TEST_DIR"
    echo
    
    # Execute tests
    check_prerequisites || exit 1
    test_service_health || exit 1
    test_ca_certificate
    test_device_registration
    test_mqtt_connection
    test_mqtt_topics_api
    test_web_interface
    
    # Cleanup
    cleanup_test_resources
    
    # Generate report
    generate_test_report
    
    echo
    echo -e "${BLUE}======================================${NC}"
    echo -e "${BLUE}           Test Summary${NC}"
    echo -e "${BLUE}======================================${NC}"
    echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
    echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
    echo -e "Test Directory: ${BLUE}$TEST_DIR${NC}"
    echo -e "Log File: ${BLUE}$LOG_FILE${NC}"
    echo -e "Report: ${BLUE}$TEST_DIR/test_report.html${NC}"
    echo
    
    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "${GREEN}All tests passed! 🎉${NC}"
        exit 0
    else
        echo -e "${RED}Some tests failed. Check the log for details.${NC}"
        exit 1
    fi
}

# Handle script interruption
trap 'echo -e "\n${YELLOW}Test interrupted. Cleaning up...${NC}"; cleanup_test_resources; exit 130' INT TERM

# Run main function
main "$@"
