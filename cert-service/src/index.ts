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

// Homepage - display all registered devices
app.get('/', async (req, res) => {
  try {
    const devices = await eventGridManager.listRegisteredDevices();
    
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Makerspace Certificate Service</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            border-radius: 10px;
            margin-bottom: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 2.5em;
        }
        .header p {
            margin: 10px 0 0 0;
            opacity: 0.9;
        }
        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 20px;
            margin-bottom: 30px;
        }
        .stat-card {
            background: white;
            padding: 20px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            text-align: center;
        }
        .stat-number {
            font-size: 2em;
            font-weight: bold;
            color: #667eea;
        }
        .devices-container {
            background: white;
            border-radius: 10px;
            padding: 30px;
            box-shadow: 0 2px 20px rgba(0,0,0,0.1);
        }
        .devices-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
            border-bottom: 2px solid #f0f0f0;
            padding-bottom: 15px;
        }
        .device-list {
            display: grid;
            grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
            gap: 20px;
        }
        .device-card {
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            padding: 20px;
            background: #fafafa;
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .device-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 15px rgba(0,0,0,0.1);
        }
        .device-id {
            font-weight: bold;
            font-size: 1.1em;
            color: #333;
            margin-bottom: 10px;
        }
        .device-details {
            font-size: 0.9em;
            color: #666;
        }
        .no-devices {
            text-align: center;
            padding: 40px;
            color: #666;
        }
        .actions {
            margin-top: 20px;
            display: flex;
            gap: 10px;
        }
        .btn {
            padding: 8px 16px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            text-decoration: none;
            font-size: 0.9em;
            display: inline-block;
        }
        .btn-primary {
            background-color: #667eea;
            color: white;
        }
        .btn-secondary {
            background-color: #f0f0f0;
            color: #333;
        }
        .api-info {
            background: #e8f4fd;
            border-left: 4px solid #2196F3;
            padding: 15px;
            margin-top: 30px;
            border-radius: 0 8px 8px 0;
        }
        .timestamp {
            text-align: center;
            color: #888;
            font-size: 0.9em;
            margin-top: 20px;
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>🔐 Makerspace Certificate Service</h1>
        <p>Device Certificate Management & MQTT Client Registration</p>
    </div>

    <div class="stats">
        <div class="stat-card">
            <div class="stat-number">${devices.length}</div>
            <div>Registered Devices</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">🟢</div>
            <div>Service Status: Healthy</div>
        </div>
        <div class="stat-card">
            <div class="stat-number">MQTT</div>
            <div>Protocol: TLS 1.3</div>
        </div>
    </div>

    <div class="devices-container">
        <div class="devices-header">
            <h2>📱 Registered Devices</h2>
            <div class="actions">
                <a href="/ca-certificate" class="btn btn-secondary">📥 Download CA Certificate</a>
                <button onclick="refreshPage()" class="btn btn-primary">🔄 Refresh</button>
            </div>
        </div>

        ${devices.length === 0 ? 
            '<div class="no-devices">No devices registered yet. Use the API to register your first device.</div>' :
            `<div class="device-list">
                ${devices.map(deviceId => `
                    <div class="device-card">
                        <div class="device-id">🔗 ${deviceId}</div>
                        <div class="device-details">
                            <div><strong>Client:</strong> device-${deviceId}</div>
                            <div><strong>Auth ID:</strong> ${deviceId}-authnID</div>
                            <div><strong>Status:</strong> Active</div>
                        </div>
                        <div class="actions">
                            <a href="/device/${deviceId}/status" class="btn btn-secondary">📊 Status</a>
                        </div>
                    </div>
                `).join('')}
            </div>`
        }

        <div class="api-info">
            <h3>📚 API Endpoints</h3>
            <ul>
                <li><strong>POST /register-device</strong> - Register a new device and get certificates</li>
                <li><strong>GET /devices</strong> - List all registered devices (JSON)</li>
                <li><strong>GET /device/:deviceId/status</strong> - Get device status</li>
                <li><strong>DELETE /device/:deviceId</strong> - Unregister a device</li>
                <li><strong>GET /ca-certificate</strong> - Download CA certificate</li>
                <li><strong>GET /health</strong> - Service health check</li>
            </ul>
            <p><strong>MQTT Hostname:</strong> ${EVENTGRID_NAMESPACE_NAME}.westus2-1.ts.eventgrid.azure.net:8883</p>
        </div>
    </div>

    <div class="timestamp">
        Last updated: ${new Date().toLocaleString()}
    </div>

    <script>
        function refreshPage() {
            window.location.reload();
        }
        
        // Auto-refresh every 30 seconds
        setTimeout(() => {
            window.location.reload();
        }, 30000);
    </script>
</body>
</html>`;

    res.set('Content-Type', 'text/html');
    res.send(html);

  } catch (error) {
    console.error('Error loading homepage:', error);
    res.status(500).send(`
<!DOCTYPE html>
<html>
<head>
    <title>Error - Makerspace Certificate Service</title>
    <style>
        body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
        .error { color: #e74c3c; }
    </style>
</head>
<body>
    <h1 class="error">Service Error</h1>
    <p>Unable to load device information. Please check the service logs.</p>
    <a href="/health">Check Service Health</a>
</body>
</html>`);
  }
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
