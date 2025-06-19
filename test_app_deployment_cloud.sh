#!/bin/bash

# Comprehensive test script for app deployment functionality
set -e

# Configuration
readonly CLOUD_URL="https://makerspace-cert-service.mangopond-94ff8512.westus2.azurecontainerapps.io"
readonly TEST_DEVICE_ID="app-deploy-test-$(date +%s)"

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

echo "🚀 Testing App Deployment Functionality"
echo "========================================"
log_info "Service URL: $CLOUD_URL"
log_info "Test Device ID: $TEST_DEVICE_ID"
echo ""

# Test 1: Register device with app deployment enabled
echo "1️⃣ Registering device with app deployment enabled..."
register_response=$(curl -s -X POST "$CLOUD_URL/register-device" \
    -H "Content-Type: application/json" \
    -d "{\"deviceId\": \"$TEST_DEVICE_ID\", \"enableAppDeployment\": true}")

echo "Registration response: $register_response"

if [[ $register_response == *"success"* ]] && [[ $register_response == *"true"* ]]; then
    log_success "Device registered successfully with app deployment"
else
    log_error "Failed to register device with app deployment"
    echo "Response: $register_response"
    exit 1
fi
echo ""

# Test 2: Check app deployment status
echo "2️⃣ Checking app deployment status..."
status_response=$(curl -s -w "\nHTTP_CODE:%{http_code}" "$CLOUD_URL/device/$TEST_DEVICE_ID/app-status")
http_code=$(echo "$status_response" | grep "HTTP_CODE:" | cut -d: -f2)
response_body=$(echo "$status_response" | sed '/HTTP_CODE:/d')

echo "HTTP Code: $http_code"
echo "Status response: $response_body"

if [ "$http_code" = "200" ]; then
    log_success "App status endpoint accessible"
    if [[ $response_body == *"enabled"* ]]; then
        log_success "App deployment status retrieved"
    else
        log_warning "App deployment may be disabled"
    fi
elif [ "$http_code" = "404" ]; then
    log_error "Device not found for app status"
else
    log_error "App status endpoint failed with HTTP $http_code"
fi
echo ""

# Test 3: Attempt app deployment
echo "3️⃣ Testing app deployment..."
deploy_response=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$CLOUD_URL/device/$TEST_DEVICE_ID/deploy-app" \
    -H "Content-Type: application/json" \
    -d '{
        "gitRepository": "https://github.com/bitnet_runner.git",
        "targetPath": "/opt/makerspace/apps/bitnet_runner",
        "postInstallCommands": ["npm install", "npm run build"],
        "requiredFiles": ["package.json"]
    }')

deploy_http_code=$(echo "$deploy_response" | grep "HTTP_CODE:" | cut -d: -f2)
deploy_body=$(echo "$deploy_response" | sed '/HTTP_CODE:/d')

echo "HTTP Code: $deploy_http_code"
echo "Deploy response: $deploy_body"

if [ "$deploy_http_code" = "200" ]; then
    log_success "App deployment endpoint accessible"
    if [[ $deploy_body == *"success"* ]]; then
        log_success "App deployment completed successfully"
    else
        log_warning "App deployment may have issues"
    fi
elif [ "$deploy_http_code" = "404" ]; then
    log_error "Device not found for deployment"
elif [ "$deploy_http_code" = "500" ]; then
    log_error "Server error during deployment"
    echo "This might be due to:"
    echo "  - App deployment disabled in environment"
    echo "  - Missing deployment dependencies"
    echo "  - Container permissions issues"
else
    log_error "App deployment failed with HTTP $deploy_http_code"
fi
echo ""

# Test 4: Test with different app configurations
echo "4️⃣ Testing alternative app configuration..."
alt_deploy_response=$(curl -s -w "\nHTTP_CODE:%{http_code}" -X POST "$CLOUD_URL/device/$TEST_DEVICE_ID/deploy-app" \
    -H "Content-Type: application/json" \
    -d '{
        "gitRepository": "https://github.com/sample/test-app.git",
        "targetPath": "/tmp/test-app"
    }')

alt_http_code=$(echo "$alt_deploy_response" | grep "HTTP_CODE:" | cut -d: -f2)
alt_body=$(echo "$alt_deploy_response" | sed '/HTTP_CODE:/d')

echo "HTTP Code: $alt_http_code"
echo "Alternative deploy response: $alt_body"
echo ""

# Test 5: Check device list includes our test device
echo "5️⃣ Verifying device registration..."
devices_response=$(curl -s "$CLOUD_URL/devices")
if [[ $devices_response == *"$TEST_DEVICE_ID"* ]]; then
    log_success "Test device found in device list"
else
    log_warning "Test device not found in device list"
fi
echo "Devices: $devices_response"
echo ""

echo "📊 App Deployment Test Summary"
echo "=============================="
echo "Device ID: $TEST_DEVICE_ID"
echo "Registration: $([ $? -eq 0 ] && echo "✅ SUCCESS" || echo "❌ FAILED")"
echo "App Status: HTTP $http_code $([ "$http_code" = "200" ] && echo "✅" || echo "❌")"
echo "App Deploy: HTTP $deploy_http_code $([ "$deploy_http_code" = "200" ] && echo "✅" || echo "❌")"
echo ""
echo "🔍 Troubleshooting Notes:"
echo "- If app deployment returns 500 errors, check if ENABLE_APP_DEPLOYMENT=true in container environment"
echo "- App deployment requires container to have git, npm, and filesystem permissions"
echo "- Check container logs with: az containerapp logs show --name makerspace-cert-service --resource-group rg-Makerspace2025"
