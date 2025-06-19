#!/bin/bash

# Comprehensive test script for the cloud-deployed certificate service
set -e

# Configuration
readonly CLOUD_URL="https://makerspace-cert-service.mangopond-94ff8512.westus2.azurecontainerapps.io"
readonly TEST_DEVICE_ID="cloud-test-device-$(date +%s)"

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

echo "🧪 Testing Cloud-Deployed Certificate Service"
echo "=============================================="
log_info "Service URL: $CLOUD_URL"
log_info "Test Device ID: $TEST_DEVICE_ID"
echo ""

# Test 1: Health Check
echo "1️⃣ Testing health endpoint..."
response=$(curl -s "$CLOUD_URL/health")
if [[ $response == *"healthy"* ]]; then
    log_success "Health check passed"
    echo "Response: $response"
else
    log_error "Health check failed"
    echo "Response: $response"
    exit 1
fi
echo ""

# Test 2: CA Certificate
echo "2️⃣ Testing CA certificate endpoint..."
ca_cert=$(curl -s "$CLOUD_URL/ca-certificate")
if [[ $ca_cert == *"BEGIN CERTIFICATE"* ]]; then
    log_success "CA certificate retrieved"
    echo "Certificate length: $(echo "$ca_cert" | wc -c) characters"
else
    log_error "Failed to retrieve CA certificate"
    echo "Response: $ca_cert"
    exit 1
fi
echo ""

# Test 3: Device Registration
echo "3️⃣ Testing device registration..."
register_response=$(curl -s -X POST "$CLOUD_URL/register-device" \
    -H "Content-Type: application/json" \
    -d "{\"deviceId\": \"$TEST_DEVICE_ID\", \"enableAppDeployment\": false}")

if [[ $register_response == *"certificate"* ]] || [[ $register_response == *"deviceId"* ]]; then
    log_success "Device registration successful"
    echo "Registration response (first 200 chars): ${register_response:0:200}..."
else
    log_warning "Device registration may have issues"
    echo "Response: $register_response"
fi
echo ""

# Test 4: Device Status
echo "4️⃣ Testing device status endpoint..."
status_response=$(curl -s "$CLOUD_URL/device/$TEST_DEVICE_ID/status")
log_info "Device status: $status_response"
echo ""

# Test 5: List Devices
echo "5️⃣ Testing device list endpoint..."
devices_response=$(curl -s "$CLOUD_URL/devices")
if [[ $devices_response == *"["* ]]; then
    log_success "Device list retrieved"
    echo "Devices response: $devices_response"
else
    log_warning "Device list may be empty or have issues"
    echo "Response: $devices_response"
fi
echo ""

# Test 6: Topics Endpoint
echo "6️⃣ Testing topics endpoint..."
topics_response=$(curl -s "$CLOUD_URL/topics")
log_info "Topics response: $topics_response"
echo ""

# Test 7: Web Interface
echo "7️⃣ Testing web interface..."
web_response=$(curl -s "$CLOUD_URL/" | head -c 100)
if [[ $web_response == *"html"* ]] || [[ $web_response == *"Makerspace"* ]]; then
    log_success "Web interface accessible"
    echo "Web response (first 100 chars): $web_response"
else
    log_warning "Web interface may have issues"
    echo "Response: $web_response"
fi
echo ""

echo "🎉 Cloud service testing completed!"
echo "Service is running at: $CLOUD_URL"
echo "You can access the web interface in your browser."
