# Makerspace MQTT and App Deployment Test Suite

This directory contains comprehensive test scripts for validating the deployed MQTT endpoint and app deployment features of the Makerspace certificate service.

## Test Scripts

### `test_deployment.sh`
The main test script that validates all components of the system:

**Features Tested:**
- Certificate service health endpoint
- CA certificate retrieval and validation
- Device registration with certificate generation
- App deployment functionality
- MQTT connection and messaging
- MQTT topics API endpoints
- Web interface accessibility

**Test Flow:**
1. Prerequisites check (required tools and dependencies)
2. Service health validation
3. CA certificate retrieval and verification
4. Device registration with unique test device ID
5. App deployment with configurable repository
6. MQTT connection testing with generated certificates
7. MQTT topics API validation
8. Web interface accessibility check
9. Cleanup and report generation

### `setup_test_env.sh`
Interactive environment setup script for configuring test parameters.

**Configuration Options:**
- Certificate Service URL (default: http://localhost:3000)
- MQTT Hostname (optional, for connection testing)
- Additional test parameters

## Prerequisites

### System Requirements
- `curl` - For HTTP API testing
- `jq` - For JSON response parsing
- `openssl` - For certificate validation
- `python3` - For MQTT connection testing
- `pip3` - For Python package installation

### Python Dependencies
The script automatically installs required Python packages:
- `paho-mqtt` - MQTT client library
- `requests` - HTTP client library

## Usage

### Quick Start

1. **Setup Environment:**
   ```bash
   ./setup_test_env.sh
   ```

2. **Run Tests:**
   ```bash
   source .env.test && ./test_deployment.sh
   ```

### Manual Configuration

Set environment variables and run directly:

```bash
export CERT_SERVICE_URL="https://your-service-url.com"
export MQTT_HOSTNAME="your-mqtt-broker.com"
./test_deployment.sh
```

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `CERT_SERVICE_URL` | URL of the certificate service | `http://localhost:3000` | Yes |
| `MQTT_HOSTNAME` | MQTT broker hostname for connection testing | - | No |
| `TEST_TIMEOUT` | Test timeout in seconds | 60 | No |
| `TEST_VERBOSE` | Enable verbose logging | true | No |

## Test Outputs

### Console Output
Real-time test progress with color-coded status messages:
- 🟢 **PASS**: Test succeeded
- 🔴 **FAIL**: Test failed
- 🔵 **INFO**: Informational message
- 🟡 **WARN**: Warning message

### Log Files
All test activities are logged to timestamped files in the test directory:
- `test-results.log` - Detailed test execution log
- `test_report.html` - HTML test report with summary and results

### Generated Files
During testing, the following files are created in the test directory:
- `ca-certificate.pem` - Downloaded CA certificate
- `{device-id}.pem` - Generated device certificate
- `{device-id}.key` - Generated device private key
- `registration_response.json` - Device registration response
- `deployment_response.json` - App deployment response
- `mqtt_test.log` - MQTT connection test output

## Test Scenarios

### 1. Certificate Service Health
- **Endpoint:** `GET /health`
- **Validates:** Service availability and health status
- **Expected:** HTTP 200 with health information

### 2. CA Certificate Retrieval
- **Endpoint:** `GET /api/devices/ca-certificate`
- **Validates:** CA certificate download and format
- **Expected:** Valid PEM certificate file

### 3. Device Registration
- **Endpoint:** `POST /api/devices/register-device`
- **Payload:** `{"deviceId": "test-device-{timestamp}"}`
- **Validates:** 
  - Successful device registration
  - Certificate generation
  - Authentication name assignment
- **Expected:** HTTP 201 with device credentials

### 4. App Deployment
- **Endpoint:** `POST /api/devices/deploy-app`
- **Payload:** Device info and app configuration
- **Validates:**
  - App deployment process
  - Configuration generation
  - Package creation
- **Expected:** HTTP 200 with deployment details

### 5. MQTT Connection
- **Protocol:** MQTTS (TLS 1.2+)
- **Port:** 8883
- **Authentication:** Client certificates
- **Validates:**
  - TLS connection establishment
  - Certificate-based authentication
  - Message publishing capability
- **Expected:** Successful connection and message transmission

### 6. MQTT Topics API
- **Endpoint:** `GET /topics`
- **Endpoint:** `GET /api/topic/{topicName}/messages`
- **Validates:** Web interface for MQTT monitoring
- **Expected:** HTTP 200 with topic information

### 7. Web Interface
- **Endpoint:** `GET /`
- **Validates:** Main web interface accessibility
- **Expected:** HTTP 200 with service home page

## Troubleshooting

### Common Issues

1. **Service Not Running**
   ```
   Error: Certificate service health check failed
   ```
   - Verify the service is running at the specified URL
   - Check network connectivity
   - Validate service configuration

2. **Missing Dependencies**
   ```
   Error: Missing required tools: jq
   ```
   - Install missing tools using your package manager
   - For Ubuntu/Debian: `sudo apt-get install curl jq openssl python3 python3-pip`

3. **MQTT Connection Failure**
   ```
   Error: MQTT connection test failed
   ```
   - Verify MQTT_HOSTNAME is correct
   - Check MQTT broker is running and accessible
   - Validate certificate configuration
   - Check firewall settings for port 8883

4. **Certificate Validation Error**
   ```
   Error: Device certificate is invalid
   ```
   - Check CA certificate generation
   - Verify certificate service configuration
   - Review certificate validity period

### Debug Mode

Enable verbose output by setting:
```bash
export TEST_VERBOSE=true
```

View detailed logs in the generated log files located in the test directory.

## Security Notes

- Test device certificates are temporary and cleaned up after testing
- Private keys are stored temporarily in the test directory
- All test artifacts should be removed after testing
- Use unique device IDs to avoid conflicts

## Integration with CI/CD

The test script returns appropriate exit codes for automation:
- `0` - All tests passed
- `1` - One or more tests failed
- `130` - Test interrupted

Example GitHub Actions usage:
```yaml
- name: Test MQTT and App Deployment
  run: |
    export CERT_SERVICE_URL="${{ secrets.CERT_SERVICE_URL }}"
    export MQTT_HOSTNAME="${{ secrets.MQTT_HOSTNAME }}"
    ./test_deployment.sh
```

## Contributing

When adding new tests:
1. Follow the existing test pattern with status reporting
2. Add appropriate logging and error handling
3. Update the test summary and report generation
4. Document new environment variables or requirements
5. Test both success and failure scenarios
