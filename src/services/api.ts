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
  NotificationItem,
  NotificationPreferences,
  AskHomelyMessage,
  AskHomelyActionPending,
  AskHomelyResponse,
  AssistantMemory
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

  async updateHome(
    homeId: string,
    updates: {
      name?: string;
      description?: string;
      avatar?: string;
      coverImage?: string;
      icon?: string;
      themeColor?: string;
    }
  ) {
    return request<{ home: Home; role: string }>(`/homes/${homeId}`, {
      method: 'PUT',
      body: JSON.stringify(updates)
    });
  },

  async regenerateInviteCode(homeId: string) {
    return request<{ home: Home; inviteCode: string }>(`/homes/${homeId}/regenerate-invite`, {
      method: 'POST'
    });
  },

  async updateMemberRole(homeId: string, memberUserId: string, role: 'admin' | 'member') {
    return request<{ success: boolean; members: HomeMember[] }>(`/homes/${homeId}/members/${memberUserId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role })
    });
  },

  async removeHomeMember(homeId: string, memberUserId: string) {
    return request<{ success: boolean; members: HomeMember[] }>(`/homes/${homeId}/members/${memberUserId}`, {
      method: 'DELETE'
    });
  },

  async getHomeDashboard(homeId: string) {
    return request<{
      home: Home;
      role: string;
      members: HomeMember[];
      notices: Post[];
      upcomingEvents: FamilyEvent[];
      memories: FamilyMemory[];
      posts: Post[];
      recentActivity: Array<{
        id: string;
        type: 'post' | 'comment' | 'reaction' | 'memory' | 'event' | 'member_joined';
        title: string;
        description: string;
        actor: { id: string; name: string; avatar: string };
        createdAt: string;
      }>;
    }>(`/homes/${homeId}/dashboard`);
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
    return request<{ conversation: Conversation }>(`/homes/${homeId}/conversations/direct`, {
      method: 'POST',
      body: JSON.stringify({ targetUserId })
    });
  },

  async getMessages(homeId: string, conversationId: string) {
    return request<{ messages: Message[] }>(`/homes/${homeId}/conversations/${conversationId}/messages`);
  },

  async sendMessage(
    homeId: string,
    conversationId: string,
    payload: {
      content: string;
      replyToId?: string;
      mediaUrl?: string;
      mediaType?: 'image' | 'video' | 'file' | 'voice' | 'location' | 'poll' | 'announcement';
      mediaName?: string;
      mediaSize?: number;
      mediaDuration?: number;
      extraData?: string | object;
      isPinned?: boolean;
    }
  ) {
    return request<{ message: Message }>(`/homes/${homeId}/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
  },

  async editMessage(homeId: string, conversationId: string, messageId: string, content: string) {
    return request<{ success: boolean; messageId: string; content: string }>(
      `/homes/${homeId}/conversations/${conversationId}/messages/${messageId}`,
      {
        method: 'PATCH',
        body: JSON.stringify({ content })
      }
    );
  },

  async deleteMessage(homeId: string, conversationId: string, messageId: string) {
    return request<{ success: boolean; messageId: string }>(
      `/homes/${homeId}/conversations/${conversationId}/messages/${messageId}`,
      {
        method: 'DELETE'
      }
    );
  },

  async toggleMessageReaction(homeId: string, conversationId: string, messageId: string, emoji: string) {
    return request<{ success: boolean; messageId: string; reactions: any[] }>(
      `/homes/${homeId}/conversations/${conversationId}/messages/${messageId}/reactions`,
      {
        method: 'POST',
        body: JSON.stringify({ emoji })
      }
    );
  },

  async togglePinMessage(homeId: string, conversationId: string, messageId: string) {
    return request<{ success: boolean; id: string; isPinned: boolean; pinnedAt?: string; pinnedBy?: string }>(
      `/homes/${homeId}/conversations/${conversationId}/messages/${messageId}/pin`,
      {
        method: 'POST'
      }
    );
  },

  async getPinnedMessages(homeId: string, conversationId: string) {
    return request<{ pinnedMessages: Message[] }>(`/homes/${homeId}/conversations/${conversationId}/pinned`);
  },

  async searchMessages(homeId: string, conversationId: string, query?: string, date?: string) {
    const params = new URLSearchParams();
    if (query) params.append('q', query);
    if (date) params.append('date', date);
    return request<{ results: Message[] }>(`/homes/${homeId}/conversations/${conversationId}/search?${params.toString()}`);
  },

  async votePoll(homeId: string, conversationId: string, messageId: string, optionId: string) {
    return request<{ success: boolean; poll: any }>(
      `/homes/${homeId}/conversations/${conversationId}/poll-vote`,
      {
        method: 'POST',
        body: JSON.stringify({ messageId, optionId })
      }
    );
  },

  async sendHeartbeat(homeId: string, conversationId: string, isTyping: boolean) {
    return request<{ typingUsers: string[] }>(
      `/homes/${homeId}/conversations/${conversationId}/heartbeat`,
      {
        method: 'POST',
        body: JSON.stringify({ isTyping })
      }
    );
  },

  async uploadChatMedia(
    homeId: string,
    fileBase64: string,
    fileName: string,
    mimeType: string,
    duration?: number
  ) {
    return request<{
      url: string;
      fileName: string;
      mimeType: string;
      size: number;
      duration?: number;
    }>(`/homes/${homeId}/chat/upload`, {
      method: 'POST',
      body: JSON.stringify({ fileBase64, fileName, mimeType, duration })
    });
  },

  // Events
  async getEvents(
    homeId: string,
    params?: {
      search?: string;
      filter?: 'upcoming' | 'past' | 'all';
      attendeeId?: string;
      month?: string;
    }
  ) {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.filter) query.set('filter', params.filter);
    if (params?.attendeeId) query.set('attendeeId', params.attendeeId);
    if (params?.month) query.set('month', params.month);

    const queryString = query.toString();
    const endpoint = `/homes/${homeId}/events${queryString ? `?${queryString}` : ''}`;
    return request<{ events: FamilyEvent[] }>(endpoint);
  },

  async getEventById(homeId: string, eventId: string) {
    return request<{ event: FamilyEvent }>(`/homes/${homeId}/events/${eventId}`);
  },

  async createEvent(
    homeId: string,
    data: {
      title: string;
      description?: string;
      date: string;
      time?: string;
      endTime?: string;
      location?: string;
      reminder?: string;
      attendeeIds?: string[];
    }
  ) {
    return request<{ event: FamilyEvent }>(`/homes/${homeId}/events`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateEvent(
    homeId: string,
    eventId: string,
    data: {
      title?: string;
      description?: string;
      date?: string;
      time?: string;
      endTime?: string;
      location?: string;
      reminder?: string;
      attendeeIds?: string[];
    }
  ) {
    return request<{ event: FamilyEvent }>(`/homes/${homeId}/events/${eventId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async setEventRsvp(homeId: string, eventId: string, status: 'going' | 'maybe' | 'declined') {
    return request<{
      success: boolean;
      status: 'going' | 'maybe' | 'declined';
      isAttending: boolean;
      attendeeCount: number;
      event: FamilyEvent;
    }>(`/homes/${homeId}/events/${eventId}/rsvp`, {
      method: 'POST',
      body: JSON.stringify({ status })
    });
  },

  async toggleRsvp(homeId: string, eventId: string) {
    return request<{
      success: boolean;
      isAttending: boolean;
      attendeeCount: number;
      status: 'going' | 'maybe' | 'declined';
      event?: FamilyEvent;
    }>(`/homes/${homeId}/events/${eventId}/rsvp`, {
      method: 'POST'
    });
  },

  async deleteEvent(homeId: string, eventId: string) {
    return request<{ success: boolean }>(`/homes/${homeId}/events/${eventId}`, {
      method: 'DELETE'
    });
  },

  // Memories & Family Album
  async getMemories(
    homeId: string,
    params?: {
      search?: string;
      personId?: string;
      startDate?: string;
      endDate?: string;
      sort?: 'recent' | 'oldest';
    }
  ) {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.personId) query.set('personId', params.personId);
    if (params?.startDate) query.set('startDate', params.startDate);
    if (params?.endDate) query.set('endDate', params.endDate);
    if (params?.sort) query.set('sort', params.sort);
    const qs = query.toString();
    return request<{ memories: FamilyMemory[] }>(`/homes/${homeId}/memories${qs ? `?${qs}` : ''}`);
  },

  async getMemoryById(homeId: string, memoryId: string) {
    return request<{ memory: FamilyMemory }>(`/homes/${homeId}/memories/${memoryId}`);
  },

  async uploadMemoryPhoto(homeId: string, fileBase64: string, fileName: string, mimeType: string) {
    return request<{ url: string; fileName: string; mimeType: string; size: number }>(`/homes/${homeId}/memories/upload`, {
      method: 'POST',
      body: JSON.stringify({ fileBase64, fileName, mimeType })
    });
  },

  async createMemory(
    homeId: string,
    data: {
      title: string;
      story: string;
      date?: string;
      imageUrl?: string;
      images?: string[];
      location?: string;
      taggedMemberIds?: string[];
    }
  ) {
    return request<{ memory: FamilyMemory }>(`/homes/${homeId}/memories`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  },

  async updateMemory(
    homeId: string,
    memoryId: string,
    data: {
      title?: string;
      story?: string;
      date?: string;
      imageUrl?: string;
      images?: string[];
      location?: string;
      taggedMemberIds?: string[];
    }
  ) {
    return request<{ memory: FamilyMemory }>(`/homes/${homeId}/memories/${memoryId}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  },

  async deleteMemory(homeId: string, memoryId: string) {
    return request<{ success: boolean }>(`/homes/${homeId}/memories/${memoryId}`, {
      method: 'DELETE'
    });
  },

  async toggleMemoryReaction(homeId: string, memoryId: string, emoji: string) {
    return request<{ success: boolean; reacted: boolean; reactions: Record<string, { count: number; userIds: string[]; hasReacted: boolean }> }>(
      `/homes/${homeId}/memories/${memoryId}/reactions`,
      {
        method: 'POST',
        body: JSON.stringify({ emoji })
      }
    );
  },

  async addMemoryComment(homeId: string, memoryId: string, content: string) {
    return request<{ comment: import('../types').MemoryComment }>(`/homes/${homeId}/memories/${memoryId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content })
    });
  },

  async deleteMemoryComment(homeId: string, memoryId: string, commentId: string) {
    return request<{ success: boolean }>(`/homes/${homeId}/memories/${memoryId}/comments/${commentId}`, {
      method: 'DELETE'
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
  async getNotifications(homeId?: string, unreadOnly?: boolean) {
    const params = new URLSearchParams();
    if (homeId) params.append('homeId', homeId);
    if (unreadOnly) params.append('unread', 'true');
    const queryString = params.toString() ? `?${params.toString()}` : '';
    return request<{ notifications: NotificationItem[] }>(`/notifications${queryString}`);
  },

  async getUnreadNotificationCount(homeId?: string) {
    const query = homeId ? `?homeId=${encodeURIComponent(homeId)}` : '';
    return request<{ total: number; byHome: Record<string, number> }>(`/notifications/unread-count${query}`);
  },

  async markNotificationRead(id: string) {
    return request<{ success: boolean }>(`/notifications/${encodeURIComponent(id)}/read`, {
      method: 'POST'
    });
  },

  async markNotificationsRead(homeId?: string) {
    return request<{ success: boolean }>('/notifications/read-all', {
      method: 'POST',
      body: JSON.stringify({ homeId })
    });
  },

  async deleteNotification(id: string) {
    return request<{ success: boolean }>(`/notifications/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
  },

  async getNotificationPreferences() {
    return request<{ preferences: NotificationPreferences }>('/notifications/preferences');
  },

  async updateNotificationPreferences(preferences: Partial<NotificationPreferences>) {
    return request<{ preferences: NotificationPreferences }>('/notifications/preferences', {
      method: 'PUT',
      body: JSON.stringify(preferences)
    });
  },

  // Ask Homely Suite
  async askHomely(homeId: string, prompt: string, clientDate?: string) {
    return request<AskHomelyResponse>(`/homes/${homeId}/ask`, {
      method: 'POST',
      body: JSON.stringify({
        prompt,
        clientDate: clientDate || new Date().toISOString()
      })
    });
  },

  async getAskHomelyMessages(homeId: string) {
    return request<{ messages: AskHomelyMessage[] }>(`/homes/${homeId}/ask/messages`);
  },

  async clearAskHomelyMessages(homeId: string) {
    return request<{ success: boolean }>(`/homes/${homeId}/ask/messages`, {
      method: 'DELETE'
    });
  },

  async getAssistantMemories(homeId: string) {
    return request<{ memories: AssistantMemory[] }>(`/homes/${homeId}/ask/memories`);
  },

  async deleteAssistantMemory(homeId: string, memoryId: string) {
    return request<{ success: boolean }>(`/homes/${homeId}/ask/memories/${memoryId}`, {
      method: 'DELETE'
    });
  },

  async confirmAskHomelyAction(homeId: string, action: AskHomelyActionPending, messageId?: string) {
    return request<{
      result: {
        success: boolean;
        type: string;
        message: string;
        item?: any;
        error?: string;
      };
      assistantMessage: AskHomelyMessage;
    }>(`/homes/${homeId}/ask/confirm-action`, {
      method: 'POST',
      body: JSON.stringify({ action, messageId })
    });
  }
};
