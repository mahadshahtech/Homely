import { WebSocketServer, WebSocket } from 'ws';
import type { IncomingMessage, Server as HttpServer } from 'http';
import { URL } from 'url';
import {
  getUserByToken,
  isUserInHome,
  getConversationById,
  getUserHomes
} from './db.ts';

export interface AuthenticatedClient {
  ws: WebSocket;
  userId: string;
  userName: string;
  subscribedConversations: Set<string>;
  subscribedHomes: Set<string>;
  isAlive: boolean;
}

// In-memory connection registries
const clients = new Map<WebSocket, AuthenticatedClient>();
const userSockets = new Map<string, Set<WebSocket>>();
const conversationRooms = new Map<string, Set<WebSocket>>();
const homeRooms = new Map<string, Set<WebSocket>>();

let wssInstance: WebSocketServer | null = null;
let heartbeatInterval: NodeJS.Timeout | null = null;

/**
 * Check if a user currently has any active WebSocket connections
 */
export function isUserOnline(userId: string): boolean {
  const sockets = userSockets.get(userId);
  if (!sockets) return false;
  for (const s of sockets) {
    if (s.readyState === WebSocket.OPEN) return true;
  }
  return false;
}

/**
 * Get online user IDs among given list or within a home
 */
export function getOnlineUsers(userIds: string[]): string[] {
  return userIds.filter(id => isUserOnline(id));
}

/**
 * Check if a user is actively viewing a specific conversation room right now
 */
export function isUserInConversationRoom(userId: string, conversationId: string): boolean {
  const sockets = userSockets.get(userId);
  if (!sockets || sockets.size === 0) return false;
  for (const ws of sockets) {
    if (ws.readyState === WebSocket.OPEN) {
      const client = clients.get(ws);
      if (client && client.subscribedConversations.has(conversationId)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Broadcast an event to all authorized subscribers of a specific conversation room
 */
export function broadcastToConversation(
  conversationId: string,
  type: string,
  payload: any,
  excludeUserId?: string
): void {
  const room = conversationRooms.get(conversationId);
  if (!room || room.size === 0) return;

  const rawMessage = JSON.stringify({ type, payload });

  for (const ws of room) {
    if (ws.readyState !== WebSocket.OPEN) continue;
    const client = clients.get(ws);
    if (!client) continue;
    if (excludeUserId && client.userId === excludeUserId) continue;

    try {
      ws.send(rawMessage);
    } catch (err) {
      console.warn(`[Realtime] Failed to send to socket in conv ${conversationId}:`, err);
    }
  }
}

/**
 * Broadcast an event to all authorized subscribers of a home
 */
export function broadcastToHome(
  homeId: string,
  type: string,
  payload: any,
  excludeUserId?: string
): void {
  const room = homeRooms.get(homeId);
  if (!room || room.size === 0) return;

  const rawMessage = JSON.stringify({ type, payload });

  for (const ws of room) {
    if (ws.readyState !== WebSocket.OPEN) continue;
    const client = clients.get(ws);
    if (!client) continue;
    if (excludeUserId && client.userId === excludeUserId) continue;

    try {
      ws.send(rawMessage);
    } catch (err) {
      console.warn(`[Realtime] Failed to send to socket in home ${homeId}:`, err);
    }
  }
}

/**
 * Send an event to all sockets of a specific user
 */
export function sendToUser(userId: string, type: string, payload: any): void {
  const sockets = userSockets.get(userId);
  if (!sockets || sockets.size === 0) return;

  const rawMessage = JSON.stringify({ type, payload });

  for (const ws of sockets) {
    if (ws.readyState === WebSocket.OPEN) {
      try {
        ws.send(rawMessage);
      } catch (err) {
        console.warn(`[Realtime] Failed to send to user ${userId}:`, err);
      }
    }
  }
}

/**
 * Cleanup client socket on disconnect
 */
async function handleClientDisconnect(ws: WebSocket) {
  const client = clients.get(ws);
  if (!client) return;

  const { userId, subscribedConversations, subscribedHomes } = client;

  // Remove from conversation rooms
  for (const convId of subscribedConversations) {
    const room = conversationRooms.get(convId);
    if (room) {
      room.delete(ws);
      if (room.size === 0) conversationRooms.delete(convId);
    }
  }

  // Remove from home rooms
  for (const homeId of subscribedHomes) {
    const room = homeRooms.get(homeId);
    if (room) {
      room.delete(ws);
      if (room.size === 0) homeRooms.delete(homeId);
    }
  }

  // Remove from user sockets map
  const userSet = userSockets.get(userId);
  if (userSet) {
    userSet.delete(ws);
    if (userSet.size === 0) {
      userSockets.delete(userId);
      // User is now completely offline - notify homes
      try {
        const homes = await getUserHomes(userId);
        for (const h of homes) {
          broadcastToHome(h.id, 'presence:update', {
            userId,
            isOnline: false,
            lastActiveAt: new Date().toISOString()
          });
        }
      } catch (err) {
        console.warn('[Realtime] Error broadcasting offline presence:', err);
      }
    }
  }

  clients.delete(ws);
}

/**
 * Authenticate socket connection
 */
async function authenticateSocket(ws: WebSocket, token: string): Promise<AuthenticatedClient | null> {
  try {
    const user = await getUserByToken(token);
    if (!user) return null;

    const client: AuthenticatedClient = {
      ws,
      userId: user.id,
      userName: user.name,
      subscribedConversations: new Set(),
      subscribedHomes: new Set(),
      isAlive: true
    };

    clients.set(ws, client);

    if (!userSockets.has(user.id)) {
      userSockets.set(user.id, new Set());
    }
    const hadSockets = userSockets.get(user.id)!.size > 0;
    userSockets.get(user.id)!.add(ws);

    // Send confirmation to client
    ws.send(JSON.stringify({
      type: 'auth:success',
      payload: {
        userId: user.id,
        userName: user.name
      }
    }));

    // If first socket for this user, broadcast presence online
    if (!hadSockets) {
      try {
        const homes = await getUserHomes(user.id);
        for (const h of homes) {
          broadcastToHome(h.id, 'presence:update', {
            userId: user.id,
            isOnline: true,
            lastActiveAt: new Date().toISOString()
          });
        }
      } catch (err) {
        console.warn('[Realtime] Error broadcasting online presence:', err);
      }
    }

    return client;
  } catch (err) {
    console.error('[Realtime] Auth error:', err);
    return null;
  }
}

/**
 * Handle incoming client message
 */
async function handleClientMessage(ws: WebSocket, raw: string) {
  let message: any;
  try {
    message = JSON.parse(raw);
  } catch {
    return;
  }

  const { type, payload } = message || {};
  let client = clients.get(ws);

  // If not yet authenticated, only allow auth action
  if (!client) {
    if (type === 'auth' && payload?.token) {
      client = await authenticateSocket(ws, payload.token);
      if (!client) {
        ws.send(JSON.stringify({ type: 'auth:error', error: 'Authentication failed' }));
        ws.close(4001, 'Unauthorized');
      }
    } else {
      ws.send(JSON.stringify({ type: 'auth:error', error: 'Authentication required' }));
      ws.close(4001, 'Unauthorized');
    }
    return;
  }

  // Handle client ping/pong
  if (type === 'pong' || type === 'ping') {
    client.isAlive = true;
    if (type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong' }));
    }
    return;
  }

  // 1. Join Home Channel
  if (type === 'join_home') {
    const { homeId } = payload || {};
    if (!homeId || typeof homeId !== 'string') return;

    // Strict security check: verify user belongs to this home
    const isMember = await isUserInHome(client.userId, homeId);
    if (!isMember) {
      ws.send(JSON.stringify({
        type: 'error',
        code: 'FORBIDDEN_HOME',
        error: 'You are not a member of this home'
      }));
      return;
    }

    if (!homeRooms.has(homeId)) {
      homeRooms.set(homeId, new Set());
    }
    homeRooms.get(homeId)!.add(ws);
    client.subscribedHomes.add(homeId);

    ws.send(JSON.stringify({
      type: 'home:joined',
      payload: { homeId }
    }));
    return;
  }

  // 2. Leave Home Channel
  if (type === 'leave_home') {
    const { homeId } = payload || {};
    if (homeId) {
      homeRooms.get(homeId)?.delete(ws);
      client.subscribedHomes.delete(homeId);
      ws.send(JSON.stringify({
        type: 'home:left',
        payload: { homeId }
      }));
    }
    return;
  }

  // 3. Join Conversation Room
  if (type === 'join_conversation') {
    const { homeId, conversationId } = payload || {};
    if (!homeId || !conversationId) {
      ws.send(JSON.stringify({
        type: 'error',
        code: 'INVALID_REQUEST',
        error: 'homeId and conversationId are required'
      }));
      return;
    }

    // STRICT AUTHORIZATION CHECKS:
    // a) Is user a member of homeId?
    const isMember = await isUserInHome(client.userId, homeId);
    if (!isMember) {
      ws.send(JSON.stringify({
        type: 'error',
        code: 'FORBIDDEN_HOME',
        error: 'Access denied: You do not belong to this home'
      }));
      return;
    }

    // b) Does conversation exist and match homeId?
    const conversation = await getConversationById(conversationId);
    if (!conversation || conversation.homeId !== homeId) {
      ws.send(JSON.stringify({
        type: 'error',
        code: 'NOT_FOUND',
        error: 'Conversation does not exist in this home'
      }));
      return;
    }

    // c) Is user an authorized participant of this conversation?
    if (!conversation.participantIds.includes(client.userId)) {
      ws.send(JSON.stringify({
        type: 'error',
        code: 'FORBIDDEN_CONVERSATION',
        error: 'Access denied: You are not a participant of this conversation'
      }));
      return;
    }

    // Authorized! Add to conversation room
    if (!conversationRooms.has(conversationId)) {
      conversationRooms.set(conversationId, new Set());
    }
    conversationRooms.get(conversationId)!.add(ws);
    client.subscribedConversations.add(conversationId);

    ws.send(JSON.stringify({
      type: 'conversation:joined',
      payload: { conversationId }
    }));
    return;
  }

  // 4. Leave Conversation Room
  if (type === 'leave_conversation') {
    const { conversationId } = payload || {};
    if (conversationId) {
      conversationRooms.get(conversationId)?.delete(ws);
      client.subscribedConversations.delete(conversationId);
      ws.send(JSON.stringify({
        type: 'conversation:left',
        payload: { conversationId }
      }));
    }
    return;
  }

  // 5. Typing Indicator
  if (type === 'typing') {
    const { conversationId, isTyping } = payload || {};
    if (!conversationId) return;

    // Verify client is authorized and subscribed to this conversation
    if (!client.subscribedConversations.has(conversationId)) {
      return;
    }

    // Broadcast typing event to other members in the conversation room
    broadcastToConversation(
      conversationId,
      'typing:update',
      {
        conversationId,
        userId: client.userId,
        userName: client.userName,
        isTyping: !!isTyping
      },
      client.userId // exclude sender
    );
    return;
  }
}

/**
 * Setup and attach WebSocket server to existing HTTP server
 */
export function setupRealtimeServer(server: any): WebSocketServer {
  if (wssInstance) {
    return wssInstance;
  }

  const wss = new WebSocketServer({ noServer: true });
  wssInstance = wss;

  server.on('upgrade', async (request: IncomingMessage, socket, head) => {
    try {
      const host = request.headers.host || 'localhost:3000';
      const url = new URL(request.url || '', `http://${host}`);

      if (url.pathname === '/ws') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      }
      // If not /ws, let other upgrade handlers (like Vite HMR if any) handle it
    } catch (err) {
      console.error('[Realtime] Error during upgrade:', err);
      socket.destroy();
    }
  });

  wss.on('connection', async (ws: WebSocket, request: IncomingMessage) => {
    try {
      const host = request.headers.host || 'localhost:3000';
      const url = new URL(request.url || '', `http://${host}`);
      const token = url.searchParams.get('token');

      if (token) {
        const client = await authenticateSocket(ws, token);
        if (!client) {
          ws.send(JSON.stringify({ type: 'auth:error', error: 'Invalid or expired session token' }));
          ws.close(4001, 'Unauthorized');
          return;
        }
      } else {
        // Allow client 5 seconds to authenticate via auth message frame
        const authTimeout = setTimeout(() => {
          if (!clients.has(ws)) {
            ws.send(JSON.stringify({ type: 'auth:error', error: 'Authentication timeout' }));
            ws.close(4001, 'Unauthorized');
          }
        }, 5000);

        ws.once('close', () => clearTimeout(authTimeout));
      }

      ws.on('message', (data) => {
        handleClientMessage(ws, data.toString());
      });

      ws.on('pong', () => {
        const c = clients.get(ws);
        if (c) c.isAlive = true;
      });

      ws.on('close', () => {
        handleClientDisconnect(ws);
      });

      ws.on('error', (err) => {
        console.warn('[Realtime] WebSocket error on client:', err);
        handleClientDisconnect(ws);
      });
    } catch (err) {
      console.error('[Realtime] Error on connection handler:', err);
      ws.close(1011, 'Internal Server Error');
    }
  });

  // Heartbeat ping interval: checks dead sockets every 30s
  heartbeatInterval = setInterval(() => {
    for (const [ws, client] of clients.entries()) {
      if (!client.isAlive) {
        ws.terminate();
        handleClientDisconnect(ws);
        continue;
      }
      client.isAlive = false;
      try {
        ws.ping();
      } catch {
        ws.terminate();
        handleClientDisconnect(ws);
      }
    }
  }, 30000);

  wss.on('close', () => {
    if (heartbeatInterval) clearInterval(heartbeatInterval);
  });

  console.log('[Realtime] WebSocket server initialized on /ws');
  return wss;
}
