import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import morgan from 'morgan';
import path from 'path';
import * as http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { CONFIG, validateConfig } from './config';
import { routes } from './routes';
import { errorHandler } from './middleware';
import { initializeCa } from './services';
import { mqttMonitor, initializeMqttMonitor } from './routes/topics';

const app = express();
const PORT = CONFIG.port;

// Validate configuration on startup
try {
  validateConfig();
} catch (error) {
  console.error('Configuration validation failed:', error);
  process.exit(1);
}

// Security and parsing middleware
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

// Serve static files
app.use(express.static(path.join(__dirname, '../public')));

// Mount routes
app.use('/', routes);

// Global error handler
app.use(errorHandler);

// Create HTTP server
const server = http.createServer(app);

// Initialize WebSocket server for real-time updates
const wss = new WebSocketServer({ server });

interface WebSocketMessage {
  type: string;
  topic?: string;
  [key: string]: any;
}

// Track connected WebSocket clients
const connectedClients = new Set<WebSocket>();

wss.on('connection', (ws: WebSocket) => {
  console.log('WebSocket client connected');
  connectedClients.add(ws);
  
  ws.on('message', (message: Buffer) => {
    try {
      const data: WebSocketMessage = JSON.parse(message.toString());
      console.log('Received WebSocket message:', data);
      
      handleWebSocketMessage(ws, data);
    } catch (error) {
      console.error('Failed to parse WebSocket message:', error);
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: 'Invalid message format',
        timestamp: Date.now()
      }));
    }
  });

  ws.on('close', () => {
    console.log('WebSocket client disconnected');
    connectedClients.delete(ws);
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
    connectedClients.delete(ws);
  });

  // Send initial connection confirmation
  ws.send(JSON.stringify({ 
    type: 'connected', 
    timestamp: Date.now(),
    server: 'makerspace-cert-service'
  }));
});

function handleWebSocketMessage(ws: WebSocket, data: WebSocketMessage): void {
  switch (data.type) {
    case 'ping':
      ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
      break;
    case 'subscribe':
      if (data.topic) {
        ws.send(JSON.stringify({ type: 'subscribed', topic: data.topic }));
      } else {
        ws.send(JSON.stringify({ 
          type: 'error', 
          message: 'Topic required for subscription',
          timestamp: Date.now()
        }));
      }
      break;
    default:
      console.log('Unknown message type:', data.type);
      ws.send(JSON.stringify({ 
        type: 'error', 
        message: `Unknown message type: ${data.type}`,
        timestamp: Date.now()
      }));
  }
}

// Function to broadcast MQTT messages to all connected WebSocket clients
function broadcastMqttMessage(mqttMessage: any): void {
  const message = JSON.stringify({
    type: 'mqtt-message',
    ...mqttMessage,
    timestamp: Date.now()
  });

  connectedClients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(message);
      } catch (error) {
        console.error('Error sending message to WebSocket client:', error);
        connectedClients.delete(client);
      }
    }
  });
}

// Graceful shutdown handler
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

// Start server with proper CA initialization  
async function startServer(): Promise<void> {
  try {
    // Initialize CA first
    await initializeCa();
    
    // Start server after CA is ready
    server.listen(PORT, async () => {
      console.log(`🚀 Makerspace Certificate Service running on port ${PORT}`);
      console.log(`📋 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔐 Event Grid Namespace: ${CONFIG.eventGrid.namespaceName}`);
      console.log(`🚢 App Deployment: ENABLED`);
      console.log(`✅ CA initialized and ready for device registration`);
      
      // Set up MQTT message forwarding after server is started
      await setupMqttMessageForwarding();
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Set up MQTT message forwarding to WebSocket clients
async function setupMqttMessageForwarding(): Promise<void> {
  try {
    console.log('🔄 Initializing MQTT monitor for WebSocket forwarding...');
    const monitor = await initializeMqttMonitor();
    
    if (monitor) {
      monitor.on('message', (mqttMessage) => {
        console.log('📨 Broadcasting MQTT message to WebSocket clients:', mqttMessage.topic);
        broadcastMqttMessage(mqttMessage);
      });
      console.log('🔗 MQTT message forwarding to WebSocket clients enabled');
    } else {
      console.log('⚠️ MQTT monitor not available - real-time messages disabled');
    }
  } catch (error) {
    console.error('❌ Failed to set up MQTT message forwarding:', error);
  }
}

// Start the application
startServer();

export { app, server };
