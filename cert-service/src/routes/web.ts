import { Router, Request, Response } from 'express';
import { EventGridClientManager } from '../eventGridClient';
import { CONFIG } from '../config';
import { asyncHandler } from '../middleware';
import { HtmlTemplates } from '../templates';

const router = Router();

// Initialize Event Grid manager
const eventGridManager = new EventGridClientManager(
  CONFIG.eventGrid.subscriptionId,
  CONFIG.eventGrid.resourceGroup,
  CONFIG.eventGrid.namespaceName
);

// Homepage - display all registered devices
router.get('/', asyncHandler(async (req: Request, res: Response) => {
  try {
    const devices = await eventGridManager.listRegisteredDevices();
    
    const templateData = {
      devices,
      eventGridNamespace: CONFIG.eventGrid.namespaceName
    };

    const html = HtmlTemplates.generateHomePage(templateData);
    res.send(html);
  } catch (error: any) {
    console.error('Failed to load homepage:', error);
    res.status(500).send(`
      <h1>Error</h1>
      <p>Failed to load devices: ${error.message}</p>
      <a href="/health">Check service health</a>
    `);
  }
}));

export { router as webRoutes };
