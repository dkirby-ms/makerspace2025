#!/bin/bash

# Device Enrollment Script
# Simple wrapper for device enrollment with the Makerspace Certificate Service

set -e

# Default values
DEVICE_ID=""
CERT_SERVICE_URL="${CERT_SERVICE_URL:-http://localhost:3000}"
CERT_DIR="./certs"
TELEMETRY_INTERVAL=30
NO_TELEMETRY=false
LOG_LEVEL="INFO"

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

usage() {
    cat << EOF
Makerspace Device Enrollment Script

USAGE:
    $0 [OPTIONS] <device-id>

ARGUMENTS:
    device-id           Unique identifier for the device (required)

OPTIONS:
    -u, --url URL       Certificate service URL (default: $CERT_SERVICE_URL)
    -d, --cert-dir DIR  Certificate directory (default: $CERT_DIR)
    -i, --interval SEC  Telemetry interval in seconds (default: $TELEMETRY_INTERVAL)
    -n, --no-telemetry  Disable automatic telemetry publishing
    -l, --log-level LVL Logging level: DEBUG, INFO, WARNING, ERROR (default: $LOG_LEVEL)
    -t, --test-only     Run enrollment test and exit (don't start telemetry loop)
    -h, --help          Show this help message

ENVIRONMENT VARIABLES:
    CERT_SERVICE_URL    Certificate service URL
    MQTT_HOSTNAME       MQTT broker hostname (optional)
    
EXAMPLES:
    # Basic enrollment
    $0 my-device-001
    
    # Custom service URL
    $0 -u https://cert-service.azurewebsites.net my-device-001
    
    # Test enrollment only
    $0 --test-only my-device-001
    
    # Custom settings
    $0 -u https://my-service.net -d /opt/certs -i 60 my-device-001

EOF
}

check_dependencies() {
    log_info "Checking dependencies..."
    
    # Check Python
    if ! command -v python3 &> /dev/null; then
        log_error "python3 is not installed"
        return 1
    fi
    
    # Check if device client exists
    if [ ! -f "enhanced_device_client_with_app_deployment.py" ]; then
        log_error "enhanced_device_client_with_app_deployment.py not found"
        log_error "Make sure you're running this script from the correct directory"
        return 1
    fi
    
    # Check if device_config exists
    if [ ! -f "device_config.py" ]; then
        log_error "device_config.py not found"
        return 1
    fi
    
    # Try to install requirements if requirements file exists
    if [ -f "device_requirements.txt" ]; then
        log_info "Installing Python dependencies..."
        if ! python3 -m pip install -r device_requirements.txt --quiet; then
            log_warning "Failed to install some dependencies. You may need to install them manually:"
            log_warning "pip3 install requests paho-mqtt"
        fi
    fi
    
    log_success "Dependencies check completed"
}

validate_device_id() {
    local device_id="$1"
    
    # Check length
    if [ ${#device_id} -lt 3 ] || [ ${#device_id} -gt 50 ]; then
        log_error "Device ID must be between 3 and 50 characters"
        return 1
    fi
    
    # Check format (alphanumeric, hyphens, underscores only)
    if ! echo "$device_id" | grep -qE '^[a-zA-Z0-9_-]+$'; then
        log_error "Device ID must contain only alphanumeric characters, hyphens, and underscores"
        return 1
    fi
    
    return 0
}

run_enrollment() {
    local device_id="$1"
    
    log_info "Starting device enrollment for: $device_id"
    log_info "Certificate Service: $CERT_SERVICE_URL"
    log_info "Certificate Directory: $CERT_DIR"
    
    # Build command arguments
    local cmd_args=()
    cmd_args+=("$device_id")
    cmd_args+=("--cert-service-url" "$CERT_SERVICE_URL")
    cmd_args+=("--cert-dir" "$CERT_DIR")
    cmd_args+=("--telemetry-interval" "$TELEMETRY_INTERVAL")
    cmd_args+=("--log-level" "$LOG_LEVEL")
    
    if [ "$NO_TELEMETRY" = true ]; then
        cmd_args+=("--no-telemetry")
    fi
    
    # Run the Python client
    log_info "Executing: python3 enhanced_device_client_with_app_deployment.py ${cmd_args[*]}"
    python3 enhanced_device_client_with_app_deployment.py "${cmd_args[@]}"
}

run_test_only() {
    local device_id="$1"
    
    log_info "Running enrollment test for: $device_id"
    log_info "Testing device enrollment without starting telemetry loop"
    
    # Use the enhanced device client with no-telemetry flag for testing
    # This will perform enrollment, connect to MQTT briefly, then exit
    python3 enhanced_device_client_with_app_deployment.py \
        "$device_id" \
        --cert-service-url "$CERT_SERVICE_URL" \
        --cert-dir "$CERT_DIR" \
        --no-telemetry \
        --log-level "$LOG_LEVEL"
}

main() {
    local test_only=false
    
    # Parse command line arguments
    while [[ $# -gt 0 ]]; do
        case $1 in
            -u|--url)
                CERT_SERVICE_URL="$2"
                shift 2
                ;;
            -d|--cert-dir)
                CERT_DIR="$2"
                shift 2
                ;;
            -i|--interval)
                TELEMETRY_INTERVAL="$2"
                shift 2
                ;;
            -n|--no-telemetry)
                NO_TELEMETRY=true
                shift
                ;;
            -l|--log-level)
                LOG_LEVEL="$2"
                shift 2
                ;;
            -t|--test-only)
                test_only=true
                shift
                ;;
            -h|--help)
                usage
                exit 0
                ;;
            -*)
                log_error "Unknown option: $1"
                usage
                exit 1
                ;;
            *)
                if [ -z "$DEVICE_ID" ]; then
                    DEVICE_ID="$1"
                else
                    log_error "Multiple device IDs provided"
                    usage
                    exit 1
                fi
                shift
                ;;
        esac
    done
    
    # Check if device ID is provided
    if [ -z "$DEVICE_ID" ]; then
        log_error "Device ID is required"
        usage
        exit 1
    fi
    
    # Validate device ID
    if ! validate_device_id "$DEVICE_ID"; then
        exit 1
    fi
    
    # Check dependencies
    if ! check_dependencies; then
        exit 1
    fi
    
    echo
    echo "🚀 Makerspace Device Enrollment"
    echo "==============================="
    
    # Run enrollment
    if [ "$test_only" = true ]; then
        run_test_only "$DEVICE_ID"
    else
        run_enrollment "$DEVICE_ID"
    fi
}

# Run main function with all arguments
main "$@"
