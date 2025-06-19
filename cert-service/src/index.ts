import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import { CertificateManager, CertificateData } from './certificateManager';
import { EventGridClientManager, DeviceRegistration, TopicSpaceInfo, PermissionBindingInfo } from './eventGridClient';
import { MqttTopicMonitor, MqttMessage } from './mqttMonitor';
import { AppDeploymentManager, DeviceConnectionInfo, DeploymentResult } from './appDeploymentManager';
import * as http from 'http';
import { WebSocketServer } from 'ws';

const app = express();
const PORT = process.env.PORT || 3000;

// Environment variables
const EVENTGRID_NAMESPACE_NAME = process.env.EVENTGRID_NAMESPACE_NAME || '';
const EVENTGRID_RESOURCE_GROUP = process.env.EVENTGRID_RESOURCE_GROUP || '';
const AZURE_SUBSCRIPTION_ID = process.env.AZURE_SUBSCRIPTION_ID || '';
const CA_CERT_SUBJECT = process.env.CA_CERT_SUBJECT || '/C=US/ST=CA/L=SanFrancisco/O=Makerspace/OU=IT/CN=Makerspace CA';
const CERT_VALIDITY_DAYS = parseInt(process.env.CERT_VALIDITY_DAYS || '365');
const ENABLE_APP_DEPLOYMENT = process.env.ENABLE_APP_DEPLOYMENT === 'true';
const APP_DEPLOYMENT_TEMP_DIR = process.env.APP_DEPLOYMENT_TEMP_DIR || '/tmp/makerspace-deployments';
const BITNET_RUNNER_REPO = process.env.BITNET_RUNNER_REPO || 'https://github.com/bitnet_runner.git';

// Initialize managers
const certificateManager = new CertificateManager(CA_CERT_SUBJECT);
const eventGridManager = new EventGridClientManager(
  AZURE_SUBSCRIPTION_ID,
  EVENTGRID_RESOURCE_GROUP,
  EVENTGRID_NAMESPACE_NAME
);
const appDeploymentManager = new AppDeploymentManager(APP_DEPLOYMENT_TEMP_DIR);

// Initialize MQTT monitor (will be started when needed)
let mqttMonitor: MqttTopicMonitor | null = null;

// Middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
}));
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
        .btn-danger {
            background-color: #e74c3c;
            color: white;
        }
        .btn-danger:hover {
            background-color: #c0392b;
        }
        .api-info {
            background: #e8f4fd;
            border-left: 4px solid #2196F3;
            padding: 15px;
            margin-top: 30px;
            border-radius: 0 8px 8px 0;
        }
        .app-deployment-info {
            background: #f0f8f0;
            border-left: 4px solid #4CAF50;
            padding: 12px;
            margin-top: 15px;
            border-radius: 0 6px 6px 0;
        }
        .app-deployment-info h4 {
            margin-top: 0;
            color: #2E7D32;
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
                <a href="/topics" class="btn btn-secondary">📡 MQTT Topics</a>
                <a href="/ca-certificate" class="btn btn-secondary">📥 Download CA Certificate</a>
                <button id="refresh-btn" class="btn btn-primary">🔄 Refresh</button>
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
                            <button class="btn btn-danger unregister-btn" data-device-id="${deviceId}">🗑️ Unregister</button>
                        </div>
                    </div>
                `).join('')}
            </div>`
        }

        <div class="api-info">
            <h3>📚 API Endpoints</h3>
            <ul>
                <li><strong>POST /register-device</strong> - Register a new device and get certificates${ENABLE_APP_DEPLOYMENT ? ' (includes bitnet_runner app deployment)' : ''}</li>
                <li><strong>GET /devices</strong> - List all registered devices (JSON)</li>
                <li><strong>GET /topics</strong> - View MQTT topic spaces and permissions</li>
                <li><strong>GET /device/:deviceId/status</strong> - Get device status</li>
                <li><strong>DELETE /device/:deviceId</strong> - Unregister a device</li>
                ${ENABLE_APP_DEPLOYMENT ? `
                <li><strong>POST /device/:deviceId/deploy-app</strong> - Deploy app to specific device</li>
                <li><strong>GET /device/:deviceId/app-status</strong> - Get app deployment status</li>
                ` : ''}
                <li><strong>GET /ca-certificate</strong> - Download CA certificate</li>
                <li><strong>GET /health</strong> - Service health check</li>
            </ul>
            <p><strong>MQTT Hostname:</strong> ${EVENTGRID_NAMESPACE_NAME}.westus2-1.ts.eventgrid.azure.net:8883</p>
            ${ENABLE_APP_DEPLOYMENT ? `
            <div class="app-deployment-info">
                <h4>🚀 App Deployment</h4>
                <p><strong>Status:</strong> Enabled</p>
                <p><strong>Repository:</strong> ${BITNET_RUNNER_REPO}</p>
                <p><strong>Description:</strong> Automatically deploys bitnet_runner app with device-specific MQTT configuration</p>
            </div>
            ` : `
            <div class="app-deployment-info">
                <h4>🚀 App Deployment</h4>
                <p><strong>Status:</strong> Disabled</p>
                <p>Set ENABLE_APP_DEPLOYMENT=true to enable automatic app deployment during device registration</p>
            </div>
            `}
        </div>
    </div>

    <div class="timestamp">
        Last updated: ${new Date().toLocaleString()}
    </div>

    <script>
        document.addEventListener('DOMContentLoaded', function() {
            // Refresh button event listener
            const refreshBtn = document.getElementById('refresh-btn');
            if (refreshBtn) {
                refreshBtn.addEventListener('click', function() {
                    window.location.reload();
                });
            }
            
            // Unregister button event listeners
            const unregisterBtns = document.querySelectorAll('.unregister-btn');
            unregisterBtns.forEach(btn => {
                btn.addEventListener('click', async function() {
                    const deviceId = this.getAttribute('data-device-id');
                    await unregisterDevice(deviceId);
                });
            });
        });
        
        async function unregisterDevice(deviceId) {
            if (!confirm('Are you sure you want to unregister device "' + deviceId + '"? This action cannot be undone.')) {
                return;
            }
            
            try {
                const response = await fetch('/device/' + deviceId, {
                    method: 'DELETE',
                    headers: {
                        'Content-Type': 'application/json'
                    }
                });
                
                if (response.ok) {
                    alert('Device "' + deviceId + '" has been successfully unregistered.');
                    window.location.reload();
                } else {
                    const errorData = await response.json();
                    alert('Failed to unregister device: ' + (errorData.error || 'Unknown error'));
                }
            } catch (error) {
                alert('Error unregistering device: ' + error.message);
            }
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

    // Prepare response data
    const mqttHostname = `${EVENTGRID_NAMESPACE_NAME}.{region}-1.eventgrid.azure.net`;
    let appDeployment: DeploymentResult | null = null;

    // Deploy bitnet_runner app if enabled
    if (ENABLE_APP_DEPLOYMENT) {
      try {
        console.log(`Deploying bitnet_runner app for device ${deviceId}`);
        
        const deviceConnectionInfo: DeviceConnectionInfo = {
          deviceId,
          mqttHostname,
          certificatePath: './certs/device.crt',
          privateKeyPath: './certs/device.key',
          caCertPath: './certs/ca.crt'
        };

        appDeployment = await appDeploymentManager.deployAppToDevice(
          deviceConnectionInfo,
          {
            gitRepository: BITNET_RUNNER_REPO,
            targetPath: `/opt/makerspace/apps/bitnet_runner`,
            postInstallCommands: ['npm install', 'npm run build'],
            requiredFiles: ['package.json']
          }
        );

        console.log(`App deployment result for ${deviceId}:`, appDeployment.success ? 'SUCCESS' : 'FAILED');
      } catch (deployError) {
        console.error(`App deployment failed for device ${deviceId}:`, deployError);
        appDeployment = {
          success: false,
          message: deployError instanceof Error ? deployError.message : 'Unknown deployment error',
          deploymentId: 'failed'
        };
      }
    }

    // Return certificate and registration details
    res.json({
      success: true,
      deviceId,
      authenticationName: registration.authenticationName,
      clientName: registration.clientName,
      certificate: deviceCert.certificate,
      privateKey: deviceCert.privateKey,
      caCertificate: caCertificateData.certificate,
      validityDays: CERT_VALIDITY_DAYS,
      mqttHostname,
      instructions: {
        message: 'Use the provided certificate and private key for MQTT authentication',
        port: 8883,
        protocol: 'mqtts'
      },
      appDeployment: appDeployment ? {
        enabled: ENABLE_APP_DEPLOYMENT,
        status: appDeployment.success ? 'deployed' : 'failed',
        deploymentId: appDeployment.deploymentId,
        message: appDeployment.message,
        appPath: appDeployment.appPath,
        configFiles: appDeployment.configFiles
      } : {
        enabled: false,
        status: 'disabled',
        message: 'App deployment is disabled'
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

// MQTT Topics page - display topic spaces and permissions
app.get('/topics', async (req, res) => {
  try {
    const [topicSpaces, permissionBindings] = await Promise.all([
      eventGridManager.getTopicSpaces(),
      eventGridManager.getPermissionBindings()
    ]);
    
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MQTT Topics - Makerspace Certificate Service</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            margin: 0;
            padding: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            color: #333;
        }
        .container {
            max-width: 1200px;
            margin: 0 auto;
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            overflow: hidden;
        }
        .header {
            background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
            color: white;
            padding: 30px;
            text-align: center;
        }
        .header h1 {
            margin: 0;
            font-size: 2.5em;
            font-weight: 700;
        }
        .header p {
            margin: 10px 0 0 0;
            opacity: 0.9;
            font-size: 1.1em;
        }
        .content {
            padding: 30px;
        }
        .section {
            margin-bottom: 40px;
        }
        .section h2 {
            color: #4facfe;
            border-bottom: 2px solid #e1f5fe;
            padding-bottom: 10px;
            margin-bottom: 20px;
            font-size: 1.8em;
        }
        .topic-spaces, .permission-bindings {
            display: grid;
            gap: 20px;
            grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
        }
        .card {
            background: #f8fffe;
            border: 1px solid #e1f5fe;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
            transition: transform 0.2s, box-shadow 0.2s;
        }
        .card:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 16px rgba(0,0,0,0.1);
        }
        .card-title {
            font-size: 1.3em;
            font-weight: 600;
            color: #2196f3;
            margin-bottom: 10px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .card-description {
            color: #666;
            margin-bottom: 15px;
            font-style: italic;
        }
        .topic-templates {
            background: #e3f2fd;
            border-radius: 8px;
            padding: 12px;
            margin-top: 10px;
        }
        .topic-template {
            background: white;
            border: 1px solid #bbdefb;
            border-radius: 6px;
            padding: 8px 12px;
            margin: 5px 0;
            font-family: 'Courier New', monospace;
            color: #1976d2;
            font-weight: 500;
        }
        .permission-info {
            display: flex;
            gap: 15px;
            flex-wrap: wrap;
            margin-top: 10px;
        }
        .permission-badge {
            background: #4caf50;
            color: white;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.9em;
            font-weight: 500;
        }
        .permission-badge.publisher {
            background: #ff9800;
        }
        .permission-badge.subscriber {
            background: #2196f3;
        }
        .client-group {
            background: #e8f5e8;
            color: #2e7d32;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 0.9em;
        }
        .navigation {
            background: #f5f5f5;
            padding: 15px 30px;
            border-bottom: 1px solid #e0e0e0;
            display: flex;
            gap: 20px;
            align-items: center;
        }
        .nav-link {
            color: #4facfe;
            text-decoration: none;
            font-weight: 500;
            padding: 8px 16px;
            border-radius: 6px;
            transition: background-color 0.2s;
        }
        .nav-link:hover {
            background-color: #e1f5fe;
        }
        .no-data {
            text-align: center;
            padding: 40px;
            color: #666;
            font-style: italic;
        }
        .messages-section {
            margin-top: 40px;
            background: #f8f9fa;
            border-radius: 12px;
            padding: 20px;
        }
        .message-monitor {
            display: flex;
            gap: 10px;
            margin-bottom: 20px;
            align-items: center;
        }
        .topic-input {
            flex: 1;
            padding: 10px;
            border: 1px solid #ddd;
            border-radius: 6px;
            font-family: monospace;
        }
        .monitor-btn {
            background: #4facfe;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 500;
        }
        .monitor-btn:hover {
            background: #2196f3;
        }
        .monitor-btn:disabled {
            background: #ccc;
            cursor: not-allowed;
        }
        .messages-list {
            max-height: 400px;
            overflow-y: auto;
            border: 1px solid #ddd;
            border-radius: 6px;
            background: white;
        }
        .message-item {
            padding: 10px;
            border-bottom: 1px solid #eee;
            font-family: monospace;
            font-size: 0.9em;
        }
        .message-item:last-child {
            border-bottom: none;
        }
        .message-topic {
            color: #4facfe;
            font-weight: bold;
            margin-bottom: 5px;
        }
        .message-timestamp {
            color: #666;
            font-size: 0.8em;
            float: right;
        }
        .message-payload {
            background: #f5f5f5;
            padding: 8px;
            border-radius: 4px;
            margin-top: 5px;
            white-space: pre-wrap;
            word-break: break-all;
        }
        .connection-status {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8em;
            margin-left: 10px;
        }
        .status-connected {
            background: #4caf50;
            color: white;
        }
        .status-disconnected {
            background: #f44336;
            color: white;
        }
        .timestamp {
            text-align: center;
            color: #666;
            font-size: 0.9em;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e0e0e0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="navigation">
            <a href="/" class="nav-link">🏠 Home</a>
            <a href="/topics" class="nav-link">📡 MQTT Topics</a>
            <a href="/ca-certificate" class="nav-link">📥 CA Certificate</a>
        </div>
        
        <div class="header">
            <h1>📡 MQTT Topics & Permissions</h1>
            <p>Event Grid Namespace: ${EVENTGRID_NAMESPACE_NAME}</p>
        </div>

        <div class="content">
            <div class="section">
                <h2>🏷️ Topic Spaces</h2>
                ${topicSpaces.length === 0 ? 
                    '<div class="no-data">No topic spaces configured.</div>' :
                    `<div class="topic-spaces">
                        ${topicSpaces.map(space => `
                            <div class="card">
                                <div class="card-title">📂 ${space.name}</div>
                                ${space.description ? `<div class="card-description">${space.description}</div>` : ''}
                                <div class="topic-templates">
                                    <strong>Topic Templates:</strong>
                                    ${space.topicTemplates.map(template => 
                                        `<div class="topic-template">${template}</div>`
                                    ).join('')}
                                </div>
                            </div>
                        `).join('')}
                    </div>`
                }
            </div>

            <div class="section">
                <h2>🔐 Permission Bindings</h2>
                ${permissionBindings.length === 0 ? 
                    '<div class="no-data">No permission bindings configured.</div>' :
                    `<div class="permission-bindings">
                        ${permissionBindings.map(binding => `
                            <div class="card">
                                <div class="card-title">🔑 ${binding.name}</div>
                                ${binding.description ? `<div class="card-description">${binding.description}</div>` : ''}
                                <div class="permission-info">
                                    <span class="permission-badge ${binding.permission.toLowerCase()}">${binding.permission}</span>
                                    ${binding.clientGroupName ? `<span class="client-group">👥 ${binding.clientGroupName}</span>` : ''}
                                </div>
                                <div style="margin-top: 10px;">
                                    <strong>Topic Space:</strong> <span style="font-family: monospace; color: #1976d2;">${binding.topicSpaceName}</span>
                                </div>
                            </div>
                        `).join('')}
                    </div>`
                }
            </div>

            <div class="section messages-section">
                <h2>📨 Live Messages <span id="connection-status" class="connection-status status-disconnected">Disconnected</span></h2>
                <div class="message-monitor">
                    <input type="text" id="topic-input" class="topic-input" placeholder="Enter topic to monitor (e.g., devices/+/telemetry)" />
                    <button id="subscribe-btn" class="monitor-btn" onclick="subscribeToTopic()">Subscribe</button>
                    <button id="unsubscribe-btn" class="monitor-btn" onclick="unsubscribeFromTopic()" disabled>Unsubscribe</button>
                    <button onclick="clearMessages()" class="monitor-btn" style="background: #ff9800;">Clear</button>
                </div>
                <div id="messages-list" class="messages-list">
                    <div style="padding: 20px; text-align: center; color: #666;">
                        Enter a topic above and click Subscribe to monitor messages
                    </div>
                </div>
            </div>
        </div>

        <div class="timestamp">
            Last updated: ${new Date().toLocaleString()}
        </div>
    </div>

    <script>
        let currentTopic = '';
        let ws = null;

        // Initialize WebSocket connection
        function initWebSocket() {
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = \`\${protocol}//\${window.location.host}\`;
            
            ws = new WebSocket(wsUrl);
            
            ws.onopen = function() {
                console.log('WebSocket connected');
                updateConnectionStatus(true);
            };
            
            ws.onmessage = function(event) {
                const message = JSON.parse(event.data);
                displayMessage(message);
            };
            
            ws.onclose = function() {
                console.log('WebSocket disconnected');
                updateConnectionStatus(false);
                // Attempt to reconnect after 5 seconds
                setTimeout(initWebSocket, 5000);
            };
            
            ws.onerror = function(error) {
                console.error('WebSocket error:', error);
                updateConnectionStatus(false);
            };
        }

        function updateConnectionStatus(connected) {
            const statusEl = document.getElementById('connection-status');
            if (connected) {
                statusEl.textContent = 'Connected';
                statusEl.className = 'connection-status status-connected';
            } else {
                statusEl.textContent = 'Disconnected';
                statusEl.className = 'connection-status status-disconnected';
            }
        }

        async function subscribeToTopic() {
            const topicInput = document.getElementById('topic-input');
            const topic = topicInput.value.trim();
            
            if (!topic) {
                alert('Please enter a topic to subscribe to');
                return;
            }

            try {
                const response = await fetch(\`/api/topic/\${encodeURIComponent(topic)}/subscribe\`, {
                    method: 'POST'
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    currentTopic = topic;
                    document.getElementById('subscribe-btn').disabled = true;
                    document.getElementById('unsubscribe-btn').disabled = false;
                    document.getElementById('topic-input').disabled = true;
                    
                    // Clear previous messages
                    clearMessages();
                    
                    // Load existing messages
                    loadTopicMessages(topic);
                } else {
                    alert('Failed to subscribe: ' + result.error);
                }
            } catch (error) {
                alert('Error subscribing to topic: ' + error.message);
            }
        }

        async function unsubscribeFromTopic() {
            if (!currentTopic) return;

            try {
                const response = await fetch(\`/api/topic/\${encodeURIComponent(currentTopic)}/subscribe\`, {
                    method: 'DELETE'
                });
                
                const result = await response.json();
                
                if (response.ok) {
                    currentTopic = '';
                    document.getElementById('subscribe-btn').disabled = false;
                    document.getElementById('unsubscribe-btn').disabled = true;
                    document.getElementById('topic-input').disabled = false;
                } else {
                    alert('Failed to unsubscribe: ' + result.error);
                }
            } catch (error) {
                alert('Error unsubscribing from topic: ' + error.message);
            }
        }

        async function loadTopicMessages(topic) {
            try {
                const response = await fetch(\`/api/topic/\${encodeURIComponent(topic)}/messages\`);
                const result = await response.json();
                
                if (response.ok && result.messages) {
                    result.messages.forEach(message => displayMessage(message));
                }
            } catch (error) {
                console.error('Error loading topic messages:', error);
            }
        }

        function displayMessage(message) {
            const messagesList = document.getElementById('messages-list');
            
            // Remove the placeholder text if it exists
            if (messagesList.children.length === 1 && messagesList.children[0].style.padding) {
                messagesList.innerHTML = '';
            }
            
            const messageEl = document.createElement('div');
            messageEl.className = 'message-item';
            
            const timestamp = new Date(message.timestamp).toLocaleString();
            
            messageEl.innerHTML = \`
                <div class="message-topic">\${message.topic} <span class="message-timestamp">\${timestamp}</span></div>
                <div class="message-payload">\${message.payload}</div>
            \`;
            
            // Add to the top of the list
            messagesList.insertBefore(messageEl, messagesList.firstChild);
            
            // Keep only the latest 50 messages
            while (messagesList.children.length > 50) {
                messagesList.removeChild(messagesList.lastChild);
            }
        }

        function clearMessages() {
            const messagesList = document.getElementById('messages-list');
            messagesList.innerHTML = '<div style="padding: 20px; text-align: center; color: #666;">No messages yet</div>';
        }

        // Initialize WebSocket on page load
        initWebSocket();

        // Auto-refresh page every 5 minutes (but keep WebSocket for real-time messages)
        setTimeout(() => {
            window.location.reload();
        }, 300000);
    </script>
</body>
</html>`;

    res.send(html);
  } catch (error) {
    console.error('Error fetching topics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch MQTT topics',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// API route to get messages for a specific topic
app.get('/api/topic/:topicName/messages', async (req, res) => {
  try {
    const topicName = decodeURIComponent(req.params.topicName);
    
    if (!isMqttMonitorAvailable()) {
      return res.status(503).json({ 
        error: 'MQTT monitor not connected',
        messages: []
      });
    }

    const monitor = getMqttMonitor()!; // We know it's not null from the check above
    const messages = monitor.getMessagesForTopic(topicName);
    res.json({ topic: topicName, messages, count: messages.length });
  } catch (error) {
    console.error('Error fetching topic messages:', error);
    res.status(500).json({ 
      error: 'Failed to fetch messages',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// API route to subscribe to a topic for monitoring
app.post('/api/topic/:topicName/subscribe', async (req, res) => {
  try {
    const topicName = decodeURIComponent(req.params.topicName);
    
    // Initialize MQTT monitor if not already done
    if (!getMqttMonitor()) {
      // We need certificates to connect - for now return an error
      return res.status(400).json({ 
        error: 'MQTT monitoring requires client certificates to be configured'
      });
    }

    if (!isMqttMonitorAvailable()) {
      return res.status(503).json({ 
        error: 'MQTT monitor not connected'
      });
    }

    const monitor = getMqttMonitor()!;
    await monitor.subscribeToTopic(topicName);
    res.json({ 
      success: true, 
      message: `Subscribed to topic: ${topicName}`
    });
  } catch (error) {
    console.error('Error subscribing to topic:', error);
    res.status(500).json({ 
      error: 'Failed to subscribe to topic',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// API route to unsubscribe from a topic
app.delete('/api/topic/:topicName/subscribe', async (req, res) => {
  try {
    const topicName = decodeURIComponent(req.params.topicName);
    
    if (!isMqttMonitorAvailable()) {
      return res.status(503).json({ 
        error: 'MQTT monitor not connected'
      });
    }

    const monitor = getMqttMonitor()!;
    await monitor.unsubscribeFromTopic(topicName);
    res.json({ 
      success: true, 
      message: `Unsubscribed from topic: ${topicName}`
    });
  } catch (error) {
    console.error('Error unsubscribing from topic:', error);
    res.status(500).json({ 
      error: 'Failed to unsubscribe from topic',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Deploy app to device endpoint
app.post('/device/:deviceId/deploy-app', async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { gitRepository, targetPath, postInstallCommands, requiredFiles } = req.body;

    // Check if device is registered
    const registration = await eventGridManager.getDeviceRegistration(deviceId);
    if (!registration) {
      return res.status(404).json({ 
        error: 'Device not found',
        deviceId 
      });
    }

    const mqttHostname = `${EVENTGRID_NAMESPACE_NAME}.{region}-1.eventgrid.azure.net`;
    const deviceConnectionInfo: DeviceConnectionInfo = {
      deviceId,
      mqttHostname,
      certificatePath: './certs/device.crt',
      privateKeyPath: './certs/device.key',
      caCertPath: './certs/ca.crt'
    };

    const appConfig = {
      gitRepository: gitRepository || BITNET_RUNNER_REPO,
      targetPath: targetPath || `/opt/makerspace/apps/bitnet_runner`,
      postInstallCommands: postInstallCommands || ['npm install', 'npm run build'],
      requiredFiles: requiredFiles || ['package.json']
    };

    const deploymentResult = await appDeploymentManager.deployAppToDevice(
      deviceConnectionInfo,
      appConfig
    );

    res.json({
      success: deploymentResult.success,
      deviceId,
      deployment: deploymentResult
    });

  } catch (error) {
    console.error('Error deploying app to device:', error);
    res.status(500).json({ 
      error: 'Failed to deploy app to device',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get app deployment status for device
app.get('/device/:deviceId/app-status', async (req, res) => {
  try {
    const { deviceId } = req.params;

    // Check if device is registered
    const registration = await eventGridManager.getDeviceRegistration(deviceId);
    if (!registration) {
      return res.status(404).json({ 
        error: 'Device not found',
        deviceId 
      });
    }

    res.json({
      deviceId,
      appDeployment: {
        enabled: ENABLE_APP_DEPLOYMENT,
        repository: BITNET_RUNNER_REPO,
        status: 'configured',
        message: ENABLE_APP_DEPLOYMENT ? 
          'App deployment is enabled for this device' : 
          'App deployment is disabled globally'
      }
    });

  } catch (error) {
    console.error('Error getting app status:', error);
    res.status(500).json({ 
      error: 'Failed to get app status',
      details: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Create HTTP server and WebSocket server for real-time updates
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

// WebSocket connections for real-time topic messages
const activeConnections = new Set();

wss.on('connection', (ws) => {
  activeConnections.add(ws);
  console.log('WebSocket client connected');
  
  ws.on('close', () => {
    activeConnections.delete(ws);
    console.log('WebSocket client disconnected');
  });
  
  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    activeConnections.delete(ws);
  });
});

// Function to broadcast messages to all connected WebSocket clients
function broadcastMessage(message: any) {
  const messageStr = JSON.stringify(message);
  activeConnections.forEach((ws: any) => {
    if (ws.readyState === 1) { // WebSocket.OPEN
      ws.send(messageStr);
    }
  });
}

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

// Function to initialize MQTT monitor with device credentials
async function initializeMqttMonitor(deviceId: string): Promise<boolean> {
  try {
    if (mqttMonitor && mqttMonitor.isClientConnected()) {
      return true; // Already connected
    }

    // Get device certificate and key from storage
    // For now, we'll use the first available device's certificates
    const devices = await eventGridManager.listRegisteredDevices();
    if (devices.length === 0) {
      console.log('No devices available for MQTT monitoring');
      return false;
    }

    const monitorDeviceId = deviceId || devices[0];
    const brokerHost = `${EVENTGRID_NAMESPACE_NAME}.westus2-1.ts.eventgrid.azure.net`;
    
    if (!caCertificateData) {
      console.log('CA certificate not available for MQTT monitoring');
      return false;
    }

    // For demonstration, we'll need to generate or retrieve device certificates
    // In a real scenario, you'd retrieve the actual device certificates from storage
    console.log(`Would initialize MQTT monitor for device: ${monitorDeviceId}`);
    console.log(`Broker host: ${brokerHost}`);
    
    // Note: This requires actual device certificates to work
    // mqttMonitor = new MqttTopicMonitor(brokerHost, deviceCert, deviceKey, caCert, `monitor-${monitorDeviceId}`);
    // await mqttMonitor.connect();
    
    // Set up message broadcasting
    // mqttMonitor.on('message', (message: MqttMessage) => {
    //   broadcastMessage(message);
    // });

    return false; // Return false for now since we don't have device certs readily available
  } catch (error) {
    console.error('Failed to initialize MQTT monitor:', error);
    return false;
  }
}

// Start server
async function startServer(): Promise<void> {
  try {
    await initializeCa();
    
    server.listen(PORT, () => {
      console.log(`Certificate service running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`Event Grid Namespace: ${EVENTGRID_NAMESPACE_NAME}`);
    });

    // Initialize MQTT monitor if we have CA certificates
    // Note: For now, MQTT monitoring will require manual setup with device certificates
    console.log('MQTT monitoring available via API endpoints');
    
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

// Type guard for MQTT monitor
function getMqttMonitor(): MqttTopicMonitor | null {
  return mqttMonitor;
}

function isMqttMonitorAvailable(): boolean {
  const monitor = getMqttMonitor();
  return monitor !== null && monitor.isClientConnected();
}

startServer();
