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

wss.on('connection', (ws: WebSocket) => {
  console.log('WebSocket client connected');
  
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
    server.listen(PORT, () => {
      console.log(`🚀 Makerspace Certificate Service running on port ${PORT}`);
      console.log(`📋 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`🔐 Event Grid Namespace: ${CONFIG.eventGrid.namespaceName}`);
      console.log(`🚢 App Deployment: ENABLED`);
      console.log(`✅ CA initialized and ready for device registration`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Start the application
startServer();

export { app, server };
