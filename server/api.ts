import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { GoogleGenAI } from '@google/genai';
import {
  getUserByEmail,
  getUserById,
  getUserByToken,
  createUser,
  updateUserProfile,
  createSession,
  removeSession,
  hashPassword,
  verifyPassword,
  generateInviteCode,
  isUserInHome,
  getUserRoleInHome,
  getUserHomes,
  getHomeById,
  getHomeByInviteCode,
  getHomeMembers,
  createHome,
  updateHome,
  regenerateHomeInviteCode,
  updateHomeMemberRole,
  removeHomeMember,
  getHomeDashboardData,
  addHomeMember,
  getPostsForHome,
  createPost,
  getPostById,
  getPostCommentAuthorIds,
  deletePost,
  toggleReaction,
  createComment,
  getConversationsForUser,
  findDirectConversation,
  createConversation,
  getConversationById,
  getMessages,
  getMessageById,
  createMessage,
  updateMessage,
  deleteMessage,
  toggleMessageReaction,
  togglePinMessage,
  getPinnedMessages,
  searchMessages,
  votePoll,
  updateUserHeartbeat,
  getEvents,
  getEventById,
  createEvent,
  toggleEventRsvp,
  deleteEvent,
  getMemories,
  createMemory,
  getVaultFiles,
  createVaultFile,
  getNotifications,
  getUnreadNotificationCount,
  createNotification,
  markNotificationAsRead,
  markNotificationsAsRead,
  deleteNotification,
  getUserNotificationPreferences,
  updateUserNotificationPreferences,
  checkAndGenerateEventReminders,
  getHomeAiContext,
  getAskHomelyMessages,
  saveAskHomelyMessage,
  clearAskHomelyHistory,
  updateAskHomelyMessageAction,
  getAssistantMemories,
  deleteAssistantMemoryById,
  deleteAssistantMemory
} from './db.ts';
import { processAssistantQuery, executeAssistantAction } from './assistantEngine.ts';
import type {
  User,
  Home,
  HomeMember,
  Post,
  PostComment,
  Conversation,
  Message,
  FamilyEvent,
  FamilyMemory,
  VaultFile,
  NotificationItem,
  NotificationType,
  AskHomelyMessage,
  AskHomelyActionPending,
  AssistantMemory
} from './types.ts';

// Ensure uploads directory exists
const UPLOADS_DIR = path.resolve(process.cwd(), 'data', 'uploads');
try {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
} catch {
  // directory already exists or error
}

export const apiRouter = express.Router();
apiRouter.use(express.json({ limit: '25mb' }));
apiRouter.use(express.urlencoded({ extended: true, limit: '25mb' }));

// Static media uploads endpoint
apiRouter.get('/uploads/:fileId', (req: Request, res: Response) => {
  const safeFilename = path.basename(req.params.fileId);
  const filePath = path.join(UPLOADS_DIR, safeFilename);

  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'File not found' });
    return;
  }

  // Determine mime-type by extension
  const ext = path.extname(safeFilename).toLowerCase();
  const mimeTypes: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm',
    '.ogg': 'audio/ogg',
    '.mp3': 'audio/mpeg',
    '.wav': 'audio/wav',
    '.pdf': 'application/pdf',
    '.txt': 'text/plain',
    '.json': 'application/json',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  };

  const contentType = mimeTypes[ext] || 'application/octet-stream';
  res.setHeader('Content-Type', contentType);
  res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
  res.sendFile(filePath);
});

// Extend express request with authenticated user
interface AuthRequest extends Request {
  user?: User;
}

// Authentication middleware
export async function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const token = authHeader.split(' ')[1];
    const user = await getUserByToken(token);
    if (!user) {
      res.status(401).json({ error: 'Invalid or expired session' });
      return;
    }
    req.user = user;
    next();
  } catch (err) {
    console.error('Error in requireAuth middleware:', err);
    res.status(500).json({ error: 'Authentication check failed' });
  }
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
async function requireHomeMembership(req: AuthRequest, res: Response, homeId: string): Promise<boolean> {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  const isMember = await isUserInHome(req.user.id, homeId);
  if (!isMember) {
    res.status(403).json({ error: 'Access denied: You are not a member of this Home' });
    return false;
  }
  return true;
}

// Helper for home admin/owner authorization
async function requireHomeAdmin(req: AuthRequest, res: Response, homeId: string): Promise<boolean> {
  const isMember = await requireHomeMembership(req, res, homeId);
  if (!isMember) return false;
  const role = await getUserRoleInHome(req.user!.id, homeId);
  if (role !== 'owner' && role !== 'admin') {
    res.status(403).json({ error: 'Permission denied: Only Home Owners and Admins can modify Home settings or manage members' });
    return false;
  }
  return true;
}

// -------------------------------------------------------------
// AUTH ROUTES
// -------------------------------------------------------------

apiRouter.post('/auth/register', async (req: Request, res: Response) => {
  try {
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

    const existing = await getUserByEmail(email);
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

    await createUser(newUser);
    const session = await createSession(newUser.id);

    res.status(201).json({
      user: sanitizeUser(newUser),
      token: session.token
    });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ error: 'Failed to create user account' });
  }
});

apiRouter.post('/auth/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required' });
      return;
    }

    const user = await getUserByEmail(email);
    if (!user) {
      res.status(401).json({ error: 'Incorrect email or password' });
      return;
    }

    const valid = verifyPassword(password, user.passwordHash, user.salt);
    if (!valid) {
      res.status(401).json({ error: 'Incorrect email or password' });
      return;
    }

    const session = await createSession(user.id);

    res.json({
      user: sanitizeUser(user),
      token: session.token
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

apiRouter.get('/auth/me', requireAuth, (req: AuthRequest, res: Response) => {
  res.json({ user: sanitizeUser(req.user!) });
});

apiRouter.post('/auth/logout', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      await removeSession(token);
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Logout error:', err);
    res.status(500).json({ error: 'Logout failed' });
  }
});

apiRouter.put('/auth/profile', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { name, avatar } = req.body;
    const user = req.user!;

    const updated = await updateUserProfile(user.id, name, avatar);
    if (!updated) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.json({ user: sanitizeUser(updated) });
  } catch (err) {
    console.error('Profile update error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// -------------------------------------------------------------
// HOMES & MEMBERSHIP
// -------------------------------------------------------------

apiRouter.get('/homes', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const homes = await getUserHomes(req.user!.id);
    res.json({ homes });
  } catch (err) {
    console.error('Get homes error:', err);
    res.status(500).json({ error: 'Failed to load homes' });
  }
});

apiRouter.post('/homes', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { name, description, avatar, coverImage, icon, themeColor } = req.body;
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
      coverImage: coverImage || 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=1200&auto=format&fit=crop&q=80',
      icon: icon || '🏡',
      themeColor: themeColor || '#4f46e5',
      inviteCode,
      ownerId: user.id,
      createdAt: new Date().toISOString()
    };

    await createHome(newHome);

    // Add creator as owner
    const membership: HomeMember = {
      id: `hm_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      homeId,
      userId: user.id,
      role: 'owner',
      joinedAt: new Date().toISOString()
    };
    await addHomeMember(membership);

    // Create default Family Chat
    const familyChat: Conversation = {
      id: `conv_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      homeId,
      type: 'family',
      participantIds: [user.id],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await createConversation(familyChat);

    // Initial welcome message
    const welcomeMsg: Message = {
      id: `m_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      conversationId: familyChat.id,
      senderId: user.id,
      content: `Welcome to our private family space in HOMELY! Invite family members using code: ${inviteCode}`,
      createdAt: new Date().toISOString()
    };
    await createMessage(welcomeMsg);

    res.status(201).json({
      home: newHome,
      role: 'owner'
    });
  } catch (err) {
    console.error('Create home error:', err);
    res.status(500).json({ error: 'Failed to create family Home' });
  }
});

apiRouter.post('/homes/join', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { inviteCode } = req.body;
    const user = req.user!;

    if (!inviteCode || typeof inviteCode !== 'string') {
      res.status(400).json({ error: 'Invite code is required' });
      return;
    }

    const codeClean = inviteCode.trim().toUpperCase();
    const home = await getHomeByInviteCode(codeClean);

    if (!home) {
      res.status(404).json({ error: 'No family Home found with this invitation code' });
      return;
    }

    if (await isUserInHome(user.id, home.id)) {
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
    await addHomeMember(membership);

    // Ensure user is in family conversation
    await getConversationsForUser(home.id, user.id);

    // Add join notification for other members
    const allMembers = await getHomeMembers(home.id);
    for (const m of allMembers) {
      if (m.userId !== user.id) {
        await createNotification({
          id: `n_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
          homeId: home.id,
          recipientId: m.userId,
          senderId: user.id,
          type: 'member_joined',
          title: `${user.name} joined ${home.name}`,
          body: `Welcome our newest family member to ${home.name}!`,
          targetType: 'member',
          targetId: user.id,
          read: false,
          createdAt: new Date().toISOString()
        });
      }
    }

    res.json({
      home,
      role: 'member'
    });
  } catch (err) {
    console.error('Join home error:', err);
    res.status(500).json({ error: 'Failed to join Home' });
  }
});

apiRouter.get('/homes/:homeId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { homeId } = req.params;
    if (!(await requireHomeMembership(req, res, homeId))) return;

    const home = await getHomeById(homeId);
    if (!home) {
      res.status(404).json({ error: 'Home not found' });
      return;
    }

    const role = await getUserRoleInHome(req.user!.id, homeId);
    res.json({ home, role });
  } catch (err) {
    console.error('Get home details error:', err);
    res.status(500).json({ error: 'Failed to retrieve home details' });
  }
});

apiRouter.get('/homes/:homeId/members', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { homeId } = req.params;
    if (!(await requireHomeMembership(req, res, homeId))) return;

    const members = await getHomeMembers(homeId);
    res.json({ members });
  } catch (err) {
    console.error('Get home members error:', err);
    res.status(500).json({ error: 'Failed to retrieve family members' });
  }
});

// Update Home customization settings (Owner/Admin only)
apiRouter.put('/homes/:homeId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { homeId } = req.params;
    if (!(await requireHomeAdmin(req, res, homeId))) return;

    const { name, description, avatar, coverImage, icon, themeColor } = req.body;

    if (name !== undefined && (typeof name !== 'string' || name.trim().length === 0)) {
      res.status(400).json({ error: 'Home name cannot be empty' });
      return;
    }

    const updated = await updateHome(homeId, {
      name,
      description,
      avatar,
      coverImage,
      icon,
      themeColor
    });

    if (!updated) {
      res.status(404).json({ error: 'Home not found' });
      return;
    }

    const role = await getUserRoleInHome(req.user!.id, homeId);
    res.json({ home: updated, role });
  } catch (err) {
    console.error('Update home error:', err);
    res.status(500).json({ error: 'Failed to update Home settings' });
  }
});

// Regenerate Home invite code (Owner/Admin only)
apiRouter.post('/homes/:homeId/regenerate-invite', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { homeId } = req.params;
    if (!(await requireHomeAdmin(req, res, homeId))) return;

    const updated = await regenerateHomeInviteCode(homeId);
    if (!updated) {
      res.status(404).json({ error: 'Home not found' });
      return;
    }

    // Notify other home members
    const homeMembers = await getHomeMembers(homeId);
    for (const m of homeMembers) {
      if (m.userId !== req.user!.id) {
        await createNotification({
          id: `n_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
          homeId,
          recipientId: m.userId,
          senderId: req.user!.id,
          type: 'home_invite_regenerated',
          title: 'Invite Code Refreshed',
          body: `${req.user!.name} generated a new invite code for ${updated.name}`,
          targetType: 'member',
          read: false,
          createdAt: new Date().toISOString()
        });
      }
    }

    res.json({ home: updated, inviteCode: updated.inviteCode });
  } catch (err) {
    console.error('Regenerate invite error:', err);
    res.status(500).json({ error: 'Failed to regenerate invitation code' });
  }
});

// Update member role (Owner/Admin only)
apiRouter.put('/homes/:homeId/members/:memberUserId/role', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { homeId, memberUserId } = req.params;
    const { role } = req.body;
    if (!(await requireHomeAdmin(req, res, homeId))) return;

    if (!['admin', 'member'].includes(role)) {
      res.status(400).json({ error: 'Invalid role. Must be admin or member.' });
      return;
    }

    const currentActorRole = await getUserRoleInHome(req.user!.id, homeId);
    const targetCurrentRole = await getUserRoleInHome(memberUserId, homeId);

    if (!targetCurrentRole) {
      res.status(404).json({ error: 'Member not found in this home' });
      return;
    }

    if (targetCurrentRole === 'owner') {
      res.status(403).json({ error: 'The Home Owner role cannot be changed' });
      return;
    }

    // Only owner can modify admin roles
    if (currentActorRole !== 'owner' && targetCurrentRole === 'admin') {
      res.status(403).json({ error: 'Only the Home Owner can modify administrator roles' });
      return;
    }

    const ok = await updateHomeMemberRole(homeId, memberUserId, role);
    if (!ok) {
      res.status(400).json({ error: 'Failed to update member role' });
      return;
    }

    const homeObj = await getHomeById(homeId);
    if (memberUserId !== req.user!.id) {
      await createNotification({
        id: `n_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
        homeId,
        recipientId: memberUserId,
        senderId: req.user!.id,
        type: 'member_role_changed',
        title: `Role Updated in ${homeObj?.name || 'Home'}`,
        body: `Your role was changed to ${role.charAt(0).toUpperCase() + role.slice(1)} by ${req.user!.name}`,
        targetType: 'member',
        targetId: memberUserId,
        read: false,
        createdAt: new Date().toISOString()
      });
    }

    const members = await getHomeMembers(homeId);
    res.json({ success: true, members });
  } catch (err) {
    console.error('Update member role error:', err);
    res.status(500).json({ error: 'Failed to update member role' });
  }
});

// Remove member or leave home
apiRouter.delete('/homes/:homeId/members/:memberUserId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { homeId, memberUserId } = req.params;
    const isMember = await requireHomeMembership(req, res, homeId);
    if (!isMember) return;

    const currentActorRole = await getUserRoleInHome(req.user!.id, homeId);
    const targetRole = await getUserRoleInHome(memberUserId, homeId);

    if (!targetRole) {
      res.status(404).json({ error: 'Member not found in this home' });
      return;
    }

    if (targetRole === 'owner') {
      res.status(403).json({ error: 'Cannot remove the Home Owner' });
      return;
    }

    const isSelf = req.user!.id === memberUserId;
    if (!isSelf && currentActorRole !== 'owner' && currentActorRole !== 'admin') {
      res.status(403).json({ error: 'Only Home Owners and Admins can remove other members' });
      return;
    }

    if (!isSelf && currentActorRole === 'admin' && targetRole === 'admin') {
      res.status(403).json({ error: 'Admins cannot remove other Admins' });
      return;
    }

    const ok = await removeHomeMember(homeId, memberUserId);
    if (!ok) {
      res.status(400).json({ error: 'Failed to remove member' });
      return;
    }

    const members = await getHomeMembers(homeId);
    res.json({ success: true, members });
  } catch (err) {
    console.error('Remove member error:', err);
    res.status(500).json({ error: 'Failed to remove member' });
  }
});

// Home dashboard aggregator
apiRouter.get('/homes/:homeId/dashboard', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { homeId } = req.params;
    if (!(await requireHomeMembership(req, res, homeId))) return;

    const dashboard = await getHomeDashboardData(homeId, req.user!.id);
    if (!dashboard) {
      res.status(404).json({ error: 'Home not found' });
      return;
    }

    res.json(dashboard);
  } catch (err) {
    console.error('Get home dashboard error:', err);
    res.status(500).json({ error: 'Failed to load home dashboard' });
  }
});

// -------------------------------------------------------------
// POSTS & FEED
// -------------------------------------------------------------

apiRouter.get('/homes/:homeId/posts', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { homeId } = req.params;
    if (!(await requireHomeMembership(req, res, homeId))) return;

    const posts = await getPostsForHome(homeId, req.user!.id);
    res.json({ posts });
  } catch (err) {
    console.error('Get posts error:', err);
    res.status(500).json({ error: 'Failed to retrieve posts' });
  }
});

apiRouter.post('/homes/:homeId/posts', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { homeId } = req.params;
    if (!(await requireHomeMembership(req, res, homeId))) return;

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

    await createPost(newPost);

    // Notify other members
    const members = await getHomeMembers(homeId);
    for (const m of members) {
      if (m.userId !== req.user!.id) {
        await createNotification({
          id: `n_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
          homeId,
          recipientId: m.userId,
          senderId: req.user!.id,
          type: postType === 'announcement' ? 'post_announcement' : 'post',
          title: postType === 'announcement'
            ? `Announcement from ${req.user!.name}`
            : `${req.user!.name} shared a new ${postType}`,
          body: content.slice(0, 90),
          targetType: 'post',
          targetId: newPost.id,
          read: false,
          createdAt: new Date().toISOString()
        });
      }
    }

    res.status(201).json({
      post: {
        ...newPost,
        author: sanitizeUser(req.user!),
        comments: [],
        reactions: {}
      }
    });
  } catch (err) {
    console.error('Create post error:', err);
    res.status(500).json({ error: 'Failed to create post' });
  }
});

apiRouter.post(['/homes/:homeId/posts/:postId/reactions', '/homes/:homeId/posts/:postId/react'], requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { homeId, postId } = req.params;
    if (!(await requireHomeMembership(req, res, homeId))) return;

    const { emoji } = req.body;
    if (!emoji || typeof emoji !== 'string') {
      res.status(400).json({ error: 'Emoji is required' });
      return;
    }

    const result = await toggleReaction(postId, req.user!.id, emoji);

    // Notify post author when a reaction is added
    if (result.added) {
      const post = await getPostById(postId);
      if (post && post.authorId !== req.user!.id) {
        await createNotification({
          id: `n_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
          homeId,
          recipientId: post.authorId,
          senderId: req.user!.id,
          type: 'post_reaction',
          title: `${req.user!.name} reacted ${emoji} to your post`,
          body: post.content.slice(0, 80),
          targetType: 'post',
          targetId: postId,
          read: false,
          createdAt: new Date().toISOString()
        });
      }
    }

    res.json({ success: true, added: result.added });
  } catch (err) {
    console.error('Reaction toggle error:', err);
    res.status(500).json({ error: 'Failed to update reaction' });
  }
});

apiRouter.post('/homes/:homeId/posts/:postId/comments', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { homeId, postId } = req.params;
    if (!(await requireHomeMembership(req, res, homeId))) return;

    const { content } = req.body;
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      res.status(400).json({ error: 'Comment cannot be empty' });
      return;
    }

    const post = await getPostById(postId);
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

    await createComment(newComment);

    // Notify post author if not self
    if (post.authorId !== req.user!.id) {
      await createNotification({
        id: `n_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
        homeId,
        recipientId: post.authorId,
        senderId: req.user!.id,
        type: 'comment',
        title: `${req.user!.name} commented on your post`,
        body: content.slice(0, 80),
        targetType: 'post',
        targetId: postId,
        read: false,
        createdAt: new Date().toISOString()
      });
    }

    // Notify other previous commenters (comment reply)
    const priorCommenterIds = await getPostCommentAuthorIds(postId);
    for (const cAuthorId of priorCommenterIds) {
      if (cAuthorId !== req.user!.id && cAuthorId !== post.authorId) {
        await createNotification({
          id: `n_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
          homeId,
          recipientId: cAuthorId,
          senderId: req.user!.id,
          type: 'comment_reply',
          title: `${req.user!.name} also commented on a post`,
          body: content.slice(0, 80),
          targetType: 'post',
          targetId: postId,
          read: false,
          createdAt: new Date().toISOString()
        });
      }
    }

    res.status(201).json({
      comment: {
        id: newComment.id,
        content: newComment.content,
        createdAt: newComment.createdAt,
        author: sanitizeUser(req.user!)
      }
    });
  } catch (err) {
    console.error('Create comment error:', err);
    res.status(500).json({ error: 'Failed to add comment' });
  }
});

apiRouter.delete('/homes/:homeId/posts/:postId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { homeId, postId } = req.params;
    if (!(await requireHomeMembership(req, res, homeId))) return;

    const post = await getPostById(postId);
    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    const userRole = await getUserRoleInHome(req.user!.id, homeId);
    const isAuthor = post.authorId === req.user!.id;
    const isOwnerOrAdmin = userRole === 'owner' || userRole === 'admin';

    if (!isAuthor && !isOwnerOrAdmin) {
      res.status(403).json({ error: 'You do not have permission to delete this post' });
      return;
    }

    await deletePost(postId);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete post error:', err);
    res.status(500).json({ error: 'Failed to delete post' });
  }
});

// -------------------------------------------------------------
// CHAT & CONVERSATIONS
// -------------------------------------------------------------

apiRouter.get('/homes/:homeId/conversations', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { homeId } = req.params;
    if (!(await requireHomeMembership(req, res, homeId))) return;

    const populated = await getConversationsForUser(homeId, req.user!.id);
    res.json({ conversations: populated });
  } catch (err) {
    console.error('Get conversations error:', err);
    res.status(500).json({ error: 'Failed to retrieve conversations' });
  }
});

apiRouter.post('/homes/:homeId/conversations/direct', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { homeId } = req.params;
    if (!(await requireHomeMembership(req, res, homeId))) return;

    const { targetUserId } = req.body;
    const currentUserId = req.user!.id;

    if (!targetUserId || targetUserId === currentUserId) {
      res.status(400).json({ error: 'Valid target family member is required' });
      return;
    }

    if (!(await isUserInHome(targetUserId, homeId))) {
      res.status(404).json({ error: 'Target member is not in this family' });
      return;
    }

    let directConv = await findDirectConversation(homeId, currentUserId, targetUserId);

    if (!directConv) {
      directConv = {
        id: `conv_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
        homeId,
        type: 'direct',
        participantIds: [currentUserId, targetUserId],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      await createConversation(directConv);
    }

    res.json({ conversation: directConv });
  } catch (err) {
    console.error('Create direct chat error:', err);
    res.status(500).json({ error: 'Failed to start direct conversation' });
  }
});

apiRouter.get('/homes/:homeId/conversations/:conversationId/messages', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { homeId, conversationId } = req.params;
    if (!(await requireHomeMembership(req, res, homeId))) return;

    const conversation = await getConversationById(conversationId);
    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    if (!conversation.participantIds.includes(req.user!.id)) {
      res.status(403).json({ error: 'Access denied to this conversation' });
      return;
    }

    const messages = await getMessages(conversationId, req.user!.id);
    res.json({ messages });
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ error: 'Failed to retrieve messages' });
  }
});

apiRouter.post('/homes/:homeId/chat/upload', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { homeId } = req.params;
    if (!(await requireHomeMembership(req, res, homeId))) return;

    const { fileBase64, fileName, mimeType, duration } = req.body;
    if (!fileBase64 || typeof fileBase64 !== 'string') {
      res.status(400).json({ error: 'File data is required' });
      return;
    }

    const safeNameClean = (fileName || 'attachment').replace(/[^a-zA-Z0-9._-]/g, '_');
    const ext = path.extname(safeNameClean) || (mimeType?.includes('audio') ? '.webm' : mimeType?.includes('video') ? '.mp4' : mimeType?.includes('image') ? '.jpg' : '.bin');
    const diskFileName = `up_${Date.now()}_${crypto.randomBytes(4).toString('hex')}${ext}`;
    const filePath = path.join(UPLOADS_DIR, diskFileName);

    // Strip data URL prefix if present
    const cleanBase64 = fileBase64.replace(/^data:.*?;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');

    await fs.promises.writeFile(filePath, buffer);

    res.status(201).json({
      url: `/api/uploads/${diskFileName}`,
      fileName: fileName || diskFileName,
      mimeType: mimeType || 'application/octet-stream',
      size: buffer.length,
      duration: typeof duration === 'number' ? duration : undefined
    });
  } catch (err) {
    console.error('Chat file upload error:', err);
    res.status(500).json({ error: 'Failed to upload attachment' });
  }
});

apiRouter.post('/homes/:homeId/conversations/:conversationId/messages', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { homeId, conversationId } = req.params;
    if (!(await requireHomeMembership(req, res, homeId))) return;

    const conversation = await getConversationById(conversationId);
    if (!conversation) {
      res.status(404).json({ error: 'Conversation not found' });
      return;
    }

    if (!conversation.participantIds.includes(req.user!.id)) {
      res.status(403).json({ error: 'Access denied to this conversation' });
      return;
    }

    const {
      content,
      replyToId,
      mediaUrl,
      mediaType,
      mediaName,
      mediaSize,
      mediaDuration,
      extraData,
      isPinned
    } = req.body;

    const trimmedContent = typeof content === 'string' ? content.trim() : '';

    if (!trimmedContent && !mediaUrl && !extraData) {
      res.status(400).json({ error: 'Message cannot be completely empty' });
      return;
    }

    const newMsg: Message = {
      id: `m_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      conversationId,
      senderId: req.user!.id,
      content: trimmedContent,
      replyToId: replyToId || undefined,
      mediaUrl: mediaUrl || undefined,
      mediaType: mediaType || undefined,
      mediaName: mediaName || undefined,
      mediaSize: mediaSize || undefined,
      mediaDuration: mediaDuration || undefined,
      isPinned: isPinned ? true : false,
      pinnedAt: isPinned ? new Date().toISOString() : undefined,
      pinnedBy: isPinned ? req.user!.id : undefined,
      extraData: extraData ? (typeof extraData === 'string' ? extraData : JSON.stringify(extraData)) : undefined,
      createdAt: new Date().toISOString()
    };

    await createMessage(newMsg);

    // Look up parent message for reply detection
    let repliedSenderId: string | null = null;
    if (replyToId) {
      try {
        const parentMsg = await getMessageById(replyToId);
        if (parentMsg) {
          repliedSenderId = parentMsg.senderId;
        }
      } catch {
        // ignore
      }
    }

    // Create notifications for other participants
    for (const pId of conversation.participantIds) {
      if (pId !== req.user!.id) {
        let notifType: NotificationType = 'message_family';
        let notifTitle = `${req.user!.name} in Family Chat`;

        if (conversation.type === 'direct') {
          notifType = 'message_dm';
          notifTitle = `${req.user!.name} sent you a message`;
        } else if (repliedSenderId && repliedSenderId === pId) {
          notifType = 'message_reply';
          notifTitle = `${req.user!.name} replied to your message`;
        } else {
          // Check mention: check user name or @all/@family
          const targetUser = await getUserById(pId);
          const firstName = targetUser?.name ? targetUser.name.toLowerCase().split(' ')[0] : '';
          const lowerContent = trimmedContent.toLowerCase();
          if (lowerContent.includes('@all') || lowerContent.includes('@family') || (firstName && lowerContent.includes(`@${firstName}`))) {
            notifType = 'message_mention';
            notifTitle = `${req.user!.name} mentioned you in Family Chat`;
          }
        }

        await createNotification({
          id: `n_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
          homeId,
          recipientId: pId,
          senderId: req.user!.id,
          type: notifType,
          title: notifTitle,
          body: trimmedContent ? trimmedContent.slice(0, 80) : (mediaType ? `Sent a ${mediaType}` : 'Sent an attachment'),
          targetType: 'conversation',
          targetId: conversationId,
          read: false,
          createdAt: new Date().toISOString()
        });
      }
    }

    let poll = undefined;
    let location = undefined;
    if (newMsg.extraData) {
      try {
        const parsed = JSON.parse(newMsg.extraData);
        if (newMsg.mediaType === 'poll') poll = parsed;
        if (newMsg.mediaType === 'location') location = parsed;
      } catch {
        // ignore
      }
    }

    res.status(201).json({
      message: {
        ...newMsg,
        poll,
        location,
        isOwn: true,
        reactions: [],
        status: 'sent',
        sender: sanitizeUser(req.user!)
      }
    });
  } catch (err) {
    console.error('Send message error:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

apiRouter.patch('/homes/:homeId/conversations/:conversationId/messages/:messageId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { homeId, messageId } = req.params;
    if (!(await requireHomeMembership(req, res, homeId))) return;

    const { content } = req.body;
    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      res.status(400).json({ error: 'Updated content cannot be empty' });
      return;
    }

    const updated = await updateMessage(messageId, req.user!.id, content.trim());
    if (!updated) {
      res.status(403).json({ error: 'Message not found or you are not authorized to edit this message' });
      return;
    }

    res.json({ success: true, messageId, content: content.trim() });
  } catch (err) {
    console.error('Edit message error:', err);
    res.status(500).json({ error: 'Failed to update message' });
  }
});

apiRouter.delete('/homes/:homeId/conversations/:conversationId/messages/:messageId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { homeId, messageId } = req.params;
    if (!(await requireHomeMembership(req, res, homeId))) return;

    const deleted = await deleteMessage(messageId, req.user!.id, homeId);
    if (!deleted) {
      res.status(403).json({ error: 'Message not found or you are not authorized to delete this message' });
      return;
    }

    res.json({ success: true, messageId });
  } catch (err) {
    console.error('Delete message error:', err);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

apiRouter.post('/homes/:homeId/conversations/:conversationId/messages/:messageId/reactions', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { homeId, messageId } = req.params;
    if (!(await requireHomeMembership(req, res, homeId))) return;

    const { emoji } = req.body;
    if (!emoji || typeof emoji !== 'string') {
      res.status(400).json({ error: 'Valid emoji is required' });
      return;
    }

    const reactions = await toggleMessageReaction(messageId, req.user!.id, emoji);
    res.json({ success: true, messageId, reactions });
  } catch (err) {
    console.error('Toggle reaction error:', err);
    res.status(500).json({ error: 'Failed to update reaction' });
  }
});

apiRouter.post('/homes/:homeId/conversations/:conversationId/messages/:messageId/pin', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { homeId, messageId } = req.params;
    if (!(await requireHomeMembership(req, res, homeId))) return;

    const result = await togglePinMessage(messageId, homeId, req.user!.id);
    if (!result) {
      res.status(404).json({ error: 'Message not found' });
      return;
    }

    res.json({ success: true, ...result });
  } catch (err) {
    console.error('Pin message error:', err);
    res.status(500).json({ error: 'Failed to pin message' });
  }
});

apiRouter.get('/homes/:homeId/conversations/:conversationId/pinned', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { homeId, conversationId } = req.params;
    if (!(await requireHomeMembership(req, res, homeId))) return;

    const pinnedMessages = await getPinnedMessages(conversationId, req.user!.id);
    res.json({ pinnedMessages });
  } catch (err) {
    console.error('Get pinned messages error:', err);
    res.status(500).json({ error: 'Failed to retrieve pinned messages' });
  }
});

apiRouter.get('/homes/:homeId/conversations/:conversationId/search', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { homeId, conversationId } = req.params;
    if (!(await requireHomeMembership(req, res, homeId))) return;

    const q = typeof req.query.q === 'string' ? req.query.q : undefined;
    const date = typeof req.query.date === 'string' ? req.query.date : undefined;

    const results = await searchMessages(conversationId, q, date, req.user!.id);
    res.json({ results });
  } catch (err) {
    console.error('Search messages error:', err);
    res.status(500).json({ error: 'Failed to search messages' });
  }
});

apiRouter.post('/homes/:homeId/conversations/:conversationId/poll-vote', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { homeId } = req.params;
    if (!(await requireHomeMembership(req, res, homeId))) return;

    const { messageId, optionId } = req.body;
    if (!messageId || !optionId) {
      res.status(400).json({ error: 'Message ID and Option ID are required' });
      return;
    }

    const poll = await votePoll(messageId, req.user!.id, optionId);
    if (!poll) {
      res.status(404).json({ error: 'Poll not found or invalid' });
      return;
    }

    res.json({ success: true, poll });
  } catch (err) {
    console.error('Poll vote error:', err);
    res.status(500).json({ error: 'Failed to register vote' });
  }
});

apiRouter.post('/homes/:homeId/conversations/:conversationId/heartbeat', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { homeId, conversationId } = req.params;
    if (!(await requireHomeMembership(req, res, homeId))) return;

    const { isTyping } = req.body;
    const result = await updateUserHeartbeat(req.user!.id, conversationId, !!isTyping);
    res.json(result);
  } catch (err) {
    console.error('Heartbeat error:', err);
    res.status(500).json({ error: 'Failed to update presence' });
  }
});

// -------------------------------------------------------------
// EVENTS
// -------------------------------------------------------------

apiRouter.get('/homes/:homeId/events', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { homeId } = req.params;
    if (!(await requireHomeMembership(req, res, homeId))) return;

    const events = await getEvents(homeId, req.user!.id);
    res.json({ events });
  } catch (err) {
    console.error('Get events error:', err);
    res.status(500).json({ error: 'Failed to retrieve events' });
  }
});

apiRouter.post('/homes/:homeId/events', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { homeId } = req.params;
    if (!(await requireHomeMembership(req, res, homeId))) return;

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

    await createEvent(newEvent);

    // Notify members
    const members = await getHomeMembers(homeId);
    for (const m of members) {
      if (m.userId !== req.user!.id) {
        await createNotification({
          id: `n_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
          homeId,
          recipientId: m.userId,
          senderId: req.user!.id,
          type: 'event_created',
          title: `New Event: ${newEvent.title}`,
          body: `${req.user!.name} scheduled ${newEvent.title} for ${date} at ${time || '18:00'}${location ? ' • ' + location : ''}`,
          targetType: 'event',
          targetId: newEvent.id,
          read: false,
          createdAt: new Date().toISOString()
        });
      }
    }

    res.status(201).json({ event: newEvent });
  } catch (err) {
    console.error('Create event error:', err);
    res.status(500).json({ error: 'Failed to schedule event' });
  }
});

apiRouter.post('/homes/:homeId/events/:eventId/rsvp', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { homeId, eventId } = req.params;
    if (!(await requireHomeMembership(req, res, homeId))) return;

    const event = await getEventById(eventId);
    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    const result = await toggleEventRsvp(eventId, req.user!.id);
    if (!result) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    // Notify event creator of RSVP update if not self
    if (event.creatorId !== req.user!.id) {
      await createNotification({
        id: `n_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
        homeId,
        recipientId: event.creatorId,
        senderId: req.user!.id,
        type: 'event_rsvp',
        title: result.isAttending ? `${req.user!.name} RSVP'd to your event` : `${req.user!.name} updated RSVP`,
        body: result.isAttending ? `Attending: "${event.title}" on ${event.date}` : `Cannot attend: "${event.title}"`,
        targetType: 'event',
        targetId: event.id,
        read: false,
        createdAt: new Date().toISOString()
      });
    }

    res.json(result);
  } catch (err) {
    console.error('RSVP error:', err);
    res.status(500).json({ error: 'Failed to update RSVP' });
  }
});

apiRouter.delete('/homes/:homeId/events/:eventId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { homeId, eventId } = req.params;
    if (!(await requireHomeMembership(req, res, homeId))) return;

    const event = await getEventById(eventId);
    if (!event) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }

    const userRole = await getUserRoleInHome(req.user!.id, homeId);
    if (event.creatorId !== req.user!.id && userRole !== 'owner' && userRole !== 'admin') {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    await deleteEvent(eventId);
    res.json({ success: true });
  } catch (err) {
    console.error('Delete event error:', err);
    res.status(500).json({ error: 'Failed to delete event' });
  }
});

// -------------------------------------------------------------
// MEMORIES
// -------------------------------------------------------------

apiRouter.get('/homes/:homeId/memories', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { homeId } = req.params;
    if (!(await requireHomeMembership(req, res, homeId))) return;

    const memories = await getMemories(homeId);
    res.json({ memories });
  } catch (err) {
    console.error('Get memories error:', err);
    res.status(500).json({ error: 'Failed to retrieve memories' });
  }
});

apiRouter.post('/homes/:homeId/memories', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { homeId } = req.params;
    if (!(await requireHomeMembership(req, res, homeId))) return;

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

    await createMemory(newMemory);

    // Notify other members of new family memory
    const members = await getHomeMembers(homeId);
    for (const m of members) {
      if (m.userId !== req.user!.id) {
        await createNotification({
          id: `n_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
          homeId,
          recipientId: m.userId,
          senderId: req.user!.id,
          type: 'memory_created',
          title: `${req.user!.name} shared a family memory`,
          body: `${newMemory.title}: ${newMemory.story.slice(0, 80)}`,
          targetType: 'memory',
          targetId: newMemory.id,
          read: false,
          createdAt: new Date().toISOString()
        });
      }
    }

    res.status(201).json({ memory: newMemory });
  } catch (err) {
    console.error('Create memory error:', err);
    res.status(500).json({ error: 'Failed to save memory' });
  }
});

// -------------------------------------------------------------
// VAULT / SHARED FILES
// -------------------------------------------------------------

apiRouter.get('/homes/:homeId/vault', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { homeId } = req.params;
    if (!(await requireHomeMembership(req, res, homeId))) return;

    const files = await getVaultFiles(homeId);
    res.json({ files });
  } catch (err) {
    console.error('Get vault error:', err);
    res.status(500).json({ error: 'Failed to retrieve vault files' });
  }
});

apiRouter.post('/homes/:homeId/vault', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { homeId } = req.params;
    if (!(await requireHomeMembership(req, res, homeId))) return;

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

    await createVaultFile(newFile);
    res.status(201).json({ file: newFile });
  } catch (err) {
    console.error('Create vault file error:', err);
    res.status(500).json({ error: 'Failed to save vault item' });
  }
});

// -------------------------------------------------------------
// NOTIFICATIONS & PREFERENCES
// -------------------------------------------------------------

// Global notifications for current user (optionally scoped to a home or unread)
apiRouter.get('/notifications', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const homeId = typeof req.query.homeId === 'string' && req.query.homeId ? req.query.homeId : undefined;
    const unreadOnly = req.query.unread === 'true';

    if (homeId && !(await isUserInHome(req.user!.id, homeId))) {
      res.status(403).json({ error: 'Access denied to this home' });
      return;
    }

    const notifs = await getNotifications(req.user!.id, homeId, unreadOnly);
    res.json({ notifications: notifs });
  } catch (err) {
    console.error('Get user notifications error:', err);
    res.status(500).json({ error: 'Failed to retrieve notifications' });
  }
});

// Home-specific notifications (backward compatible)
apiRouter.get('/homes/:homeId/notifications', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { homeId } = req.params;
    if (!(await requireHomeMembership(req, res, homeId))) return;

    const unreadOnly = req.query.unread === 'true';
    const notifs = await getNotifications(req.user!.id, homeId, unreadOnly);
    res.json({ notifications: notifs });
  } catch (err) {
    console.error('Get home notifications error:', err);
    res.status(500).json({ error: 'Failed to retrieve notifications' });
  }
});

// Fast unread counts (total and broken down by home)
apiRouter.get('/notifications/unread-count', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const homeId = typeof req.query.homeId === 'string' && req.query.homeId ? req.query.homeId : undefined;
    const counts = await getUnreadNotificationCount(req.user!.id, homeId);
    res.json(counts);
  } catch (err) {
    console.error('Get unread count error:', err);
    res.status(500).json({ error: 'Failed to get unread count' });
  }
});

// Mark single notification as read
apiRouter.post('/notifications/:id/read', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const success = await markNotificationAsRead(id, req.user!.id);
    res.json({ success });
  } catch (err) {
    console.error('Mark notification read error:', err);
    res.status(500).json({ error: 'Failed to mark notification read' });
  }
});

// Mark all notifications read across all homes or specific home
apiRouter.post('/notifications/read-all', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const homeId = typeof req.body?.homeId === 'string' && req.body.homeId ? req.body.homeId : undefined;
    await markNotificationsAsRead(req.user!.id, homeId);
    res.json({ success: true });
  } catch (err) {
    console.error('Mark all notifications read error:', err);
    res.status(500).json({ error: 'Failed to mark notifications read' });
  }
});

// Mark all home notifications read (backward compatible)
apiRouter.post('/homes/:homeId/notifications/read-all', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { homeId } = req.params;
    if (!(await requireHomeMembership(req, res, homeId))) return;

    await markNotificationsAsRead(req.user!.id, homeId);
    res.json({ success: true });
  } catch (err) {
    console.error('Mark home notifications read error:', err);
    res.status(500).json({ error: 'Failed to mark notifications read' });
  }
});

// Delete/dismiss a notification
apiRouter.delete('/notifications/:id', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const success = await deleteNotification(id, req.user!.id);
    res.json({ success });
  } catch (err) {
    console.error('Delete notification error:', err);
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// Get user notification preferences
apiRouter.get('/notifications/preferences', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const prefs = await getUserNotificationPreferences(req.user!.id);
    res.json({ preferences: prefs });
  } catch (err) {
    console.error('Get notification preferences error:', err);
    res.status(500).json({ error: 'Failed to retrieve notification preferences' });
  }
});

// Update user notification preferences
apiRouter.put('/notifications/preferences', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const updated = await updateUserNotificationPreferences(req.user!.id, req.body || {});
    res.json({ preferences: updated });
  } catch (err) {
    console.error('Update notification preferences error:', err);
    res.status(500).json({ error: 'Failed to update notification preferences' });
  }
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

// -------------------------------------------------------------
// ASK HOMELY AI ASSISTANT SUITE
// -------------------------------------------------------------

// Get persistent conversation history for this user & home
apiRouter.get('/homes/:homeId/ask/messages', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { homeId } = req.params;
    if (!(await requireHomeMembership(req, res, homeId))) return;

    const user = req.user!;
    const messages = await getAskHomelyMessages(homeId, user.id, 100);
    res.json({ messages });
  } catch (err) {
    console.error('Error fetching Ask Homely history:', err);
    res.status(500).json({ error: 'Failed to fetch conversation history' });
  }
});

// Clear conversation history
apiRouter.delete('/homes/:homeId/ask/messages', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { homeId } = req.params;
    if (!(await requireHomeMembership(req, res, homeId))) return;

    const user = req.user!;
    await clearAskHomelyHistory(homeId, user.id);
    res.json({ success: true });
  } catch (err) {
    console.error('Error clearing Ask Homely history:', err);
    res.status(500).json({ error: 'Failed to clear conversation history' });
  }
});

// Get persistent assistant memories for this home
apiRouter.get('/homes/:homeId/ask/memories', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { homeId } = req.params;
    if (!(await requireHomeMembership(req, res, homeId))) return;

    const memories = await getAssistantMemories(homeId);
    res.json({ memories });
  } catch (err) {
    console.error('Error fetching assistant memories:', err);
    res.status(500).json({ error: 'Failed to fetch assistant memories' });
  }
});

// Delete an assistant memory
apiRouter.delete('/homes/:homeId/ask/memories/:memoryId', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { homeId, memoryId } = req.params;
    if (!(await requireHomeMembership(req, res, homeId))) return;

    const deleted = await deleteAssistantMemoryById(memoryId, homeId);
    if (!deleted) {
      res.status(404).json({ error: 'Memory not found' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting assistant memory:', err);
    res.status(500).json({ error: 'Failed to delete assistant memory' });
  }
});

// Execute / Confirm an action
apiRouter.post('/homes/:homeId/ask/confirm-action', requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { homeId } = req.params;
    if (!(await requireHomeMembership(req, res, homeId))) return;

    const user = req.user!;
    const { action, messageId } = req.body;

    if (!action || !action.type) {
      res.status(400).json({ error: 'Valid action payload is required' });
      return;
    }

    const result = await executeAssistantAction(homeId, user, action);

    // If a messageId was passed, update the message record in DB
    if (messageId) {
      await updateAskHomelyMessageAction(messageId, null, result);
    }

    // Record confirmation message in assistant history
    const assistantMsgId = `msg_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const assistantMsg: AskHomelyMessage = {
      id: assistantMsgId,
      homeId,
      userId: user.id,
      role: 'assistant',
      content: result.message,
      actionResult: result,
      source: 'action-execution',
      createdAt: new Date().toISOString()
    };
    await saveAskHomelyMessage(assistantMsg);

    // Notify user of action completion
    if (result.success) {
      await createNotification({
        id: `n_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
        homeId,
        recipientId: user.id,
        senderId: 'homely_ai',
        type: 'ask_homely_action',
        title: 'Ask Homely Action Completed',
        body: result.message || 'Action executed successfully',
        targetType: 'ask',
        targetId: messageId || undefined,
        read: false,
        createdAt: new Date().toISOString()
      });
    }

    res.json({
      result,
      assistantMessage: assistantMsg
    });
  } catch (err) {
    console.error('Error executing assistant action:', err);
    res.status(500).json({ error: 'Failed to execute action' });
  }
});

// Main Ask Homely query endpoint
apiRouter.post(['/homes/:homeId/ask', '/homes/:homeId/ask-homely'], requireAuth, async (req: AuthRequest, res: Response) => {
  try {
    const { homeId } = req.params;
    if (!(await requireHomeMembership(req, res, homeId))) return;

    const { prompt, clientDate } = req.body;
    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      res.status(400).json({ error: 'Question or instruction cannot be empty' });
      return;
    }

    const user = req.user!;
    const userPrompt = prompt.trim();
    const now = new Date().toISOString();

    // 1. Record User Message
    const userMsgId = `msg_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const userMsg: AskHomelyMessage = {
      id: userMsgId,
      homeId,
      userId: user.id,
      role: 'user',
      content: userPrompt,
      createdAt: now
    };
    await saveAskHomelyMessage(userMsg);

    // 2. Process query with controlled engine + grounding + relative dates
    const response = await processAssistantQuery(homeId, user, userPrompt, clientDate);

    // 3. Record Assistant Response
    const assistantMsgId = `msg_${Date.now() + 1}_${crypto.randomBytes(3).toString('hex')}`;
    const assistantMsg: AskHomelyMessage = {
      id: assistantMsgId,
      homeId,
      userId: user.id,
      role: 'assistant',
      content: response.reply,
      source: response.source,
      actionPending: response.actionPending,
      actionResult: response.actionResult,
      results: response.results,
      sources: response.sources,
      createdAt: new Date().toISOString()
    };
    await saveAskHomelyMessage(assistantMsg);

    res.json({
      reply: response.reply,
      source: response.source,
      actionPending: response.actionPending,
      actionResult: response.actionResult,
      results: response.results,
      sources: response.sources,
      userMessage: userMsg,
      assistantMessage: assistantMsg
    });
  } catch (err) {
    console.error('Ask Homely error:', err);
    res.status(500).json({ error: 'Failed to process assistant request' });
  }
});
