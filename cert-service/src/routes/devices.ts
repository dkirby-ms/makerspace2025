import { Router, Request, Response } from 'express';
import { CertificateManager } from '../certificateManager';
import { EventGridClientManager } from '../eventGridClient';
import { AppDeploymentManager } from '../appDeploymentManager';
import { CONFIG } from '../config';
import { asyncHandler } from '../middleware';
import { validateDeviceId, formatErrorResponse } from '../utils';

const router = Router();

// Initialize managers (these should come from a service container in production)
const certificateManager = new CertificateManager(CONFIG.certificates.caSubject);
const eventGridManager = new EventGridClientManager(
  CONFIG.eventGrid.subscriptionId,
  CONFIG.eventGrid.resourceGroup,
  CONFIG.eventGrid.namespaceName
);
const appDeploymentManager = new AppDeploymentManager(CONFIG.appDeployment.tempDir);

// Store for CA certificate (in production, use Azure Key Vault)
let caCertificateData: any = null;

// Initialize CA certificate
async function initializeCa(): Promise<void> {
  try {
    console.log('Generating CA certificate...');
    caCertificateData = certificateManager.generateCaCertificate();
    console.log('CA certificate generated successfully');
  } catch (error) {
    console.error('Failed to initialize CA certificate:', error);
    throw error;
  }
}

// Initialize CA on startup
initializeCa().catch(console.error);

// Get CA certificate
router.get('/ca-certificate', (req, res) => {
  if (!caCertificateData) {
    return res.status(500).json({ error: 'CA certificate not initialized' });
  }

  res.setHeader('Content-Type', 'application/x-pem-file');
  res.setHeader('Content-Disposition', 'attachment; filename="ca-certificate.pem"');
  res.send(caCertificateData.certificate);
});

// Register new device
router.post('/register-device', asyncHandler(async (req: Request, res: Response) => {
  const { deviceId } = req.body;

  const validation = validateDeviceId(deviceId);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  if (!caCertificateData) {
    return res.status(500).json({ error: 'CA certificate not initialized' });
  }

  try {
    // Register device in Event Grid
    const deviceRegistration = await eventGridManager.registerDevice(deviceId);
    
    // Generate device certificate
    const deviceCertificate = certificateManager.generateDeviceCertificate(deviceId);
    
    res.json({
      success: true,
      deviceId,
      registration: deviceRegistration,
      certificate: deviceCertificate
    });
  } catch (error: any) {
    console.error('Device registration failed:', error);
    res.status(500).json(formatErrorResponse(error, 'Failed to register device'));
  }
}));

// Get device status
router.get('/device/:deviceId/status', asyncHandler(async (req: Request, res: Response) => {
  const { deviceId } = req.params;

  const validation = validateDeviceId(deviceId);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  try {
    const devices = await eventGridManager.listRegisteredDevices();
    const device = devices.find(d => d.includes(deviceId));
    
    res.json({
      deviceId,
      registered: !!device,
      status: device ? 'active' : 'not_found'
    });
  } catch (error: any) {
    console.error('Failed to get device status:', error);
    res.status(500).json(formatErrorResponse(error, 'Failed to get device status'));
  }
}));

// List all devices
router.get('/devices', asyncHandler(async (req: Request, res: Response) => {
  try {
    const devices = await eventGridManager.listRegisteredDevices();
    res.json({ devices });
  } catch (error: any) {
    console.error('Failed to list devices:', error);
    res.status(500).json(formatErrorResponse(error, 'Failed to list devices'));
  }
}));

// Delete device
router.delete('/device/:deviceId', asyncHandler(async (req: Request, res: Response) => {
  const { deviceId } = req.params;

  const validation = validateDeviceId(deviceId);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  try {
    await eventGridManager.unregisterDevice(deviceId);
    res.json({ success: true, message: `Device ${deviceId} deleted successfully` });
  } catch (error: any) {
    console.error('Device deletion failed:', error);
    res.status(500).json(formatErrorResponse(error, 'Failed to delete device'));
  }
}));

// Deploy app to device
router.post('/device/:deviceId/deploy-app', asyncHandler(async (req: Request, res: Response) => {
  const { deviceId } = req.params;

  if (!CONFIG.appDeployment.enabled) {
    return res.status(400).json({ 
      error: 'App deployment is disabled. Set ENABLE_APP_DEPLOYMENT=true to enable.' 
    });
  }

  const validation = validateDeviceId(deviceId);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  try {
    // This would need actual device connection info in production
    const deviceInfo = {
      deviceId,
      mqttHostname: `${CONFIG.eventGrid.namespaceName}.westus2-1.ts.eventgrid.azure.net`,
      certificatePath: '/tmp/device-cert.pem',
      privateKeyPath: '/tmp/device-key.pem',
      caCertPath: '/tmp/ca-cert.pem'
    };

    const result = await appDeploymentManager.deployAppToDevice(deviceInfo);
    res.json(result);
  } catch (error: any) {
    console.error('App deployment failed:', error);
    res.status(500).json(formatErrorResponse(error, 'Failed to deploy app'));
  }
}));

// Get app deployment status
router.get('/device/:deviceId/app-status', asyncHandler(async (req: Request, res: Response) => {
  const { deviceId } = req.params;

  const validation = validateDeviceId(deviceId);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  try {
    // For now, return a placeholder status
    // In production, this would query the actual deployment status
    const status = {
      deviceId,
      appDeployed: false,
      status: 'not_implemented',
      message: 'App status checking not yet implemented'
    };
    res.json(status);
  } catch (error: any) {
    console.error('Failed to get app status:', error);
    res.status(500).json(formatErrorResponse(error, 'Failed to get app status'));
  }
}));

export { router as deviceRoutes };
