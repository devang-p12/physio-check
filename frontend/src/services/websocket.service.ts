/**
 * WebSocket Service for Real-time Sensor Data
 */

class WebSocketService {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectDelay = 3000;
    this.listeners = new Map();
  }

  /**
   * Connect to WebSocket server
   */
  connect(token) {
    const wsUrl = `ws://localhost:5000/ws?token=${token}`;
    
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('✅ WebSocket connected');
      this.reconnectAttempts = 0;
      this.emit('connected', { timestamp: new Date() });
    };

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    };

    this.ws.onerror = (error) => {
      console.error('❌ WebSocket error:', error);
      this.emit('error', error);
    };

    this.ws.onclose = () => {
      console.log('👋 WebSocket disconnected');
      this.emit('disconnected', { timestamp: new Date() });
      this.attemptReconnect(token);
    };
  }

  /**
   * Attempt to reconnect
   */
  attemptReconnect(token) {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})...`);
      
      setTimeout(() => {
        this.connect(token);
      }, this.reconnectDelay);
    } else {
      console.error('Max reconnection attempts reached');
      this.emit('max-reconnect-attempts');
    }
  }

  /**
   * Send sensor data to server
   */
  sendSensorData(data) {
    if (this.isConnected()) {
      this.send({
        type: 'sensor_data',
        data: {
          timestamp: Date.now(),
          ...data
        }
      });
    } else {
      console.warn('WebSocket not connected. Cannot send sensor data.');
    }
  }

  /**
   * Start session
   */
  startSession(sessionId) {
    this.send({
      type: 'session_start',
      data: { sessionId }
    });
  }

  /**
   * End session
   */
  endSession(sessionId) {
    this.send({
      type: 'session_end',
      data: { sessionId }
    });
  }

  /**
   * Send ping
   */
  ping() {
    this.send({ type: 'ping' });
  }

  /**
   * Send message to server
   */
  send(message) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Handle incoming messages
   */
  handleMessage(message) {
    const { type, ...data } = message;
    this.emit(type, data);
  }

  /**
   * Subscribe to events
   */
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  /**
   * Unsubscribe from events
   */
  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * Emit event to listeners
   */
  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => {
        callback(data);
      });
    }
  }

  /**
   * Check if connected
   */
  isConnected() {
    return this.ws && this.ws.readyState === WebSocket.OPEN;
  }

  /**
   * Disconnect
   */
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// Export singleton instance
export const wsService = new WebSocketService();
export default wsService;
