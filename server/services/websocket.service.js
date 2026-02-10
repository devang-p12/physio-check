import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import { addSensorDataPoint, getActiveSession } from '../models/Session.model.js';

let wss = null;
const clients = new Map(); // Map of userId -> WebSocket connection

export const initializeWebSocket = (server) => {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', async (ws, req) => {
    console.log('🔌 New WebSocket connection');

    // Extract token from query params
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(4001, 'Missing authentication token');
      return;
    }

    try {
      // Verify JWT token
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      const userId = decoded.id;

      // Store the connection
      clients.set(userId, ws);
      console.log(`✅ User ${userId} connected via WebSocket`);

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'connected',
        userId: userId,
        timestamp: new Date().toISOString()
      }));

      // Handle incoming messages
      ws.on('message', async (data) => {
        try {
          const message = JSON.parse(data.toString());
          await handleMessage(userId, message, ws);
        } catch (error) {
          console.error('❌ WebSocket message error:', error);
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Invalid message format'
          }));
        }
      });

      // Handle disconnection
      ws.on('close', () => {
        clients.delete(userId);
        console.log(`👋 User ${userId} disconnected`);
      });

      // Handle errors
      ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
        clients.delete(userId);
      });

    } catch (error) {
      console.error('❌ WebSocket authentication failed:', error);
      ws.close(4002, 'Invalid token');
    }
  });

  console.log('✅ WebSocket server initialized');
  return wss;
};

// Handle different types of messages
const handleMessage = async (userId, message, ws) => {
  const { type, data } = message;

  switch (type) {
    case 'sensor_data':
      await handleSensorData(userId, data, ws);
      break;

    case 'session_start':
      await handleSessionStart(userId, data, ws);
      break;

    case 'session_end':
      await handleSessionEnd(userId, data, ws);
      break;

    case 'ping':
      ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
      break;

    default:
      ws.send(JSON.stringify({
        type: 'error',
        message: `Unknown message type: ${type}`
      }));
  }
};

// Handle real-time sensor data
const handleSensorData = async (userId, data, ws) => {
  try {
    // Get active session for the user
    const activeSession = await getActiveSession(userId);

    if (!activeSession) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'No active session found. Please start a session first.'
      }));
      return;
    }

    // Add sensor data point to the session
    const sensorDataPoint = {
      timestamp: new Date(data.timestamp || Date.now()),
      heartRate: data.heartRate,
      steps: data.steps,
      calories: data.calories,
      distance: data.distance,
      speed: data.speed,
      elevation: data.elevation,
      acceleration: data.acceleration,
      gyroscope: data.gyroscope,
      orientation: data.orientation
    };

    await addSensorDataPoint(activeSession._id, sensorDataPoint);

    // Broadcast to connected clients (e.g., doctor monitoring)
    broadcastToUser(userId, {
      type: 'sensor_data_received',
      sessionId: activeSession._id,
      data: sensorDataPoint
    });

    // Send acknowledgment
    ws.send(JSON.stringify({
      type: 'sensor_data_ack',
      timestamp: sensorDataPoint.timestamp
    }));

  } catch (error) {
    console.error('Error handling sensor data:', error);
    ws.send(JSON.stringify({
      type: 'error',
      message: 'Failed to process sensor data'
    }));
  }
};

// Handle session start
const handleSessionStart = async (userId, data, ws) => {
  ws.send(JSON.stringify({
    type: 'session_started',
    sessionId: data.sessionId,
    timestamp: new Date().toISOString()
  }));
};

// Handle session end
const handleSessionEnd = async (userId, data, ws) => {
  ws.send(JSON.stringify({
    type: 'session_ended',
    sessionId: data.sessionId,
    timestamp: new Date().toISOString()
  }));
};

// Broadcast message to a specific user
export const broadcastToUser = (userId, message) => {
  const client = clients.get(userId);
  if (client && client.readyState === 1) { // 1 = OPEN
    client.send(JSON.stringify(message));
  }
};

// Broadcast to all connected clients
export const broadcastToAll = (message) => {
  clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify(message));
    }
  });
};

// Get connected clients count
export const getConnectedClientsCount = () => {
  return clients.size;
};

export { wss };
