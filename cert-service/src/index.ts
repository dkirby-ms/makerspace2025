import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { CertificateManager, CertificateData } from './certificateManager';
import { EventGridClientManager, DeviceRegistration } from './eventGridClient';

const app = express();
const PORT = process.env.PORT || 3000;

// Environment variables
const EVENTGRID_NAMESPACE_NAME = process.env.EVENTGRID_NAMESPACE_NAME || '';
const EVENTGRID_RESOURCE_GROUP = process.env.EVENTGRID_RESOURCE_GROUP || '';
const AZURE_SUBSCRIPTION_ID = process.env.AZURE_SUBSCRIPTION_ID || '';
const CA_CERT_SUBJECT = process.env.CA_CERT_SUBJECT || '/C=US/ST=CA/L=SanFrancisco/O=Makerspace/OU=IT/CN=Makerspace CA';
const CERT_VALIDITY_DAYS = parseInt(process.env.CERT_VALIDITY_DAYS || '365');

// Initialize managers
const certificateManager = new CertificateManager(CA_CERT_SUBJECT);
const eventGridManager = new EventGridClientManager(
  AZURE_SUBSCRIPTION_ID,
  EVENTGRID_RESOURCE_GROUP,
  EVENTGRID_NAMESPACE_NAME
);

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// Store for CA certificate (in production, use Azure Key Vault or persistent storage)
let caCertificateData: any = null;

// Initialize CA certificate on startup
async function initializeCa(): Promise<void> {
  try {
    // In production, load from secure storage
    // For now, generate a new CA certificate
    console.log('Generating CA certificate...');
    caCertificateData = certificateManager.generateCaCertificate();
    console.log('CA certificate generated successfully');
  } catch (error) {
    console.error('Failed to initialize CA certificate:', error);
    process.exit(1);
  }
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'makerspace-cert-service'
  });
});

// Get CA certificate (public endpoint)
app.get('/ca-certificate', (req, res) => {
  if (!caCertificateData) {
    return res.status(500).json({ error: 'CA certificate not initialized' });
  }

  res.set({
    'Content-Type': 'application/x-pem-file',
    'Content-Disposition': 'attachment; filename="ca-certificate.pem"'
  });
  res.send(caCertificateData.certificate);
});

// Register device and issue certificate
app.post('/register-device', async (req, res) => {
  try {
    const { deviceId } = req.body;

    if (!deviceId) {
      return res.status(400).json({ error: 'deviceId is required' });
    }

    // Validate device ID format
    if (!/^[a-zA-Z0-9-_]+$/.test(deviceId)) {
      return res.status(400).json({ 
        error: 'deviceId must contain only alphanumeric characters, hyphens, and underscores' 
      });
    }

    // Check if device is already registered
    const isRegistered = await eventGridManager.isDeviceRegistered(deviceId);
    if (isRegistered) {
      return res.status(409).json({ 
        error: 'Device already registered',
        deviceId 
      });
    }

    // Generate device certificate
    const deviceCert: CertificateData = certificateManager.generateDeviceCertificate(
      deviceId, 
      CERT_VALIDITY_DAYS
    );

    // Register device in Event Grid
    const registration: DeviceRegistration = await eventGridManager.registerDevice(deviceId);

    // Return certificate and registration details
    res.json({
      success: true,
      deviceId,
      authenticationName: registration.authenticationName,
      clientName: registration.clientName,
      certificate: deviceCert.certificate,
      privateKey: deviceCert.privateKey,
      validityDays: CERT_VALIDITY_DAYS,
      mqttHostname: `${EVENTGRID_NAMESPACE_NAME}.{region}-1.eventgrid.azure.net`,
      instructions: {
        message: 'Use the provided certificate and private key for MQTT authentication',
        port: 8883,
        protocol: 'mqtts'
      }
    });

  } catch (error) {
    console.error('Error registering device:', error);
    res.status(500).json({ 
      error: 'Failed to register device',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get device registration status
app.get('/device/:deviceId/status', async (req, res) => {
  try {
    const { deviceId } = req.params;

    const registration = await eventGridManager.getDeviceRegistration(deviceId);
    
    if (!registration) {
      return res.status(404).json({ 
        error: 'Device not found',
        deviceId 
      });
    }

    res.json({
      deviceId,
      registered: true,
      authenticationName: registration.authenticationName,
      clientName: registration.clientName
    });

  } catch (error) {
    console.error('Error checking device status:', error);
    res.status(500).json({ 
      error: 'Failed to check device status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// List all registered devices
app.get('/devices', async (req, res) => {
  try {
    const devices = await eventGridManager.listRegisteredDevices();
    
    res.json({
      devices,
      count: devices.length
    });

  } catch (error) {
    console.error('Error listing devices:', error);
    res.status(500).json({ 
      error: 'Failed to list devices',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Unregister device
app.delete('/device/:deviceId', async (req, res) => {
  try {
    const { deviceId } = req.params;

    const registration = await eventGridManager.getDeviceRegistration(deviceId);
    
    if (!registration) {
      return res.status(404).json({ 
        error: 'Device not found',
        deviceId 
      });
    }

    await eventGridManager.unregisterDevice(deviceId);

    res.json({
      success: true,
      message: `Device ${deviceId} unregistered successfully`
    });

  } catch (error) {
    console.error('Error unregistering device:', error);
    res.status(500).json({ 
      error: 'Failed to unregister device',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ 
    error: 'Internal server error',
    details: err.message 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    error: 'Endpoint not found',
    path: req.path 
  });
});

// Start server
async function startServer(): Promise<void> {
  try {
    await initializeCa();
    
    app.listen(PORT, () => {
      console.log(`Certificate service running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Event Grid Namespace: ${EVENTGRID_NAMESPACE_NAME}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});

startServer();
