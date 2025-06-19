import { Router, Request, Response } from 'express';
import { EventGridClientManager } from '../eventGridClient';
import { MqttTopicMonitor } from '../mqttMonitor';
import { CONFIG } from '../config';
import { asyncHandler } from '../middleware';
import { formatErrorResponse } from '../utils';
import { HtmlTemplates } from '../templates';

const router = Router();

// Initialize Event Grid manager
const eventGridManager = new EventGridClientManager(
  CONFIG.eventGrid.subscriptionId,
  CONFIG.eventGrid.resourceGroup,
  CONFIG.eventGrid.namespaceName
);

// MQTT monitor instance (initialized when needed)
let mqttMonitor: MqttTopicMonitor | null = null;

// Get topics page
router.get('/topics', asyncHandler(async (req: Request, res: Response) => {
  try {
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
      return res.status(400).json({ error: 'MQTT monitor not connected' });
    }

    await (mqttMonitor as MqttTopicMonitor).subscribeToTopic(topicName);
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
    if (!mqttMonitor) {
      return res.status(400).json({ error: 'MQTT monitor not connected' });
    }

    await (mqttMonitor as MqttTopicMonitor).unsubscribeFromTopic(topicName);
    res.json({ success: true, message: `Unsubscribed from ${topicName}` });
  } catch (error: any) {
    console.error('Failed to unsubscribe from topic:', error);
    res.status(500).json(formatErrorResponse(error, 'Failed to unsubscribe from topic'));
  }
}));

export { router as topicRoutes };
