export type UserRole = 'owner' | 'admin' | 'member';

export interface User {
  id: string;
  name: string;
  email: string;
  avatar: string;
  createdAt: string;
}

export interface Home {
  id: string;
  name: string;
  description: string;
  avatar: string;
  inviteCode: string;
  ownerId: string;
  createdAt: string;
}

export interface HomeMember {
  id: string;
  userId: string;
  homeId: string;
  role: UserRole;
  joinedAt: string;
  name: string;
  email: string;
  avatar: string;
}

export interface PostComment {
  id: string;
  content: string;
  createdAt: string;
  author: {
    id: string;
    name: string;
    avatar: string;
  };
}

export interface ReactionDetail {
  count: number;
  userIds: string[];
  hasReacted: boolean;
}

export interface Post {
  id: string;
  content: string;
  type: 'update' | 'photo' | 'announcement' | 'memory';
  imageUrl?: string;
  createdAt: string;
  author: {
    id: string;
    name: string;
    avatar: string;
  };
  comments: PostComment[];
  reactions: Record<string, ReactionDetail>;
}

export interface ConversationParticipant {
  id: string;
  name: string;
  avatar: string;
}

export interface Conversation {
  id: string;
  type: 'family' | 'direct';
  homeId: string;
  name: string;
  avatar: string;
  participants: ConversationParticipant[];
  lastMessage: {
    id: string;
    content: string;
    senderId: string;
    createdAt: string;
  } | null;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  content: string;
  replyToId?: string;
  mediaUrl?: string;
  createdAt: string;
  isOwn: boolean;
  sender: {
    id: string;
    name: string;
    avatar: string;
  };
}

export interface FamilyEvent {
  id: string;
  homeId: string;
  creatorId: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location?: string;
  attendeeIds: string[];
  createdAt: string;
  isAttending: boolean;
  creator: {
    id: string;
    name: string;
    avatar: string;
  };
  attendees: {
    id: string;
    name: string;
    avatar: string;
  }[];
}

export interface FamilyMemory {
  id: string;
  homeId: string;
  creatorId: string;
  title: string;
  story: string;
  date: string;
  imageUrl?: string;
  createdAt: string;
  creator: {
    id: string;
    name: string;
    avatar: string;
  };
}

export interface VaultFile {
  id: string;
  homeId: string;
  uploaderId: string;
  title: string;
  category: 'documents' | 'health' | 'home' | 'recipes' | 'other';
  description?: string;
  contentOrUrl: string;
  createdAt: string;
  uploader: {
    id: string;
    name: string;
    avatar: string;
  };
}

export interface NotificationItem {
  id: string;
  homeId: string;
  recipientId: string;
  senderId: string;
  type: 'post' | 'comment' | 'message' | 'event' | 'reaction';
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export type ActiveTab = 'home' | 'chat' | 'ask' | 'family' | 'profile';
