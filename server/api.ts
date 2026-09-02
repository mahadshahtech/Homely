import express, { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import {
  db,
  getUserByEmail,
  getUserById,
  getUserByToken,
  createSession,
  removeSession,
  hashPassword,
  verifyPassword,
  generateInviteCode,
  isUserInHome,
  getUserRoleInHome,
  getUserHomes,
  getHomeById,
  getHomeMembers
} from './db';
import type {
  User,
  Home,
  HomeMember,
  Post,
  PostComment,
  PostReaction,
  Conversation,
  Message,
  FamilyEvent,
  FamilyMemory,
  VaultFile,
  NotificationItem
} from './types';

export const apiRouter = express.Router();
apiRouter.use(express.json());

// Extend express request with authenticated user
interface AuthRequest extends Request {
  user?: User;
}

// Authentication middleware
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }
  const token = authHeader.split(' ')[1];
  const user = getUserByToken(token);
  if (!user) {
    res.status(401).json({ error: 'Invalid or expired session' });
    return;
  }
  req.user = user;
  next();
}

// Helper to return sanitized user object (no passwordHash or salt)
function sanitizeUser(user: User) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatar: user.avatar,
    createdAt: user.createdAt
  };
}

// Helper for home authorization
function requireHomeMembership(req: AuthRequest, res: Response, homeId: string): boolean {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  if (!isUserInHome(req.user.id, homeId)) {
    res.status(403).json({ error: 'Access denied: You are not a member of this Home' });
    return false;
  }
  return true;
}

// -------------------------------------------------------------
// AUTH ROUTES
// -------------------------------------------------------------

apiRouter.post('/auth/register', (req: Request, res: Response) => {
  const { name, email, password, avatar } = req.body;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    res.status(400).json({ error: 'Full name is required' });
    return;
  }
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    res.status(400).json({ error: 'Valid email address is required' });
    return;
  }
  if (!password || typeof password !== 'string' || password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' });
    return;
  }

  const existing = getUserByEmail(email);
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists' });
    return;
  }

  const { hash, salt } = hashPassword(password);
  const defaultAvatar = avatar || `https://api.dicebear.com/7.x/adventurer-neutral/svg?seed=${encodeURIComponent(name.trim())}&backgroundColor=ede9fe,e0e7ff`;

  const newUser: User = {
    id: `u_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`,
    name: name.trim(),
    email: email.trim().toLowerCase(),
    passwordHash: hash,
    salt,
    avatar: defaultAvatar,
    createdAt: new Date().toISOString()
  };

  db.data.users.push(newUser);
  db.save();

  const session = createSession(newUser.id);

  res.status(201).json({
    user: sanitizeUser(newUser),
    token: session.token
  });
});

apiRouter.post('/auth/login', (req: Request, res: Response) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  const user = getUserByEmail(email);
  if (!user) {
    res.status(401).json({ error: 'Incorrect email or password' });
    return;
  }

  const valid = verifyPassword(password, user.passwordHash, user.salt);
  if (!valid) {
    res.status(401).json({ error: 'Incorrect email or password' });
    return;
  }

  const session = createSession(user.id);

  res.json({
    user: sanitizeUser(user),
    token: session.token
  });
});

apiRouter.get('/auth/me', requireAuth, (req: AuthRequest, res: Response) => {
  res.json({ user: sanitizeUser(req.user!) });
});

apiRouter.post('/auth/logout', (req: Request, res: Response) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    removeSession(token);
  }
  res.json({ success: true });
});

apiRouter.put('/auth/profile', requireAuth, (req: AuthRequest, res: Response) => {
  const { name, avatar } = req.body;
  const user = req.user!;

  if (name && typeof name === 'string' && name.trim().length > 0) {
    user.name = name.trim();
  }
  if (avatar && typeof avatar === 'string') {
    user.avatar = avatar.trim();
  }

  db.save();
  res.json({ user: sanitizeUser(user) });
});

// -------------------------------------------------------------
// HOMES & MEMBERSHIP
// -------------------------------------------------------------

apiRouter.get('/homes', requireAuth, (req: AuthRequest, res: Response) => {
  const homes = getUserHomes(req.user!.id);
  res.json({ homes });
});

apiRouter.post('/homes', requireAuth, (req: AuthRequest, res: Response) => {
  const { name, description, avatar } = req.body;
  const user = req.user!;

  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    res.status(400).json({ error: 'Home name is required (e.g. Shah Family)' });
    return;
  }

  const homeId = `h_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const inviteCode = generateInviteCode(name.trim());
  const defaultAvatar = avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${encodeURIComponent(name.trim())}&backgroundColor=e0e7ff`;

  const newHome: Home = {
    id: homeId,
    name: name.trim(),
    description: description ? description.trim() : 'Our private family space',
    avatar: defaultAvatar,
    inviteCode,
    ownerId: user.id,
    createdAt: new Date().toISOString()
  };

  db.data.homes.push(newHome);

  // Add creator as owner
  const membership: HomeMember = {
    id: `hm_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    homeId,
    userId: user.id,
    role: 'owner',
    joinedAt: new Date().toISOString()
  };
  db.data.home_members.push(membership);

  // Create default Family Chat
  const familyChat: Conversation = {
    id: `conv_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    homeId,
    type: 'family',
    participantIds: [user.id],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  db.data.conversations.push(familyChat);

  // Initial welcome message
  const welcomeMsg: Message = {
    id: `m_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    conversationId: familyChat.id,
    senderId: user.id,
    content: `Welcome to our private family space in HOMELY! Invite family members using code: ${inviteCode}`,
    createdAt: new Date().toISOString()
  };
  db.data.messages.push(welcomeMsg);

  db.save();

  res.status(201).json({
    home: newHome,
    role: 'owner'
  });
});

apiRouter.post('/homes/join', requireAuth, (req: AuthRequest, res: Response) => {
  const { inviteCode } = req.body;
  const user = req.user!;

  if (!inviteCode || typeof inviteCode !== 'string') {
    res.status(400).json({ error: 'Invite code is required' });
    return;
  }

  const codeClean = inviteCode.trim().toUpperCase();
  const home = db.data.homes.find(h => h.inviteCode.toUpperCase() === codeClean);

  if (!home) {
    res.status(404).json({ error: 'No family Home found with this invitation code' });
    return;
  }

  if (isUserInHome(user.id, home.id)) {
    res.status(400).json({ error: 'You are already a member of this Home', homeId: home.id });
    return;
  }

  const membership: HomeMember = {
    id: `hm_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    homeId: home.id,
    userId: user.id,
    role: 'member',
    joinedAt: new Date().toISOString()
  };
  db.data.home_members.push(membership);

  // Ensure user is added to family conversation participantIds
  const familyChat = db.data.conversations.find(c => c.homeId === home.id && c.type === 'family');
  if (familyChat && !familyChat.participantIds.includes(user.id)) {
    familyChat.participantIds.push(user.id);
  }

  // Add join notification
  const notif: NotificationItem = {
    id: `n_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    homeId: home.id,
    recipientId: home.ownerId,
    senderId: user.id,
    type: 'message',
    title: 'New Family Member',
    body: `${user.name} has joined ${home.name}!`,
    read: false,
    createdAt: new Date().toISOString()
  };
  db.data.notifications.push(notif);

  db.save();

  res.json({
    home,
    role: 'member'
  });
});

apiRouter.get('/homes/:homeId', requireAuth, (req: AuthRequest, res: Response) => {
  const { homeId } = req.params;
  if (!requireHomeMembership(req, res, homeId)) return;

  const home = getHomeById(homeId);
  if (!home) {
    res.status(404).json({ error: 'Home not found' });
    return;
  }

  const role = getUserRoleInHome(req.user!.id, homeId);
  res.json({ home, role });
});

apiRouter.get('/homes/:homeId/members', requireAuth, (req: AuthRequest, res: Response) => {
  const { homeId } = req.params;
  if (!requireHomeMembership(req, res, homeId)) return;

  const members = getHomeMembers(homeId);
  res.json({ members });
});

// -------------------------------------------------------------
// POSTS & FEED
// -------------------------------------------------------------

apiRouter.get('/homes/:homeId/posts', requireAuth, (req: AuthRequest, res: Response) => {
  const { homeId } = req.params;
  if (!requireHomeMembership(req, res, homeId)) return;

  const posts = db.data.posts
    .filter(p => p.homeId === homeId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map(p => {
      const author = getUserById(p.authorId);
      const postComments = db.data.comments
        .filter(c => c.postId === p.id)
        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
        .map(c => {
          const cAuthor = getUserById(c.authorId);
          return {
            id: c.id,
            content: c.content,
            createdAt: c.createdAt,
            author: cAuthor ? sanitizeUser(cAuthor) : { id: c.authorId, name: 'Family Member', avatar: '' }
          };
        });

      const postReactions = db.data.reactions.filter(r => r.postId === p.id);
      // Group reactions by emoji
      const reactionCounts: Record<string, { count: number; userIds: string[]; hasReacted: boolean }> = {};
      postReactions.forEach(r => {
        if (!reactionCounts[r.emoji]) {
          reactionCounts[r.emoji] = { count: 0, userIds: [], hasReacted: false };
        }
        reactionCounts[r.emoji].count += 1;
        reactionCounts[r.emoji].userIds.push(r.userId);
        if (r.userId === req.user!.id) {
          reactionCounts[r.emoji].hasReacted = true;
        }
      });

      return {
        id: p.id,
        content: p.content,
        type: p.type,
        imageUrl: p.imageUrl,
        createdAt: p.createdAt,
        author: author ? sanitizeUser(author) : { id: p.authorId, name: 'Family Member', avatar: '' },
        comments: postComments,
        reactions: reactionCounts
      };
    });

  res.json({ posts });
});

apiRouter.post('/homes/:homeId/posts', requireAuth, (req: AuthRequest, res: Response) => {
  const { homeId } = req.params;
  if (!requireHomeMembership(req, res, homeId)) return;

  const { content, type, imageUrl } = req.body;
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    res.status(400).json({ error: 'Post content cannot be empty' });
    return;
  }

  const postType = ['update', 'photo', 'announcement', 'memory'].includes(type) ? type : 'update';

  const newPost: Post = {
    id: `post_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    homeId,
    authorId: req.user!.id,
    content: content.trim(),
    type: postType,
    imageUrl: imageUrl ? imageUrl.trim() : undefined,
    createdAt: new Date().toISOString()
  };

  db.data.posts.unshift(newPost);

  // Notify other members
  const members = db.data.home_members.filter(m => m.homeId === homeId && m.userId !== req.user!.id);
  members.forEach(m => {
    db.data.notifications.push({
      id: `n_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      homeId,
      recipientId: m.userId,
      senderId: req.user!.id,
      type: 'post',
      title: `${req.user!.name} shared a new ${postType}`,
      body: content.slice(0, 80),
      read: false,
      createdAt: new Date().toISOString()
    });
  });

  db.save();

  res.status(201).json({
    post: {
      ...newPost,
      author: sanitizeUser(req.user!),
      comments: [],
      reactions: {}
    }
  });
});

apiRouter.post(['/homes/:homeId/posts/:postId/reactions', '/homes/:homeId/posts/:postId/react'], requireAuth, (req: AuthRequest, res: Response) => {
  const { homeId, postId } = req.params;
  if (!requireHomeMembership(req, res, homeId)) return;

  const { emoji } = req.body;
  if (!emoji || typeof emoji !== 'string') {
    res.status(400).json({ error: 'Emoji is required' });
    return;
  }

  const existingIdx = db.data.reactions.findIndex(r => r.postId === postId && r.userId === req.user!.id && r.emoji === emoji);

  if (existingIdx >= 0) {
    // Toggle off
    db.data.reactions.splice(existingIdx, 1);
  } else {
    // Add reaction
    db.data.reactions.push({
      id: `rx_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      postId,
      userId: req.user!.id,
      emoji,
      createdAt: new Date().toISOString()
    });
  }

  db.save();
  res.json({ success: true });
});

apiRouter.post('/homes/:homeId/posts/:postId/comments', requireAuth, (req: AuthRequest, res: Response) => {
  const { homeId, postId } = req.params;
  if (!requireHomeMembership(req, res, homeId)) return;

  const { content } = req.body;
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    res.status(400).json({ error: 'Comment cannot be empty' });
    return;
  }

  const post = db.data.posts.find(p => p.id === postId && p.homeId === homeId);
  if (!post) {
    res.status(404).json({ error: 'Post not found' });
    return;
  }

  const newComment: PostComment = {
    id: `c_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    postId,
    authorId: req.user!.id,
    content: content.trim(),
    createdAt: new Date().toISOString()
  };

  db.data.comments.push(newComment);

  // Notify post author if not self
  if (post.authorId !== req.user!.id) {
    db.data.notifications.push({
      id: `n_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      homeId,
      recipientId: post.authorId,
      senderId: req.user!.id,
      type: 'comment',
      title: `${req.user!.name} commented on your post`,
      body: content.slice(0, 80),
      read: false,
      createdAt: new Date().toISOString()
    });
  }

  db.save();

  res.status(201).json({
    comment: {
      id: newComment.id,
      content: newComment.content,
      createdAt: newComment.createdAt,
      author: sanitizeUser(req.user!)
    }
  });
});

apiRouter.delete('/homes/:homeId/posts/:postId', requireAuth, (req: AuthRequest, res: Response) => {
  const { homeId, postId } = req.params;
  if (!requireHomeMembership(req, res, homeId)) return;

  const post = db.data.posts.find(p => p.id === postId && p.homeId === homeId);
  if (!post) {
    res.status(404).json({ error: 'Post not found' });
    return;
  }

  const userRole = getUserRoleInHome(req.user!.id, homeId);
  const isAuthor = post.authorId === req.user!.id;
  const isOwnerOrAdmin = userRole === 'owner' || userRole === 'admin';

  if (!isAuthor && !isOwnerOrAdmin) {
    res.status(403).json({ error: 'You do not have permission to delete this post' });
    return;
  }

  db.data.posts = db.data.posts.filter(p => p.id !== postId);
  db.data.comments = db.data.comments.filter(c => c.postId !== postId);
  db.data.reactions = db.data.reactions.filter(r => r.postId !== postId);
  db.save();

  res.json({ success: true });
});

// -------------------------------------------------------------
// CHAT & CONVERSATIONS
// -------------------------------------------------------------

apiRouter.get('/homes/:homeId/conversations', requireAuth, (req: AuthRequest, res: Response) => {
  const { homeId } = req.params;
  if (!requireHomeMembership(req, res, homeId)) return;

  const userId = req.user!.id;
  let conversations = db.data.conversations.filter(c => c.homeId === homeId && c.participantIds.includes(userId));

  // Ensure family conversation always exists and has the user
  let familyChat = conversations.find(c => c.type === 'family');
  if (!familyChat) {
    const existingFamily = db.data.conversations.find(c => c.homeId === homeId && c.type === 'family');
    if (existingFamily) {
      if (!existingFamily.participantIds.includes(userId)) {
        existingFamily.participantIds.push(userId);
        db.save();
      }
      familyChat = existingFamily;
      conversations.push(familyChat);
    } else {
      familyChat = {
        id: `conv_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
        homeId,
        type: 'family',
        participantIds: getHomeMembers(homeId).map(m => m.userId),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      db.data.conversations.push(familyChat);
      db.save();
      conversations.push(familyChat);
    }
  }

  const populated = conversations.map(c => {
    const lastMsg = db.data.messages
      .filter(m => m.conversationId === c.id)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];

    const participants = c.participantIds.map(pId => {
      const u = getUserById(pId);
      return u ? sanitizeUser(u) : { id: pId, name: 'Family Member', avatar: '' };
    });

    const otherParticipant = c.type === 'direct' ? participants.find(p => p.id !== userId) : null;

    return {
      id: c.id,
      type: c.type,
      homeId: c.homeId,
      name: c.type === 'family' ? 'Family Living Room' : (otherParticipant?.name || 'Direct Chat'),
      avatar: c.type === 'family' ? '' : (otherParticipant?.avatar || ''),
      participants,
      lastMessage: lastMsg ? {
        id: lastMsg.id,
        content: lastMsg.content,
        senderId: lastMsg.senderId,
        createdAt: lastMsg.createdAt
      } : null,
      updatedAt: c.updatedAt
    };
  });

  res.json({ conversations: populated });
});

apiRouter.post('/homes/:homeId/conversations/direct', requireAuth, (req: AuthRequest, res: Response) => {
  const { homeId } = req.params;
  if (!requireHomeMembership(req, res, homeId)) return;

  const { targetUserId } = req.body;
  const currentUserId = req.user!.id;

  if (!targetUserId || targetUserId === currentUserId) {
    res.status(400).json({ error: 'Valid target family member is required' });
    return;
  }

  if (!isUserInHome(targetUserId, homeId)) {
    res.status(404).json({ error: 'Target member is not in this family' });
    return;
  }

  let directConv = db.data.conversations.find(c => 
    c.homeId === homeId && 
    c.type === 'direct' && 
    c.participantIds.includes(currentUserId) && 
    c.participantIds.includes(targetUserId)
  );

  if (!directConv) {
    directConv = {
      id: `conv_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      homeId,
      type: 'direct',
      participantIds: [currentUserId, targetUserId],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.data.conversations.push(directConv);
    db.save();
  }

  res.json({ conversation: directConv });
});

apiRouter.get('/homes/:homeId/conversations/:conversationId/messages', requireAuth, (req: AuthRequest, res: Response) => {
  const { homeId, conversationId } = req.params;
  if (!requireHomeMembership(req, res, homeId)) return;

  const conversation = db.data.conversations.find(c => c.id === conversationId && c.homeId === homeId);
  if (!conversation) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }

  if (!conversation.participantIds.includes(req.user!.id)) {
    res.status(403).json({ error: 'Access denied to this conversation' });
    return;
  }

  const messages = db.data.messages
    .filter(m => m.conversationId === conversationId)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
    .map(m => {
      const sender = getUserById(m.senderId);
      return {
        id: m.id,
        conversationId: m.conversationId,
        content: m.content,
        replyToId: m.replyToId,
        mediaUrl: m.mediaUrl,
        createdAt: m.createdAt,
        isOwn: m.senderId === req.user!.id,
        sender: sender ? sanitizeUser(sender) : { id: m.senderId, name: 'Family Member', avatar: '' }
      };
    });

  res.json({ messages });
});

apiRouter.post('/homes/:homeId/conversations/:conversationId/messages', requireAuth, (req: AuthRequest, res: Response) => {
  const { homeId, conversationId } = req.params;
  if (!requireHomeMembership(req, res, homeId)) return;

  const conversation = db.data.conversations.find(c => c.id === conversationId && c.homeId === homeId);
  if (!conversation) {
    res.status(404).json({ error: 'Conversation not found' });
    return;
  }

  if (!conversation.participantIds.includes(req.user!.id)) {
    res.status(403).json({ error: 'Access denied to this conversation' });
    return;
  }

  const { content, replyToId, mediaUrl } = req.body;
  if (!content || typeof content !== 'string' || content.trim().length === 0) {
    res.status(400).json({ error: 'Message content cannot be empty' });
    return;
  }

  const newMsg: Message = {
    id: `m_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    conversationId,
    senderId: req.user!.id,
    content: content.trim(),
    replyToId: replyToId || undefined,
    mediaUrl: mediaUrl || undefined,
    createdAt: new Date().toISOString()
  };

  db.data.messages.push(newMsg);
  conversation.updatedAt = newMsg.createdAt;

  // Create notifications for other participants
  conversation.participantIds.forEach(pId => {
    if (pId !== req.user!.id) {
      db.data.notifications.push({
        id: `n_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
        homeId,
        recipientId: pId,
        senderId: req.user!.id,
        type: 'message',
        title: `Message from ${req.user!.name}`,
        body: content.slice(0, 70),
        read: false,
        createdAt: new Date().toISOString()
      });
    }
  });

  db.save();

  res.status(201).json({
    message: {
      ...newMsg,
      isOwn: true,
      sender: sanitizeUser(req.user!)
    }
  });
});

// -------------------------------------------------------------
// EVENTS
// -------------------------------------------------------------

apiRouter.get('/homes/:homeId/events', requireAuth, (req: AuthRequest, res: Response) => {
  const { homeId } = req.params;
  if (!requireHomeMembership(req, res, homeId)) return;

  const events = db.data.events
    .filter(e => e.homeId === homeId)
    .sort((a, b) => new Date(`${a.date}T${a.time || '00:00'}`).getTime() - new Date(`${b.date}T${b.time || '00:00'}`).getTime())
    .map(e => {
      const creator = getUserById(e.creatorId);
      const attendees = e.attendeeIds.map(id => {
        const u = getUserById(id);
        return u ? sanitizeUser(u) : { id, name: 'Member', avatar: '' };
      });
      return {
        ...e,
        isAttending: e.attendeeIds.includes(req.user!.id),
        creator: creator ? sanitizeUser(creator) : { id: e.creatorId, name: 'Family Member', avatar: '' },
        attendees
      };
    });

  res.json({ events });
});

apiRouter.post('/homes/:homeId/events', requireAuth, (req: AuthRequest, res: Response) => {
  const { homeId } = req.params;
  if (!requireHomeMembership(req, res, homeId)) return;

  const { title, description, date, time, location } = req.body;
  if (!title || !date) {
    res.status(400).json({ error: 'Title and date are required' });
    return;
  }

  const newEvent: FamilyEvent = {
    id: `ev_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    homeId,
    creatorId: req.user!.id,
    title: title.trim(),
    description: description ? description.trim() : '',
    date,
    time: time || '18:00',
    location: location ? location.trim() : undefined,
    attendeeIds: [req.user!.id],
    createdAt: new Date().toISOString()
  };

  db.data.events.push(newEvent);

  // Notify members
  const members = db.data.home_members.filter(m => m.homeId === homeId && m.userId !== req.user!.id);
  members.forEach(m => {
    db.data.notifications.push({
      id: `n_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      homeId,
      recipientId: m.userId,
      senderId: req.user!.id,
      type: 'event',
      title: 'New Family Event',
      body: `${req.user!.name} scheduled "${newEvent.title}" on ${date}`,
      read: false,
      createdAt: new Date().toISOString()
    });
  });

  db.save();

  res.status(201).json({ event: newEvent });
});

apiRouter.post('/homes/:homeId/events/:eventId/rsvp', requireAuth, (req: AuthRequest, res: Response) => {
  const { homeId, eventId } = req.params;
  if (!requireHomeMembership(req, res, homeId)) return;

  const event = db.data.events.find(e => e.id === eventId && e.homeId === homeId);
  if (!event) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }

  const userId = req.user!.id;
  const idx = event.attendeeIds.indexOf(userId);
  if (idx >= 0) {
    event.attendeeIds.splice(idx, 1);
  } else {
    event.attendeeIds.push(userId);
  }

  db.save();
  res.json({ success: true, isAttending: event.attendeeIds.includes(userId), attendeeCount: event.attendeeIds.length });
});

apiRouter.delete('/homes/:homeId/events/:eventId', requireAuth, (req: AuthRequest, res: Response) => {
  const { homeId, eventId } = req.params;
  if (!requireHomeMembership(req, res, homeId)) return;

  const event = db.data.events.find(e => e.id === eventId && e.homeId === homeId);
  if (!event) {
    res.status(404).json({ error: 'Event not found' });
    return;
  }

  const userRole = getUserRoleInHome(req.user!.id, homeId);
  if (event.creatorId !== req.user!.id && userRole !== 'owner' && userRole !== 'admin') {
    res.status(403).json({ error: 'Permission denied' });
    return;
  }

  db.data.events = db.data.events.filter(e => e.id !== eventId);
  db.save();
  res.json({ success: true });
});

// -------------------------------------------------------------
// MEMORIES
// -------------------------------------------------------------

apiRouter.get('/homes/:homeId/memories', requireAuth, (req: AuthRequest, res: Response) => {
  const { homeId } = req.params;
  if (!requireHomeMembership(req, res, homeId)) return;

  const memories = db.data.memories
    .filter(m => m.homeId === homeId)
    .sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime())
    .map(m => {
      const creator = getUserById(m.creatorId);
      return {
        ...m,
        creator: creator ? sanitizeUser(creator) : { id: m.creatorId, name: 'Family Member', avatar: '' }
      };
    });

  res.json({ memories });
});

apiRouter.post('/homes/:homeId/memories', requireAuth, (req: AuthRequest, res: Response) => {
  const { homeId } = req.params;
  if (!requireHomeMembership(req, res, homeId)) return;

  const { title, story, date, imageUrl } = req.body;
  if (!title || !story) {
    res.status(400).json({ error: 'Title and story are required' });
    return;
  }

  const newMemory: FamilyMemory = {
    id: `mem_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    homeId,
    creatorId: req.user!.id,
    title: title.trim(),
    story: story.trim(),
    date: date || new Date().toISOString().split('T')[0],
    imageUrl: imageUrl ? imageUrl.trim() : undefined,
    createdAt: new Date().toISOString()
  };

  db.data.memories.unshift(newMemory);
  db.save();

  res.status(201).json({ memory: newMemory });
});

// -------------------------------------------------------------
// VAULT / SHARED FILES
// -------------------------------------------------------------

apiRouter.get('/homes/:homeId/vault', requireAuth, (req: AuthRequest, res: Response) => {
  const { homeId } = req.params;
  if (!requireHomeMembership(req, res, homeId)) return;

  const files = db.data.vault_files
    .filter(f => f.homeId === homeId)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .map(f => {
      const uploader = getUserById(f.uploaderId);
      return {
        ...f,
        uploader: uploader ? sanitizeUser(uploader) : { id: f.uploaderId, name: 'Family Member', avatar: '' }
      };
    });

  res.json({ files });
});

apiRouter.post('/homes/:homeId/vault', requireAuth, (req: AuthRequest, res: Response) => {
  const { homeId } = req.params;
  if (!requireHomeMembership(req, res, homeId)) return;

  const { title, category, description, contentOrUrl } = req.body;
  if (!title || !contentOrUrl) {
    res.status(400).json({ error: 'Title and content/link are required' });
    return;
  }

  const validCategory = ['documents', 'health', 'home', 'recipes', 'other'].includes(category) ? category : 'documents';

  const newFile: VaultFile = {
    id: `vf_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
    homeId,
    uploaderId: req.user!.id,
    title: title.trim(),
    category: validCategory,
    description: description ? description.trim() : '',
    contentOrUrl: contentOrUrl.trim(),
    createdAt: new Date().toISOString()
  };

  db.data.vault_files.unshift(newFile);
  db.save();

  res.status(201).json({ file: newFile });
});

// -------------------------------------------------------------
// NOTIFICATIONS
// -------------------------------------------------------------

apiRouter.get('/homes/:homeId/notifications', requireAuth, (req: AuthRequest, res: Response) => {
  const { homeId } = req.params;
  if (!requireHomeMembership(req, res, homeId)) return;

  const notifs = db.data.notifications
    .filter(n => n.homeId === homeId && n.recipientId === req.user!.id)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 30);

  res.json({ notifications: notifs });
});

apiRouter.post('/homes/:homeId/notifications/read-all', requireAuth, (req: AuthRequest, res: Response) => {
  const { homeId } = req.params;
  if (!requireHomeMembership(req, res, homeId)) return;

  db.data.notifications.forEach(n => {
    if (n.homeId === homeId && n.recipientId === req.user!.id) {
      n.read = true;
    }
  });

  db.save();
  res.json({ success: true });
});

// -------------------------------------------------------------
// ASK HOMELY - FAMILY AI ASSISTANT
// -------------------------------------------------------------

let geminiAi: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI | null {
  if (!geminiAi && process.env.GEMINI_API_KEY) {
    geminiAi = new GoogleGenAI({});
  }
  return geminiAi;
}

apiRouter.post(['/homes/:homeId/ask', '/homes/:homeId/ask-homely'], requireAuth, async (req: AuthRequest, res: Response) => {
  const { homeId } = req.params;
  if (!requireHomeMembership(req, res, homeId)) return;

  const { prompt } = req.body;
  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    res.status(400).json({ error: 'Question or instruction cannot be empty' });
    return;
  }

  const user = req.user!;
  const home = getHomeById(homeId);
  const members = getHomeMembers(homeId);
  const posts = db.data.posts.filter(p => p.homeId === homeId).slice(0, 10);
  const events = db.data.events.filter(e => e.homeId === homeId);
  const memories = db.data.memories.filter(m => m.homeId === homeId).slice(0, 5);
  const vaultFiles = db.data.vault_files.filter(f => f.homeId === homeId).slice(0, 8);

  // Assemble safe private family context
  const familyContext = `
Family Space: "${home?.name || 'Home'}"
Family Members: ${members.map(m => `${m.name} (${m.role})`).join(', ')}
Current User Asking: ${user.name}

Upcoming Events:
${events.length === 0 ? 'None scheduled' : events.map(e => `- "${e.title}" on ${e.date} at ${e.time} (Location: ${e.location || 'Home'}). Attendees: ${e.attendeeIds.length} members`).join('\n')}

Recent Family Posts:
${posts.length === 0 ? 'No posts yet' : posts.map(p => {
  const author = getUserById(p.authorId)?.name || 'Family Member';
  return `- ${author}: "${p.content}" (${p.type})`;
}).join('\n')}

Family Memories:
${memories.length === 0 ? 'No memories recorded yet' : memories.map(m => `- "${m.title}": ${m.story}`).join('\n')}

Family Vault & Notes:
${vaultFiles.length === 0 ? 'No vault items yet' : vaultFiles.map(f => `- [${f.category}] "${f.title}": ${f.description || ''} (${f.contentOrUrl})`).join('\n')}
`;

  try {
    const ai = getGeminiClient();
    if (ai) {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: `You are "Ask Homely", a caring, warm, respectful, and helpful family AI assistant living inside the private HOMELY family space called "${home?.name}".
Your purpose is to help this family organize their life, remember important details, coordinate events, and answer questions based strictly on the family's shared info.
Keep your tone warm, personal, and encouraging — never corporate or robotic.
If asked to take an action (like drafting an announcement or proposing an event), provide a clear, ready-to-use draft and explain that the user can confirm and post it.

Context about this Family Home:
${familyContext}

User Query:
${prompt.trim()}
`
              }
            ]
          }
        ]
      });

      const reply = response.text || "I'm right here with your family! Let me know how I can help coordinate your day or find family info.";
      res.json({ reply, source: 'ai' });
      return;
    }
  } catch (err: any) {
    console.warn('Gemini API call failed or not configured, using smart family assistant logic:', err?.message);
  }

  // Fallback intelligent responder based on actual family context
  const q = prompt.toLowerCase();
  let fallbackReply = '';

  if (q.includes('key') || q.includes('spare') || q.includes('wifi') || q.includes('code') || q.includes('vault')) {
    const matchingFiles = vaultFiles.filter(f => 
      f.title.toLowerCase().includes('key') || 
      f.title.toLowerCase().includes('wifi') || 
      (f.description && f.description.toLowerCase().includes('key'))
    );
    if (matchingFiles.length > 0) {
      fallbackReply = `Here is what I found in your Family Vault:\n${matchingFiles.map(f => `• **${f.title}**: ${f.description ? f.description + ' - ' : ''}${f.contentOrUrl}`).join('\n')}`;
    } else {
      fallbackReply = `I checked the **Family Vault**, but there are no notes about keys or codes yet. You can add one anytime in **Family > Vault**!`;
    }
  } else if (q.includes('event') || q.includes('calendar') || q.includes('schedule') || q.includes('tomorrow') || q.includes('when')) {
    if (events.length > 0) {
      fallbackReply = `Here are the upcoming events for **${home?.name}**:\n${events.map(e => `• **${e.title}** on ${e.date} at ${e.time}${e.location ? ` at ${e.location}` : ''} (${e.attendeeIds.length} attending)`).join('\n')}`;
    } else {
      fallbackReply = `There are currently no events on the calendar for **${home?.name}**. You can add family dinners, birthdays, or trips in the **Family > Events** section!`;
    }
  } else if (q.includes('member') || q.includes('who is in') || q.includes('family')) {
    fallbackReply = `**${home?.name}** currently has ${members.length} members:\n${members.map(m => `• **${m.name}** (${m.role})`).join('\n')}\n\nYou can invite more family members with invite code: **${home?.inviteCode}**`;
  } else if (q.includes('post') || q.includes('dad') || q.includes('mom') || q.includes('recent') || q.includes('update')) {
    if (posts.length > 0) {
      fallbackReply = `Here are the latest posts from your family feed:\n${posts.slice(0, 3).map(p => {
        const author = getUserById(p.authorId)?.name || 'Family Member';
        return `• **${author}**: "${p.content}"`;
      }).join('\n')}`;
    } else {
      fallbackReply = `No one has shared a post on the family feed yet. Be the first to share an update or photo on the Home screen!`;
    }
  } else if (q.includes('create') || q.includes('remind') || q.includes('dinner') || q.includes('draft')) {
    fallbackReply = `I'd love to help! Here is a draft for your family:\n\n> 📢 *"Hey family, quick reminder about our plans! Let's get together and enjoy some time."*\n\nYou can copy this to your **Family Chat** or post it directly to the **Home Feed**!`;
  } else {
    fallbackReply = `Hello ${user.name}! I'm **Ask Homely**, your family assistant for **${home?.name}**.\n\nI can help you search family notes & vault codes, check upcoming events, summarize recent family posts, or draft announcements. How can I help today?`;
  }

  res.json({ reply: fallbackReply, source: 'family-assistant' });
});
