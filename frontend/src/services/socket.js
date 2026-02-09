import { io } from 'socket.io-client';

class SocketService {
  constructor() {
    this.socket = null;
    this.isConnected = false;
    this.listeners = new Map();
  }

  connect(token) {
    if (this.socket) {
      this.disconnect();
    }

    // Use the current domain for Socket.IO connection
    // This ensures it works with both development and production
    const baseURL = window.location.origin;

    this.socket = io(baseURL, {
      auth: {
        token: token
      },
      transports: ['polling', 'websocket'], // Try polling first, then websocket
      forceNew: true,
      reconnection: true,
      timeout: 5000,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
      maxReconnectionAttempts: 5
    });

    this.socket.on('connect', () => {
      console.log('Socket connected');
      this.isConnected = true;
      this.emit('connection_status', { connected: true });
    });

    this.socket.on('disconnect', () => {
      console.log('Socket disconnected');
      this.isConnected = false;
      this.emit('connection_status', { connected: false });
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
      this.emit('connection_error', error);
    });

    // Chat event listeners
    this.socket.on('user_online', (data) => {
      this.emit('user_online', data);
    });

    this.socket.on('user_offline', (data) => {
      this.emit('user_offline', data);
    });

    this.socket.on('new_message', (data) => {
      this.emit('new_message', data);
    });

    this.socket.on('user_typing', (data) => {
      this.emit('user_typing', data);
    });

    this.socket.on('user_stop_typing', (data) => {
      this.emit('user_stop_typing', data);
    });

    this.socket.on('message_error', (data) => {
      this.emit('message_error', data);
    });

    this.socket.on('messages_seen', (data) => {
      this.emit('messages_seen', data);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
      this.isConnected = false;
    }
  }

  // Event emitter methods
  on(event, callback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(callback);
  }

  off(event, callback) {
    if (this.listeners.has(event)) {
      const callbacks = this.listeners.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  emit(event, data) {
    if (this.listeners.has(event)) {
      this.listeners.get(event).forEach(callback => callback(data));
    }
  }

  // Chat methods
  joinConversation(conversationId) {
    if (this.socket) {
      this.socket.emit('join_conversation', conversationId);
    }
  }

  leaveConversation(conversationId) {
    if (this.socket) {
      this.socket.emit('leave_conversation', conversationId);
    }
  }

  sendMessage(conversationId, content, messageType = 'text') {
    if (this.socket) {
      this.socket.emit('send_message', {
        conversationId,
        content,
        messageType
      });
    }
  }

  startTyping(conversationId) {
    if (this.socket) {
      this.socket.emit('typing_start', conversationId);
    }
  }

  stopTyping(conversationId) {
    if (this.socket) {
      this.socket.emit('typing_stop', conversationId);
    }
  }

  markSeen(conversationId) {
    if (this.socket) {
      this.socket.emit('mark_seen', conversationId);
    }
  }

  getConnectionStatus() {
    return this.isConnected;
  }
}

// Create singleton instance
const socketService = new SocketService();

export default socketService;
