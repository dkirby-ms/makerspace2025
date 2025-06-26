import { Router, Request, Response } from 'express';
import { ServiceContainer } from '../services';
import { CONFIG } from '../config';
import { asyncHandler } from '../middleware';
import { validateDeviceId, formatErrorResponse, generateAuthenticationName } from '../utils';

const router = Router();

const services = ServiceContainer.getInstance();

// Register new device
router.post('/register-device', asyncHandler(async (req: Request, res: Response) => {
  const { deviceId } = req.body;

  const validation = validateDeviceId(deviceId);
  if (!validation.valid) {
    return res.status(400).json({ error: validation.error });
  }

  // Check if CA is initialized (only needed for self-generated CA)
  if (!CONFIG.certificates.useIntermediateCa && !services.caCertificateData) {
    return res.status(500).json({ error: 'CA certificate not initialized' });
  }

  try {
    // Register device in Event Grid
    const deviceRegistration = await services.eventGridManager.registerDevice(deviceId);
    
    // Generate device certificate with authentication name as CN
    const authenticationName = generateAuthenticationName(deviceId);
    const deviceCertificate = services.certificateManager.generateDeviceCertificate(deviceId, authenticationName);
    
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

// Delete all devices
router.delete('/devices', asyncHandler(async (req: Request, res: Response) => {
  try {
    const result = await services.eventGridManager.unregisterAllDevices();
    
    if (result.errors.length > 0) {
      res.status(207).json({
        success: true,
        message: `Removed ${result.removedCount} devices`,
        removedCount: result.removedCount,
        errors: result.errors,
        partialSuccess: true
      });
    } else {
      res.json({
        success: true,
        message: `Successfully removed all ${result.removedCount} devices`,
        removedCount: result.removedCount,
        errors: []
      });
    }
  } catch (error: any) {
    console.error('Failed to delete all devices:', error);
    res.status(500).json(formatErrorResponse(error, 'Failed to delete all devices'));
  }
}));

export { router as deviceRoutes };
