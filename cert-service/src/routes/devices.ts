import { Router, Request, Response } from 'express';
import { CertificateManager } from '../certificateManager';
import { EventGridClientManager } from '../eventGridClient';
import { CONFIG } from '../config';
import { asyncHandler } from '../middleware';
import { validateDeviceId, formatErrorResponse } from '../utils';

const router = Router();

// Service container for better dependency management
class ServiceContainer {
  private static instance: ServiceContainer;
  private _certificateManager: CertificateManager | null = null;
  private _eventGridManager: EventGridClientManager | null = null;
  private _caCertificateData: any = null;

  static getInstance(): ServiceContainer {
    if (!ServiceContainer.instance) {
      ServiceContainer.instance = new ServiceContainer();
    }
    return ServiceContainer.instance;
  }

  get certificateManager(): CertificateManager {
    if (!this._certificateManager) {
      this._certificateManager = new CertificateManager(CONFIG.certificates.caSubject);
    }
    return this._certificateManager;
  }

  get eventGridManager(): EventGridClientManager {
    if (!this._eventGridManager) {
      this._eventGridManager = new EventGridClientManager(
        CONFIG.eventGrid.subscriptionId,
        CONFIG.eventGrid.resourceGroup,
        CONFIG.eventGrid.namespaceName
      );
    }
    return this._eventGridManager;
  }

  get caCertificateData(): any {
    return this._caCertificateData;
  }

  set caCertificateData(data: any) {
    this._caCertificateData = data;
  }
}

const services = ServiceContainer.getInstance();

// Initialize CA certificate
async function initializeCa(): Promise<void> {
  try {
    console.log('Generating CA certificate...');
    services.caCertificateData = services.certificateManager.generateCaCertificate();
    console.log('CA certificate generated successfully');
  } catch (error) {
    console.error('Failed to initialize CA certificate:', error);
    throw error;
  }
}

// Initialize CA on startup
initializeCa().catch(console.error);

// Get CA certificate
router.get('/ca-certificate', (req: Request, res: Response) => {
  if (!services.caCertificateData) {
    return res.status(500).json({ error: 'CA certificate not initialized' });
  }

  res.setHeader('Content-Type', 'application/x-pem-file');
  res.setHeader('Content-Disposition', 'attachment; filename="ca-certificate.pem"');
  res.send(services.caCertificateData.certificate);
});

// Register new device
router.post('/register-device', asyncHandler(async (req: Request, res: Response) => {
  const { deviceId } = req.body;

  const validation = validateDeviceId(deviceId);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  if (!services.caCertificateData) {
    return res.status(500).json({ error: 'CA certificate not initialized' });
  }

  try {
    // Register device in Event Grid
    const deviceRegistration = await services.eventGridManager.registerDevice(deviceId);
    
    // Generate device certificate
    const deviceCertificate = services.certificateManager.generateDeviceCertificate(deviceId);
    
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
    const devices = await services.eventGridManager.listRegisteredDevices();
    const device = devices.find((d: string) => d.includes(deviceId));
    
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
    const devices = await services.eventGridManager.listRegisteredDevices();
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
    await services.eventGridManager.unregisterDevice(deviceId);
    res.json({ success: true, message: `Device ${deviceId} deleted successfully` });
  } catch (error: any) {
    console.error('Device deletion failed:', error);
    res.status(500).json(formatErrorResponse(error, 'Failed to delete device'));
  }
}));

export { router as deviceRoutes };
