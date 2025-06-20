#!/usr/bin/env python3
"""
Simple device enrollment example
Demonstrates how to use the enhanced device client for enrollment
"""

import sys
import os
from pathlib import Path

# Add current directory to path so we can import our modules
sys.path.insert(0, str(Path(__file__).parent))

from device_config import ConfigManager
from enhanced_device_client_with_app_deployment import EnhancedMakerspaceIoTDevice


def enroll_device_example():
    """Example of device enrollment process"""
    
    # Device configuration
    device_id = "example-device-001"
    cert_service_url = os.getenv("CERT_SERVICE_URL", "http://localhost:3000")
    mqtt_hostname = os.getenv("MQTT_HOSTNAME", "makerspace-eventgrid.westus2-1.ts.eventgrid.azure.net")
    
    print(f"🚀 Makerspace Device Enrollment Example")
    print(f"Device ID: {device_id}")
    print(f"Certificate Service: {cert_service_url}")
    print(f"MQTT Hostname: {mqtt_hostname}")
    print("-" * 50)
    
    # Validate device ID
    if not ConfigManager.validate_device_id(device_id):
        print(f"❌ Invalid device ID: {device_id}")
        return False
    
    try:
        # Create device client
        device = EnhancedMakerspaceIoTDevice(
            device_id=device_id,
            cert_service_url=cert_service_url
        )
        
        # Step 1: Register device and get certificates
        print("Step 1: Registering device...")
        registration = device.register_device()
        print(f"✅ Registration successful!")
        print(f"   Device ID: {registration.device_id}")
        print(f"   Authentication Name: {registration.authentication_name}")
        print(f"   Client Name: {registration.client_name}")
        print(f"   Certificate received: {len(registration.certificate_pem)} chars")
        
        # Step 2: Connect to MQTT broker
        print("\nStep 2: Connecting to MQTT broker...")
        if device.connect_mqtt(mqtt_hostname):
            print("✅ MQTT connection established!")
            
            # Step 3: Publish device information
            print("\nStep 3: Publishing device information...")
            if device.publish_device_info():
                print("✅ Device info published")
            
            # Step 4: Send sample telemetry
            print("\nStep 4: Sending sample telemetry...")
            sample_data = {
                "temperature": 23.5,
                "humidity": 65.0,
                "status": "online"
            }
            if device.publish_telemetry(sample_data):
                print("✅ Sample telemetry sent")
            
            # Step 5: Check service status
            print("\nStep 5: Checking device status on service...")
            status = device.get_device_status()
            if status:
                print(f"✅ Device status: {status.get('status', 'unknown')}")
            
            # Step 6: Check app deployment status
            app_status = device.get_app_deployment_status()
            if app_status:
                print(f"✅ App deployment status retrieved")
            
            print("\n✅ Device enrollment and testing completed successfully!")
            print("\nThe device is now:")
            print("  - Registered with the certificate service")
            print("  - Connected to the MQTT broker") 
            print("  - Ready to send/receive data")
            
            # Cleanup
            device.disconnect()
            return True
            
        else:
            print("❌ Failed to connect to MQTT broker")
            return False
            
    except Exception as e:
        print(f"❌ Enrollment failed: {e}")
        return False


def usage_example():
    """Show usage examples"""
    print("\n📖 Usage Examples:")
    print("\n1. Basic enrollment:")
    print("   python enhanced_device_client_with_app_deployment.py my-device-001")
    
    print("\n2. Custom certificate service URL:")
    print("   python enhanced_device_client_with_app_deployment.py my-device-001 \\")
    print("     --cert-service-url https://my-cert-service.azurewebsites.net")
    
    print("\n3. Custom certificate directory:")
    print("   python enhanced_device_client_with_app_deployment.py my-device-001 \\")
    print("     --cert-dir /opt/device/certs")
    
    print("\n4. Disable automatic telemetry:")
    print("   python enhanced_device_client_with_app_deployment.py my-device-001 \\")
    print("     --no-telemetry")
    
    print("\n5. Custom telemetry interval:")
    print("   python enhanced_device_client_with_app_deployment.py my-device-001 \\")
    print("     --telemetry-interval 60")
    
    print("\n6. Environment variables:")
    print("   export CERT_SERVICE_URL=https://my-service.azurewebsites.net")
    print("   export MQTT_HOSTNAME=my-eventgrid.westus2-1.ts.eventgrid.azure.net")
    print("   python enhanced_device_client_with_app_deployment.py my-device-001")


if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] in ['-h', '--help', 'help']:
        usage_example()
    else:
        success = enroll_device_example()
        if not success:
            sys.exit(1)
