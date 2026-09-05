import { getStoredToken } from './api';

export type RealtimeStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export type RealtimeEventHandler = (data: any) => void;

class RealtimeChatClient {
  private ws: WebSocket | null = null;
  private status: RealtimeStatus = 'disconnected';
  private statusListeners = new Set<(status: RealtimeStatus) => void>();
  private eventListeners = new Map<string, Set<RealtimeEventHandler>>();
  private reconnectAttempts = 0;
  private maxReconnectDelay = 10000;
  private reconnectTimer: any = null;
  private pingInterval: any = null;
  private currentHomeId: string | null = null;
  private currentConversationId: string | null = null;
  private intentionalDisconnect = false;

  constructor() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => {
        if (!this.intentionalDisconnect && getStoredToken()) {
          this.connect();
        }
      });
      window.addEventListener('offline', () => {
        if (this.reconnectTimer) {
          clearTimeout(this.reconnectTimer);
          this.reconnectTimer = null;
        }
        this.setStatus('disconnected');
      });
    }
  }

  public getStatus(): RealtimeStatus {
    return this.status;
  }

  public onStatusChange(callback: (status: RealtimeStatus) => void): () => void {
    this.statusListeners.add(callback);
    callback(this.status);
    return () => {
      this.statusListeners.delete(callback);
    };
  }

  private setStatus(newStatus: RealtimeStatus) {
    if (this.status !== newStatus) {
      this.status = newStatus;
      this.statusListeners.forEach(cb => {
        try {
          cb(newStatus);
        } catch (err) {
          console.error('[RealtimeClient] Error in status callback:', err);
        }
      });
    }
  }

  /**
   * Subscribe to specific event type
   */
  public on(event: string, handler: RealtimeEventHandler): () => void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(handler);

    return () => {
      this.off(event, handler);
    };
  }

  /**
   * Unsubscribe from event
   */
  public off(event: string, handler: RealtimeEventHandler): void {
    const set = this.eventListeners.get(event);
    if (set) {
      set.delete(handler);
      if (set.size === 0) {
        this.eventListeners.delete(event);
      }
    }
  }

  private emit(event: string, data: any) {
    const handlers = this.eventListeners.get(event);
    if (handlers) {
      handlers.forEach(h => {
        try {
          h(data);
        } catch (err) {
          console.error(`[RealtimeClient] Error in handler for event "${event}":`, err);
        }
      });
    }
  }

  /**
   * Connect to WebSocket server with active authentication token
   */
  public connect(): void {
    const token = getStoredToken();
    if (!token) {
      this.setStatus('disconnected');
      return;
    }

    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) {
      return;
    }

    this.intentionalDisconnect = false;
    this.setStatus(this.reconnectAttempts > 0 ? 'reconnecting' : 'connecting');

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws?token=${encodeURIComponent(token)}`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        const wasReconnect = this.reconnectAttempts > 0;
        this.reconnectAttempts = 0;
        this.setStatus('connected');
        this.startHeartbeat();

        // Re-join home room if active
        if (this.currentHomeId) {
          this.send('join_home', { homeId: this.currentHomeId });
        }

        // Re-join conversation room if active
        if (this.currentHomeId && this.currentConversationId) {
          this.send('join_conversation', {
            homeId: this.currentHomeId,
            conversationId: this.currentConversationId
          });
        }

        if (wasReconnect) {
          this.emit('reconnected', { homeId: this.currentHomeId });
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          const { type, payload } = message;

          if (type === 'pong') {
            return;
          }

          if (type) {
            this.emit(type, payload);
          }
        } catch (err) {
          console.warn('[RealtimeClient] Error parsing incoming websocket message:', err);
        }
      };

      this.ws.onclose = (event) => {
        this.stopHeartbeat();
        this.ws = null;

        if (this.intentionalDisconnect) {
          this.setStatus('disconnected');
        } else {
          this.setStatus('disconnected');
          this.scheduleReconnect();
        }
      };

      this.ws.onerror = (err) => {
        console.warn('[RealtimeClient] WebSocket encountered an error:', err);
      };
    } catch (err) {
      console.error('[RealtimeClient] Failed to create WebSocket connection:', err);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.intentionalDisconnect) return;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);

    // If browser is currently offline, wait for the 'online' event instead of looping
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.setStatus('disconnected');
      return;
    }

    // Exponential backoff: 1s, 2s, 4s, up to 10s max
    const delay = Math.min(1000 * Math.pow(1.5, this.reconnectAttempts), this.maxReconnectDelay);
    this.reconnectAttempts++;
    this.setStatus('reconnecting');

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private startHeartbeat() {
    this.stopHeartbeat();
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        try {
          this.ws.send(JSON.stringify({ type: 'ping' }));
        } catch {
          // Socket might be dropping
        }
      }
    }, 25000);
  }

  private stopHeartbeat() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  public disconnect(): void {
    this.intentionalDisconnect = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.setStatus('disconnected');
  }

  private send(type: string, payload: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      try {
        this.ws.send(JSON.stringify({ type, payload }));
      } catch (err) {
        console.warn(`[RealtimeClient] Failed to send message of type "${type}":`, err);
      }
    }
  }

  /**
   * Join a family home channel for home-wide events and presence
   */
  public joinHome(homeId: string): void {
    this.currentHomeId = homeId;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send('join_home', { homeId });
    }
  }

  public leaveHome(homeId: string): void {
    if (this.currentHomeId === homeId) {
      this.currentHomeId = null;
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send('leave_home', { homeId });
    }
  }

  /**
   * Join an active conversation room for realtime messages and typing
   */
  public joinConversation(homeId: string, conversationId: string): void {
    this.currentHomeId = homeId;
    this.currentConversationId = conversationId;
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send('join_conversation', { homeId, conversationId });
    }
  }

  public leaveConversation(conversationId: string): void {
    if (this.currentConversationId === conversationId) {
      this.currentConversationId = null;
    }
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send('leave_conversation', { conversationId });
    }
  }

  /**
   * Send realtime typing indicator state
   */
  public sendTyping(conversationId: string, isTyping: boolean): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.send('typing', { conversationId, isTyping });
    }
  }
}

export const realtimeChat = new RealtimeChatClient();
