import type {
  User,
  Home,
  HomeMember,
  Post,
  Conversation,
  Message,
  FamilyEvent,
  FamilyMemory,
  VaultFile,
  NotificationItem
} from '../types';

const TOKEN_KEY = 'homely_auth_token';

export function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setStoredToken(token: string | null): void {
  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
  } catch (err) {
    console.warn('Failed to set token in storage:', err);
  }
}

async function request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = getStoredToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {})
  };

  const response = await fetch(`/api${endpoint}`, {
    ...options,
    headers
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      // Clear invalid token
      setStoredToken(null);
    }
    throw new Error(data.error || `Request failed with status ${response.status}`);
  }

  return data as T;
}

export const api = {
  // Auth
  async register(name: string, email: string, password: string, avatar?: string) {
    const res = await request<{ user: User; token: string }>('/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password, avatar })
    });
    setStoredToken(res.token);
    return res;
  },

  async login(email: string, password: string) {
    const res = await request<{ user: User; token: string }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password })
    });
    setStoredToken(res.token);
    return res;
  },

  async getMe() {
    return request<{ user: User }>('/auth/me');
  },

  async logout() {
    try {
      await request('/auth/logout', { method: 'POST' });
    } catch {
      // ignore
    }
    setStoredToken(null);
  },

  async updateProfile(name?: string, avatar?: string) {
    return request<{ user: User }>('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify({ name, avatar })
    });
  },

  // Homes
  async getHomes() {
    return request<{ homes: Home[] }>('/homes');
  },

  async createHome(name: string, description?: string, avatar?: string) {
    return request<{ home: Home; role: string }>('/homes', {
      method: 'POST',
      body: JSON.stringify({ name, description, avatar })
    });
  },

  async joinHome(inviteCode: string) {
    return request<{ home: Home; role: string }>('/homes/join', {
      method: 'POST',
      body: JSON.stringify({ inviteCode })
    });
  },

  async getHomeDetails(homeId: string) {
    return request<{ home: Home; role: string }>(`/homes/${homeId}`);
  },

  async getHomeMembers(homeId: string) {
    return request<{ members: HomeMember[] }>(`/homes/${homeId}/members`);
  },

  // Feed & Posts
  async getPosts(homeId: string) {
    return request<{ posts: Post[] }>(`/homes/${homeId}/posts`);
  },

  async createPost(homeId: string, content: string, type: 'update' | 'photo' | 'announcement' | 'memory', imageUrl?: string) {
    return request<{ post: Post }>(`/homes/${homeId}/posts`, {
      method: 'POST',
      body: JSON.stringify({ content, type, imageUrl })
    });
  },

  async toggleReaction(homeId: string, postId: string, emoji: string) {
    return request<{ success: boolean }>(`/homes/${homeId}/posts/${postId}/reactions`, {
      method: 'POST',
      body: JSON.stringify({ emoji })
    });
  },

  async addComment(homeId: string, postId: string, content: string) {
    return request<{ comment: any }>(`/homes/${homeId}/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content })
    });
  },

  async deletePost(homeId: string, postId: string) {
    return request<{ success: boolean }>(`/homes/${homeId}/posts/${postId}`, {
      method: 'DELETE'
    });
  },

  // Chat
  async getConversations(homeId: string) {
    return request<{ conversations: Conversation[] }>(`/homes/${homeId}/conversations`);
  },

  async startDirectChat(homeId: string, targetUserId: string) {
    return request<{ conversation: any }>(`/homes/${homeId}/conversations/direct`, {
      method: 'POST',
      body: JSON.stringify({ targetUserId })
    });
  },

  async getMessages(homeId: string, conversationId: string) {
    return request<{ messages: Message[] }>(`/homes/${homeId}/conversations/${conversationId}/messages`);
  },

  async sendMessage(homeId: string, conversationId: string, content: string, replyToId?: string, mediaUrl?: string) {
    return request<{ message: Message }>(`/homes/${homeId}/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, replyToId, mediaUrl })
    });
  },

  // Events
  async getEvents(homeId: string) {
    return request<{ events: FamilyEvent[] }>(`/homes/${homeId}/events`);
  },

  async createEvent(homeId: string, data: { title: string; description?: string; date: string; time?: string; location?: string }) {
    return request<{ event: FamilyEvent }>(`/homes/${homeId}/events`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async toggleRsvp(homeId: string, eventId: string) {
    return request<{ success: boolean; isAttending: boolean; attendeeCount: number }>(`/homes/${homeId}/events/${eventId}/rsvp`, {
      method: 'POST'
    });
  },

  async deleteEvent(homeId: string, eventId: string) {
    return request<{ success: boolean }>(`/homes/${homeId}/events/${eventId}`, {
      method: 'DELETE'
    });
  },

  // Memories
  async getMemories(homeId: string) {
    return request<{ memories: FamilyMemory[] }>(`/homes/${homeId}/memories`);
  },

  async createMemory(homeId: string, data: { title: string; story: string; date?: string; imageUrl?: string }) {
    return request<{ memory: FamilyMemory }>(`/homes/${homeId}/memories`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // Vault
  async getVaultFiles(homeId: string) {
    return request<{ files: VaultFile[] }>(`/homes/${homeId}/vault`);
  },

  async createVaultFile(homeId: string, data: { title: string; category: string; description?: string; contentOrUrl: string }) {
    return request<{ file: VaultFile }>(`/homes/${homeId}/vault`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  // Notifications
  async getNotifications(homeId: string) {
    return request<{ notifications: NotificationItem[] }>(`/homes/${homeId}/notifications`);
  },

  async markNotificationsRead(homeId: string) {
    return request<{ success: boolean }>(`/homes/${homeId}/notifications/read-all`, {
      method: 'POST'
    });
  },

  // Ask Homely
  async askHomely(homeId: string, prompt: string) {
    return request<{ reply: string; source: string }>(`/homes/${homeId}/ask`, {
      method: 'POST',
      body: JSON.stringify({ prompt })
    });
  }
};
