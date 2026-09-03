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
  coverImage?: string;
  icon?: string;
  themeColor?: string;
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
  isOnline?: boolean;
  lastActiveAt?: string;
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
    senderName?: string;
    mediaType?: string;
    createdAt: string;
  } | null;
  unreadCount?: number;
  pinnedCount?: number;
  isOnline?: boolean;
  lastActiveAt?: string;
  updatedAt: string;
}

export interface MessageReactionItem {
  emoji: string;
  count: number;
  users: { id: string; name: string }[];
  userIds: string[];
  hasReacted?: boolean;
}

export interface MessageReplyInfo {
  id: string;
  senderName: string;
  content: string;
  mediaType?: string;
}

export interface PollOption {
  id: string;
  text: string;
  votes: string[]; // userIds
}

export interface MessagePoll {
  id?: string;
  question: string;
  options: PollOption[];
  isMultipleChoice?: boolean;
  closed?: boolean;
}

export type PollData = MessagePoll;

export interface MessageLocation {
  name: string;
  address?: string;
  latitude?: number;
  longitude?: number;
}

export type LocationData = MessageLocation;

export interface Message {
  id: string;
  conversationId: string;
  content: string;
  replyToId?: string;
  replyTo?: MessageReplyInfo;
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
  poll?: MessagePoll;
  location?: MessageLocation;
  createdAt: string;
  isOwn: boolean;
  sender: {
    id: string;
    name: string;
    avatar: string;
    role?: string;
  };
  reactions?: MessageReactionItem[];
  status?: 'sent' | 'delivered' | 'read';
  seenBy?: { id: string; name: string; avatar: string }[];
  readBy?: { userId: string; name: string; avatar: string; readAt: string }[];
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
  creator: {
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

export interface AskHomelyResponse {
  reply: string;
  source?: string;
  actionPending?: AskHomelyActionPending;
  actionResult?: any;
  results?: AskHomelyMessage['results'];
  sources?: AskHomelyMessage['sources'];
  userMessage?: AskHomelyMessage;
  assistantMessage?: AskHomelyMessage;
}

export type ActiveTab = 'home' | 'chat' | 'ask' | 'family' | 'profile';
