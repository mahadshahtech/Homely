export type UserRole = 'owner' | 'admin' | 'member';

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  salt: string;
  avatar: string;
  lastActiveAt?: string;
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
  coverImage?: string;
  icon?: string;
  themeColor?: string;
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

export interface MessageReaction {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: string;
}

export interface ConversationRead {
  id: string;
  conversationId: string;
  userId: string;
  lastReadMessageId?: string;
  lastReadAt: string;
}

export interface Message {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  replyToId?: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video' | 'file' | 'voice' | 'location' | 'poll' | 'announcement';
  mediaName?: string;
  mediaSize?: number;
  mediaDuration?: number;
  isPinned?: boolean;
  pinnedAt?: string;
  pinnedBy?: string;
  isEdited?: boolean;
  editedAt?: string;
  extraData?: string;
  createdAt: string;
}

export type EventRsvpStatus = 'going' | 'maybe' | 'declined';

export interface EventRsvpUser {
  userId: string;
  name: string;
  avatar: string;
  email?: string;
  status: EventRsvpStatus;
  updatedAt: string;
}

export interface FamilyEvent {
  id: string;
  homeId: string;
  creatorId: string;
  title: string;
  description: string;
  date: string;
  time: string;
  endTime?: string;
  location?: string;
  attendeeIds: string[];
  reminder?: string;
  createdAt: string;
  updatedAt?: string;
  isAttending?: boolean;
  userRsvp?: EventRsvpStatus;
  creator?: {
    id: string;
    name: string;
    avatar: string;
    email?: string;
  };
  attendees?: {
    id: string;
    name: string;
    avatar: string;
    email?: string;
  }[];
  rsvps?: {
    going: EventRsvpUser[];
    maybe: EventRsvpUser[];
    declined: EventRsvpUser[];
  };
}

export interface MemoryComment {
  id: string;
  memoryId: string;
  authorId: string;
  content: string;
  createdAt: string;
  author: {
    id: string;
    name: string;
    avatar: string;
    email?: string;
  };
}

export interface MemoryReaction {
  id: string;
  memoryId: string;
  userId: string;
  emoji: string;
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
  images?: string[];
  location?: string;
  taggedMemberIds?: string[];
  createdAt: string;
  updatedAt?: string;
  creator?: {
    id: string;
    name: string;
    avatar: string;
    email?: string;
  };
  taggedMembers?: Array<{
    id: string;
    name: string;
    avatar: string;
  }>;
  reactions?: Record<string, { count: number; userIds: string[]; hasReacted: boolean }>;
  comments?: MemoryComment[];
}

export interface VaultFile {
  id: string;
  homeId: string;
  uploaderId: string;
  title: string;
  category: 'documents' | 'health' | 'home' | 'recipes' | 'financial' | 'other';
  description?: string;
  contentOrUrl: string;
  itemType?: 'note' | 'file';
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
  storagePath?: string;
  isEncrypted?: boolean;
  iv?: string;
  authTag?: string;
  createdAt: string;
  updatedAt?: string;
  uploader?: {
    id: string;
    name: string;
    email?: string;
    avatar?: string;
  };
}

export type NotificationType =
  | 'message_dm'
  | 'message_family'
  | 'message_reply'
  | 'message_mention'
  | 'post'
  | 'post_announcement'
  | 'post_reaction'
  | 'comment'
  | 'comment_reply'
  | 'event_created'
  | 'event_updated'
  | 'event_rsvp'
  | 'event_reminder'
  | 'event_starting_soon'
  | 'memory_created'
  | 'memory_reaction'
  | 'memory_comment'
  | 'memory_tagged'
  | 'member_joined'
  | 'member_role_changed'
  | 'home_invite_regenerated'
  | 'ask_homely_action'
  | 'ask_homely_reminder'
  | 'ask_homely_result'
  | 'message'
  | 'event'
  | 'reaction';

export interface NotificationItem {
  id: string;
  homeId: string;
  homeName?: string;
  recipientId: string;
  senderId: string;
  sender?: {
    id: string;
    name: string;
    avatar?: string;
  };
  type: NotificationType;
  title: string;
  body: string;
  targetType?: 'message' | 'conversation' | 'post' | 'comment' | 'event' | 'memory' | 'member' | 'ask';
  targetId?: string;
  metadata?: string;
  read: boolean;
  createdAt: string;
}

export interface NotificationPreferences {
  userId: string;
  messages: boolean;
  feedActivity: boolean;
  events: boolean;
  memories: boolean;
  familyActivity: boolean;
  askHomely: boolean;
  browserPush: boolean;
  updatedAt?: string;
}

export interface PushDeviceSubscription {
  id: string;
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  deviceLabel: string;
  platform: 'web_push' | 'android';
  createdAt: string;
  lastUsedAt: string;
}

export interface PushSubscriptionRegistrationPayload {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  deviceLabel?: string;
  platform?: 'web_push' | 'android';
}

export interface AssistantMemory {
  id: string;
  homeId: string;
  creatorId: string;
  key: string;
  content: string;
  category?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AskHomelyActionPending {
  id: string;
  type: 'create_event' | 'update_event' | 'create_post' | 'create_announcement' | 'send_family_message' | 'create_family_memory' | 'save_assistant_memory' | 'delete_assistant_memory';
  title: string;
  description: string;
  payload: any;
}

export interface AskHomelyMessage {
  id: string;
  homeId: string;
  userId: string;
  role: 'user' | 'assistant';
  content: string;
  source?: string;
  actionPending?: AskHomelyActionPending;
  actionResult?: {
    type: string;
    success: boolean;
    message: string;
    item?: any;
  };
  results?: Array<{
    type: 'event' | 'post' | 'announcement' | 'memory' | 'vault' | 'assistant_memory' | 'member';
    title: string;
    subtitle?: string;
    details?: string;
    data?: any;
  }>;
  sources?: Array<{
    type: string;
    title: string;
    detail?: string;
  }>;
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
  assistant_memories?: AssistantMemory[];
  ask_homely_messages?: AskHomelyMessage[];
}
