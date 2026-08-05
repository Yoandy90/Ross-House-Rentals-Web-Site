import { io, Socket } from 'socket.io-client';
import Constants from 'expo-constants';

class SocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;

  connect(userId: string): Socket {
    if (this.socket?.connected) {
      console.log('Socket already connected');
      return this.socket;
    }

    // Get backend URL from environment
    const backendUrl = Constants.expoConfig?.extra?.EXPO_BACKEND_URL || 'http://localhost:8001';
    
    console.log('Connecting to Socket.IO:', backendUrl);

    this.socket = io(backendUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: this.maxReconnectAttempts,
    });

    this.socket.on('connect', () => {
      console.log('✅ Socket connected:', this.socket?.id);
      this.reconnectAttempts = 0;
      
      // Join user-specific room for notifications
      this.socket?.emit('join_user_room', { user_id: userId }, (response: any) => {
        console.log('Joined user room:', response);
      });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason);
    });

    this.socket.on('connect_error', (error) => {
      // Silenciar errores de socket en desarrollo para no molestar al usuario
      if (__DEV__) {
        console.log('⚠️  Socket connection issue (dev mode):', error.message);
      } else {
        console.error('Socket connection error:', error.message);
      }
      this.reconnectAttempts++;
      
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        console.log('⚠️  Socket: Max reconnection attempts reached');
        // Silenciosamente dejar de intentar
        this.socket?.disconnect();
      }
    });

    this.socket.on('reconnect', (attemptNumber) => {
      console.log(`🔄 Socket reconnected after ${attemptNumber} attempts`);
      // Rejoin user room after reconnection
      this.socket?.emit('join_user_room', { user_id: userId });
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      console.log('Disconnecting socket...');
      this.socket.disconnect();
      this.socket = null;
    }
  }

  on(event: string, callback: (...args: any[]) => void) {
    if (this.socket) {
      this.socket.on(event, callback);
    }
  }

  off(event: string, callback?: (...args: any[]) => void) {
    if (this.socket) {
      if (callback) {
        this.socket.off(event, callback);
      } else {
        this.socket.off(event);
      }
    }
  }

  emit(event: string, data: any, callback?: (response: any) => void) {
    if (this.socket?.connected) {
      if (callback) {
        this.socket.emit(event, data, callback);
      } else {
        this.socket.emit(event, data);
      }
    } else {
      console.warn('Socket not connected, cannot emit:', event);
    }
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

// Export singleton instance
export default new SocketService();
