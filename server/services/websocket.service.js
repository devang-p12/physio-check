import { WebSocketServer } from 'ws';
import jwt from 'jsonwebtoken';
import { addSensorDataPoint, getActiveSession } from '../models/Session.model.js';

let wss = null;
const clients = new Map(); // Map of userId -> WebSocket connection

export const initializeWebSocket = (server) => {
  // ✅ CRITICAL FIX: Use handleProtocols + server upgrade filtering by path
  // so this WSS ONLY handles /ws and never touches /socket.io upgrades
  wss = new WebSocketServer({ noServer: true });

  // Manually handle the HTTP upgrade event — only pass /ws to this WSS
  server.on('upgrade', (request, socket, head) => {
    const { pathname } = new URL(request.url, `http://${request.headers.host}`);

    if (pathname === '/ws') {
      // ✅ This is our sensor data WebSocket — handle it
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
    // ✅ All other paths (like /socket.io) are left alone for Socket.IO to handle
  });

  wss.on('connection', async (ws, req) => {
    console.log('🔌 New WebSocket connection on /ws');

    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get('token');

    if (!token) {
      ws.close(4001, 'Missing authentication token');
      return;
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
      const userId = decoded.id;

      clients.set(userId, ws);
      console.log(`✅ User ${userId} connected via WebSocket /ws`);

      ws.send(JSON.stringify({
        type: 'connected',
        userId: userId,
        timestamp: new Date().toISOString()
      }));

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

      ws.on('close', () => {
        clients.delete(userId);
        console.log(`👋 User ${userId} disconnected from /ws`);
      });

      ws.on('error', (error) => {
        console.error('❌ WebSocket error:', error);
        clients.delete(userId);
      });

    } catch (error) {
      console.error('❌ WebSocket authentication failed:', error);
      ws.close(4002, 'Invalid token');
    }
  });

  console.log('✅ WebSocket server initialized on path /ws');
  return wss;
};

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

const handleSensorData = async (userId, data, ws) => {
  try {
    const activeSession = await getActiveSession(userId);

    if (!activeSession) {
      ws.send(JSON.stringify({
        type: 'error',
        message: 'No active session found. Please start a session first.'
      }));
      return;
    }

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

    broadcastToUser(userId, {
      type: 'sensor_data_received',
      sessionId: activeSession._id,
      data: sensorDataPoint
    });

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

const handleSessionStart = async (userId, data, ws) => {
  ws.send(JSON.stringify({
    type: 'session_started',
    sessionId: data.sessionId,
    timestamp: new Date().toISOString()
  }));
};

const handleSessionEnd = async (userId, data, ws) => {
  ws.send(JSON.stringify({
    type: 'session_ended',
    sessionId: data.sessionId,
    timestamp: new Date().toISOString()
  }));
};

export const broadcastToUser = (userId, message) => {
  const client = clients.get(userId);
  if (client && client.readyState === 1) {
    client.send(JSON.stringify(message));
  }
};

export const broadcastToAll = (message) => {
  clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify(message));
    }
  });
};

export const getConnectedClientsCount = () => {
  return clients.size;
};

export { wss };