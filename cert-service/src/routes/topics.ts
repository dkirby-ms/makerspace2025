import { Router, Request, Response } from 'express';
import { EventGridClientManager } from '../eventGridClient';
import { MqttTopicMonitor } from '../mqttMonitor';
import { CONFIG } from '../config';
import { asyncHandler } from '../middleware';
import { formatErrorResponse } from '../utils';
import { HtmlTemplates } from '../templates';
import * as fs from 'fs';

const router = Router();

// Initialize Event Grid manager
const eventGridManager = new EventGridClientManager(
  CONFIG.eventGrid.subscriptionId,
  CONFIG.eventGrid.resourceGroup,
  CONFIG.eventGrid.namespaceName
);

// MQTT monitor instance
let mqttMonitor: MqttTopicMonitor | null = null;

// Initialize MQTT monitor
async function initializeMqttMonitor(): Promise<void> {
  if (mqttMonitor || !CONFIG.mqtt.brokerHost) {
    return; // Already initialized or no broker configured
  }

  try {
    let clientCert: string;
    let clientKey: string;
    let caCert: string;

    // Use content from environment variables if available, otherwise read from files
    if (CONFIG.mqtt.clientCertContent && CONFIG.mqtt.clientKeyContent && CONFIG.mqtt.caCertContent) {
      clientCert = CONFIG.mqtt.clientCertContent.replace(/\\n/g, '\n');
      clientKey = CONFIG.mqtt.clientKeyContent.replace(/\\n/g, '\n');
      caCert = CONFIG.mqtt.caCertContent.replace(/\\n/g, '\n');
      console.log('Using MQTT certificates from environment variables');
    } else {
      // Check if certificate files exist
      if (!fs.existsSync(CONFIG.mqtt.clientCertPath)) {
        console.warn(`MQTT client certificate not found at ${CONFIG.mqtt.clientCertPath}`);
        return;
      }
      if (!fs.existsSync(CONFIG.mqtt.clientKeyPath)) {
        console.warn(`MQTT client key not found at ${CONFIG.mqtt.clientKeyPath}`);
        return;
      }
      if (!fs.existsSync(CONFIG.mqtt.caCertPath)) {
        console.warn(`MQTT CA certificate not found at ${CONFIG.mqtt.caCertPath}`);
        return;
      }

      // Read certificate files
      clientCert = fs.readFileSync(CONFIG.mqtt.clientCertPath, 'utf8');
      clientKey = fs.readFileSync(CONFIG.mqtt.clientKeyPath, 'utf8');
      caCert = fs.readFileSync(CONFIG.mqtt.caCertPath, 'utf8');
      console.log('Using MQTT certificates from files');
    }

    mqttMonitor = new MqttTopicMonitor(
      CONFIG.mqtt.brokerHost,
      clientCert,
      clientKey,
      caCert,
      CONFIG.mqtt.clientId
    );

    await mqttMonitor.connect();
    console.log('MQTT monitor initialized successfully');
  } catch (error) {
    console.error('Failed to initialize MQTT monitor:', error);
    mqttMonitor = null;
  }
}

// Get topics page
router.get('/topics', asyncHandler(async (req: Request, res: Response) => {
  try {
    // Initialize MQTT monitor if not already done
    await initializeMqttMonitor();

    const [topicSpaces, permissionBindings] = await Promise.all([
      eventGridManager.getTopicSpaces(),
      eventGridManager.getPermissionBindings()
    ]);

    const templateData = {
      topicSpaces,
      permissionBindings,
      eventGridNamespace: CONFIG.eventGrid.namespaceName
    };

    const html = HtmlTemplates.generateTopicsPage(templateData);
    res.send(html);
  } catch (error: any) {
    console.error('Failed to load topics page:', error);
    res.status(500).json(formatErrorResponse(error, 'Failed to load topics'));
  }
}));

// Get messages for a topic
router.get('/api/topic/:topicName/messages', asyncHandler(async (req: Request, res: Response) => {
  const { topicName } = req.params;
  const limit = parseInt(req.query.limit as string) || 50;

  try {
    if (!mqttMonitor) {
      return res.json({ messages: [], error: 'MQTT monitor not connected' });
    }

    const messages = (mqttMonitor as MqttTopicMonitor).getMessagesForTopic(topicName);
    res.json({ messages });
  } catch (error: any) {
    console.error('Failed to get topic messages:', error);
    res.status(500).json(formatErrorResponse(error, 'Failed to get messages'));
  }
}));

// Subscribe to topic
router.post('/api/topic/:topicName/subscribe', asyncHandler(async (req: Request, res: Response) => {
  const { topicName } = req.params;

  try {
    if (!mqttMonitor) {
      await initializeMqttMonitor();
    }

    if (!mqttMonitor) {
      return res.status(400).json({ error: 'MQTT monitor not available - check configuration and certificates' });
    }

    if (!mqttMonitor.isClientConnected()) {
      return res.status(400).json({ error: 'MQTT client not connected' });
    }

    await mqttMonitor.subscribeToTopic(topicName);
    res.json({ success: true, message: `Subscribed to ${topicName}` });
  } catch (error: any) {
    console.error('Failed to subscribe to topic:', error);
    res.status(500).json(formatErrorResponse(error, 'Failed to subscribe to topic'));
  }
}));

// Unsubscribe from topic
router.delete('/api/topic/:topicName/subscribe', asyncHandler(async (req: Request, res: Response) => {
  const { topicName } = req.params;

  try {
    if (!mqttMonitor || !mqttMonitor.isClientConnected()) {
      return res.status(400).json({ error: 'MQTT monitor not connected' });
    }

    await mqttMonitor.unsubscribeFromTopic(topicName);
    res.json({ success: true, message: `Unsubscribed from ${topicName}` });
  } catch (error: any) {
    console.error('Failed to unsubscribe from topic:', error);
    res.status(500).json(formatErrorResponse(error, 'Failed to unsubscribe from topic'));
  }
}));

// Get MQTT connection status
router.get('/api/mqtt/status', asyncHandler(async (req: Request, res: Response) => {
  try {
    const hasClientCert = !!(CONFIG.mqtt.clientCertContent || (CONFIG.mqtt.clientCertPath && fs.existsSync(CONFIG.mqtt.clientCertPath)));
    const hasClientKey = !!(CONFIG.mqtt.clientKeyContent || (CONFIG.mqtt.clientKeyPath && fs.existsSync(CONFIG.mqtt.clientKeyPath)));
    const hasCaCert = !!(CONFIG.mqtt.caCertContent || (CONFIG.mqtt.caCertPath && fs.existsSync(CONFIG.mqtt.caCertPath)));
    
    const status = {
      mqttMonitor: !!mqttMonitor,
      connected: mqttMonitor ? mqttMonitor.isClientConnected() : false,
      subscribedTopics: mqttMonitor ? mqttMonitor.getSubscribedTopics() : [],
      brokerHost: CONFIG.mqtt.brokerHost,
      clientCertExists: hasClientCert,
      clientKeyExists: hasClientKey,
      caCertExists: hasCaCert,
      usingEnvCerts: !!(CONFIG.mqtt.clientCertContent && CONFIG.mqtt.clientKeyContent && CONFIG.mqtt.caCertContent)
    };
    
    res.json(status);
  } catch (error: any) {
    console.error('Failed to get MQTT status:', error);
    res.status(500).json(formatErrorResponse(error, 'Failed to get MQTT status'));
  }
}));

// Export MQTT monitor for use in other modules
export { mqttMonitor };
export { router as topicRoutes };
