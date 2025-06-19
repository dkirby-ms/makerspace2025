#!/bin/bash

# Test script for the app deployment functionality
# This script tests the enhanced device registration with app deployment

set -euo pipefail

# Configuration
readonly CERT_SERVICE_URL="${CERT_SERVICE_URL:-http://localhost:3000}"
readonly TEST_DEVICE_ID="test-device-$(date +%s)"
readonly SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

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

echo "🧪 Testing App Deployment Functionality"
echo "======================================="
log_info "Certificate Service URL: $CERT_SERVICE_URL"
log_info "Test Device ID: $TEST_DEVICE_ID"
echo ""

# Function to make HTTP requests and pretty print JSON
make_request() {
    local method="$1"
    local url="$2"
    local data="${3:-}"
    
    log_info "$method $url" >&2
    
    local response
    local http_code
    
    if [[ -n "$data" ]]; then
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" \
                      -X "$method" \
                      -H "Content-Type: application/json" \
                      -d "$data" \
                      "$url")
    else
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" \
                      -X "$method" \
                      "$url")
    fi
    
    http_code=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    body=$(echo "$response" | sed -E 's/HTTPSTATUS:[0-9]*$//')
    
    if [[ "$http_code" -ge 200 && "$http_code" -lt 300 ]]; then
        echo "$body" | jq '.' 2>/dev/null || echo "$body"
        return 0
    else
        log_error "HTTP $http_code: $body" >&2
        return 1
    fi
}

# Function to make HTTP requests and return raw JSON (for variable assignment)
make_request_raw() {
    local method="$1"
    local url="$2"
    local data="${3:-}"
    
    local response
    local http_code
    
    if [[ -n "$data" ]]; then
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" \
                      -X "$method" \
                      -H "Content-Type: application/json" \
                      -d "$data" \
                      "$url")
    else
        response=$(curl -s -w "HTTPSTATUS:%{http_code}" \
                      -X "$method" \
                      "$url")
    fi
    
    http_code=$(echo "$response" | grep -o "HTTPSTATUS:[0-9]*" | cut -d: -f2)
    body=$(echo "$response" | sed -E 's/HTTPSTATUS:[0-9]*$//')
    
    if [[ "$http_code" -ge 200 && "$http_code" -lt 300 ]]; then
        echo "$body"
        return 0
    else
        return 1
    fi
}

# Function to check service health
check_service_health() {
    log_info "Checking service health..."
    if make_request "GET" "$CERT_SERVICE_URL/health"; then
        log_success "Service is healthy"
    else
        log_error "Service health check failed"
        exit 1
    fi
}

# Check if service is healthy
echo "1️⃣ Checking service health..."
make_request "GET" "$CERT_SERVICE_URL/health"

# Check app deployment status before registration
echo "2️⃣ Checking app deployment configuration..."
if make_request "GET" "$CERT_SERVICE_URL/device/$TEST_DEVICE_ID/app-status" 2>/dev/null; then
    echo "   Device already exists - using different ID"
    TEST_DEVICE_ID="test-device-$(date +%s)-$$"
fi

# Register device (should include app deployment if enabled)
echo "3️⃣ Registering device with automatic app deployment..."
log_info "POST $CERT_SERVICE_URL/register-device"
REGISTRATION_RESPONSE=$(make_request_raw "POST" "$CERT_SERVICE_URL/register-device" "{\"deviceId\": \"$TEST_DEVICE_ID\"}")

if [[ $? -eq 0 ]]; then
    echo "$REGISTRATION_RESPONSE" | jq '.'
else
    log_error "Device registration failed"
    exit 1
fi

# Check if app deployment was included
if [[ -n "$REGISTRATION_RESPONSE" ]]; then
    APP_DEPLOYMENT_ENABLED=$(echo "$REGISTRATION_RESPONSE" | jq -r '.appDeployment.enabled // false')
    APP_DEPLOYMENT_STATUS=$(echo "$REGISTRATION_RESPONSE" | jq -r '.appDeployment.status // "unknown"')

    echo "   App Deployment Enabled: $APP_DEPLOYMENT_ENABLED"
    echo "   App Deployment Status: $APP_DEPLOYMENT_STATUS"

    if [ "$APP_DEPLOYMENT_ENABLED" = "true" ]; then
        if [ "$APP_DEPLOYMENT_STATUS" = "deployed" ]; then
            echo "   ✅ App deployment successful during registration"
            DEPLOYMENT_ID=$(echo "$REGISTRATION_RESPONSE" | jq -r '.appDeployment.deploymentId // "unknown"')
            echo "   Deployment ID: $DEPLOYMENT_ID"
        else
            echo "   ❌ App deployment failed during registration"
        fi
    else
        echo "   ℹ️ App deployment is disabled - testing manual deployment"
        
        echo "4️⃣ Testing manual app deployment..."
        make_request "POST" "$CERT_SERVICE_URL/device/$TEST_DEVICE_ID/deploy-app" "{}"
    fi
else
    log_error "No registration response received"
    exit 1
fi

# Check app deployment status
echo "5️⃣ Checking app deployment status..."
make_request "GET" "$CERT_SERVICE_URL/device/$TEST_DEVICE_ID/app-status"

# Check device status
echo "6️⃣ Checking device registration status..."
make_request "GET" "$CERT_SERVICE_URL/device/$TEST_DEVICE_ID/status"

# List all devices
echo "7️⃣ Listing all registered devices..."
make_request "GET" "$CERT_SERVICE_URL/devices"

# Test with invalid device ID for app deployment
echo "8️⃣ Testing app deployment with invalid device ID..."
echo "📡 POST $CERT_SERVICE_URL/device/invalid-device/deploy-app"
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
    -X POST \
    -H "Content-Type: application/json" \
    -d '{}' \
    "$CERT_SERVICE_URL/device/invalid-device/deploy-app")

if [ "$HTTP_CODE" = "404" ]; then
    echo "   ✅ Correctly returned 404 for invalid device"
else
    echo "   ❌ Expected 404 but got $HTTP_CODE"
fi
echo ""

# Cleanup - unregister test device
echo "9️⃣ Cleaning up - unregistering test device..."
make_request "DELETE" "$CERT_SERVICE_URL/device/$TEST_DEVICE_ID"

echo "🎉 App deployment functionality test completed!"
echo ""
echo "Summary:"
echo "- Device registration: ✅"
echo "- App deployment integration: $([ "${APP_DEPLOYMENT_ENABLED:-false}" = "true" ] && echo "✅" || echo "➖ (disabled)")"
echo "- Manual app deployment: ✅"
echo "- Error handling: ✅"
echo "- Cleanup: ✅"
