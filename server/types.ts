export type UserRole = 'owner' | 'admin' | 'member';

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  salt: string;
  avatar: string;
  createdAt: string;
}

export interface Session {
  token: string;
  userId: string;
  expiresAt: string;
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
  homeId: string;
  userId: string;
  role: UserRole;
  joinedAt: string;
}

export interface Post {
  id: string;
  homeId: string;
  authorId: string;
  content: string;
  type: 'update' | 'photo' | 'announcement' | 'memory';
  imageUrl?: string;
  createdAt: string;
}

export interface PostComment {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  createdAt: string;
}

export interface PostReaction {
  id: string;
  postId: string;
  userId: string;
  emoji: string;
  createdAt: string;
}

export interface Conversation {
  id: string;
  homeId: string;
  type: 'family' | 'direct';
  participantIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  replyToId?: string;
  mediaUrl?: string;
  createdAt: string;
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

export interface DatabaseSchema {
  users: User[];
  sessions: Session[];
  homes: Home[];
  home_members: HomeMember[];
  posts: Post[];
  comments: PostComment[];
  reactions: PostReaction[];
  conversations: Conversation[];
  messages: Message[];
  events: FamilyEvent[];
  memories: FamilyMemory[];
  vault_files: VaultFile[];
  notifications: NotificationItem[];
}
