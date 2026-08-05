/**
 * WebSocket Service for Real-time Chat
 * Provides instant message delivery without polling
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

type MessageHandler = (message: any) => void;
type ConnectionHandler = (connected: boolean) => void;

class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 3000; // 3 seconds
  private messageHandlers: Map<string, Set<MessageHandler>> = new Map();
  private connectionHandlers: Set<ConnectionHandler> = new Set();
  private isConnecting = false;
  private pingInterval: NodeJS.Timeout | null = null;
  private subscribedConversations: Set<string> = new Set();

  /**
   * Get the WebSocket URL based on the backend URL
   */
  private getWebSocketUrl(token: string): string {
    // Get backend URL from env
    const backendUrl = process.env.EXPO_PUBLIC_BACKEND_URL || 'https://app-nueva-production.up.railway.app';
    
    // Convert HTTP to WS
    const wsUrl = backendUrl
      .replace('https://', 'wss://')
      .replace('http://', 'ws://');
    
    return `${wsUrl}/ws/chat/${token}`;
  }

  /**
   * Connect to the WebSocket server
   */
  async connect(): Promise<boolean> {
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log('🔌 WebSocket already connected');
      return true;
    }

    if (this.isConnecting) {
      console.log('🔌 WebSocket connection in progress...');
      return false;
    }

    try {
      this.isConnecting = true;
      
      const token = await AsyncStorage.getItem('session_token');
      if (!token) {
        console.log('❌ No token available for WebSocket');
        this.isConnecting = false;
        return false;
      }

      const wsUrl = this.getWebSocketUrl(token);
      console.log('🔌 Connecting to WebSocket:', wsUrl.substring(0, 50) + '...');

      return new Promise((resolve) => {
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
          console.log('✅ WebSocket connected');
          this.isConnecting = false;
          this.reconnectAttempts = 0;
          this.notifyConnectionHandlers(true);
          this.startPingInterval();
          
          // Re-subscribe to conversations
          this.subscribedConversations.forEach(convId => {
            this.subscribeToConversation(convId);
          });
          
          resolve(true);
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (e) {
            console.error('❌ Error parsing WebSocket message:', e);
          }
        };

        this.ws.onerror = (error) => {
          console.error('❌ WebSocket error:', error);
          this.isConnecting = false;
        };

        this.ws.onclose = (event) => {
          console.log('🔌 WebSocket closed:', event.code, event.reason);
          this.isConnecting = false;
          this.notifyConnectionHandlers(false);
          this.stopPingInterval();
          
          // Attempt to reconnect
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(`🔄 Reconnecting... (attempt ${this.reconnectAttempts})`);
            setTimeout(() => this.connect(), this.reconnectDelay);
          }
          
          resolve(false);
        };

        // Timeout for connection
        setTimeout(() => {
          if (this.isConnecting) {
            console.log('⏰ WebSocket connection timeout');
            this.ws?.close();
            this.isConnecting = false;
            resolve(false);
          }
        }, 10000);
      });
    } catch (error) {
      console.error('❌ Error connecting to WebSocket:', error);
      this.isConnecting = false;
      return false;
    }
  }

  /**
   * Disconnect from WebSocket
   */
  disconnect(): void {
    this.stopPingInterval();
    this.subscribedConversations.clear();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    console.log('🔌 WebSocket disconnected');
  }

  /**
   * Subscribe to a conversation for real-time updates
   */
  subscribeToConversation(conversationId: string): void {
    this.subscribedConversations.add(conversationId);
    
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({
        type: 'subscribe',
        conversation_id: conversationId
      });
      console.log('👀 Subscribed to conversation:', conversationId);
    }
  }

  /**
   * Unsubscribe from a conversation
   */
  unsubscribeFromConversation(conversationId: string): void {
    this.subscribedConversations.delete(conversationId);
    
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({
        type: 'unsubscribe',
        conversation_id: conversationId
      });
    }
  }

  /**
   * Send typing indicator
   */
  sendTypingIndicator(conversationId: string, userName: string, isTyping: boolean): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({
        type: 'typing',
        conversation_id: conversationId,
        user_name: userName,
        is_typing: isTyping
      });
    }
  }

  /**
   * Add a message handler for a specific message type
   */
  onMessage(type: string, handler: MessageHandler): () => void {
    if (!this.messageHandlers.has(type)) {
      this.messageHandlers.set(type, new Set());
    }
    this.messageHandlers.get(type)!.add(handler);

    // Return unsubscribe function
    return () => {
      this.messageHandlers.get(type)?.delete(handler);
    };
  }

  /**
   * Add a connection status handler
   */
  onConnectionChange(handler: ConnectionHandler): () => void {
    this.connectionHandlers.add(handler);
    
    // Return unsubscribe function
    return () => {
      this.connectionHandlers.delete(handler);
    };
  }

  /**
   * Check if connected
   */
  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  // Private methods

  private send(data: any): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private handleMessage(data: any): void {
    const type = data.type;
    
    // Log received messages
    if (type !== 'pong') {
      console.log('📨 WebSocket message received:', type);
    }

    // Notify handlers
    const handlers = this.messageHandlers.get(type);
    if (handlers) {
      handlers.forEach(handler => handler(data));
    }

    // Also notify "all" handlers
    const allHandlers = this.messageHandlers.get('*');
    if (allHandlers) {
      allHandlers.forEach(handler => handler(data));
    }
  }

  private notifyConnectionHandlers(connected: boolean): void {
    this.connectionHandlers.forEach(handler => handler(connected));
  }

  private startPingInterval(): void {
    this.stopPingInterval();
    
    // Send ping every 30 seconds to keep connection alive
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: 'ping' });
      }
    }, 30000);
  }

  private stopPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }
}

// Export singleton instance
export const websocketService = new WebSocketService();
export default websocketService;
