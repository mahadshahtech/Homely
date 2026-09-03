import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { createClient, type Client } from '@libsql/client';
import type {
  User,
  Session,
  Home,
  HomeMember,
  Post,
  PostComment,
  PostReaction,
  Conversation,
  Message,
  FamilyEvent,
  FamilyMemory,
  MemoryComment,
  MemoryReaction,
  VaultFile,
  NotificationItem,
  NotificationType,
  NotificationPreferences,
  UserRole,
  AssistantMemory,
  AskHomelyMessage,
  AskHomelyActionPending
} from './types.ts';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'homely.db');
const LEGACY_JSON_FILE = path.join(DATA_DIR, 'homely.db.json');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export const sqliteClient: Client = createClient({
  url: `file:${DB_FILE}`
});

let dbReadyPromise: Promise<void> | null = null;

export async function ensureDbReady(): Promise<void> {
  if (!dbReadyPromise) {
    dbReadyPromise = initDatabase();
  }
  return dbReadyPromise;
}

async function initDatabase(): Promise<void> {
  try {
    await sqliteClient.execute('PRAGMA journal_mode = WAL;');
    await sqliteClient.execute('PRAGMA synchronous = NORMAL;');
    await sqliteClient.execute('PRAGMA foreign_keys = ON;');

    // 1. Users
    await sqliteClient.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE COLLATE NOCASE,
        passwordHash TEXT NOT NULL,
        salt TEXT NOT NULL,
        avatar TEXT,
        createdAt TEXT NOT NULL
      );
    `);

    // 2. Sessions
    await sqliteClient.execute(`
      CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        expiresAt TEXT NOT NULL,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // 3. Homes
    await sqliteClient.execute(`
      CREATE TABLE IF NOT EXISTS homes (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        avatar TEXT,
        coverImage TEXT,
        icon TEXT,
        themeColor TEXT,
        inviteCode TEXT NOT NULL UNIQUE COLLATE NOCASE,
        ownerId TEXT NOT NULL,
        createdAt TEXT NOT NULL
      );
    `);

    // Safely add any new columns to existing database tables
    try {
      await sqliteClient.execute('ALTER TABLE homes ADD COLUMN coverImage TEXT;');
    } catch { /* column already exists */ }
    try {
      await sqliteClient.execute('ALTER TABLE homes ADD COLUMN icon TEXT;');
    } catch { /* column already exists */ }
    try {
      await sqliteClient.execute('ALTER TABLE homes ADD COLUMN themeColor TEXT;');
    } catch { /* column already exists */ }

    // Ensure sensible defaults for existing rows
    try {
      await sqliteClient.execute(`
        UPDATE homes 
        SET coverImage = 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=1200&auto=format&fit=crop&q=80'
        WHERE coverImage IS NULL OR coverImage = '';
      `);
      await sqliteClient.execute(`
        UPDATE homes 
        SET icon = '🏡'
        WHERE icon IS NULL OR icon = '';
      `);
      await sqliteClient.execute(`
        UPDATE homes 
        SET themeColor = '#4f46e5'
        WHERE themeColor IS NULL OR themeColor = '';
      `);
    } catch { /* ignore */ }

    // 4. Home Members
    await sqliteClient.execute(`
      CREATE TABLE IF NOT EXISTS home_members (
        id TEXT PRIMARY KEY,
        homeId TEXT NOT NULL,
        userId TEXT NOT NULL,
        role TEXT NOT NULL,
        joinedAt TEXT NOT NULL,
        UNIQUE(homeId, userId),
        FOREIGN KEY (homeId) REFERENCES homes(id) ON DELETE CASCADE,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // 5. Posts
    await sqliteClient.execute(`
      CREATE TABLE IF NOT EXISTS posts (
        id TEXT PRIMARY KEY,
        homeId TEXT NOT NULL,
        authorId TEXT NOT NULL,
        content TEXT NOT NULL,
        type TEXT NOT NULL,
        imageUrl TEXT,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (homeId) REFERENCES homes(id) ON DELETE CASCADE,
        FOREIGN KEY (authorId) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // 6. Comments
    await sqliteClient.execute(`
      CREATE TABLE IF NOT EXISTS comments (
        id TEXT PRIMARY KEY,
        postId TEXT NOT NULL,
        authorId TEXT NOT NULL,
        content TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (postId) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (authorId) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // 7. Reactions
    await sqliteClient.execute(`
      CREATE TABLE IF NOT EXISTS reactions (
        id TEXT PRIMARY KEY,
        postId TEXT NOT NULL,
        userId TEXT NOT NULL,
        emoji TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        UNIQUE(postId, userId, emoji),
        FOREIGN KEY (postId) REFERENCES posts(id) ON DELETE CASCADE,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // 8. Conversations
    await sqliteClient.execute(`
      CREATE TABLE IF NOT EXISTS conversations (
        id TEXT PRIMARY KEY,
        homeId TEXT NOT NULL,
        type TEXT NOT NULL,
        participantIds TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (homeId) REFERENCES homes(id) ON DELETE CASCADE
      );
    `);

    // 9. Messages
    await sqliteClient.execute(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        conversationId TEXT NOT NULL,
        senderId TEXT NOT NULL,
        content TEXT NOT NULL,
        replyToId TEXT,
        mediaUrl TEXT,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (conversationId) REFERENCES conversations(id) ON DELETE CASCADE,
        FOREIGN KEY (senderId) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // 10. Events
    await sqliteClient.execute(`
      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        homeId TEXT NOT NULL,
        creatorId TEXT NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        date TEXT NOT NULL,
        time TEXT NOT NULL,
        location TEXT,
        attendeeIds TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (homeId) REFERENCES homes(id) ON DELETE CASCADE,
        FOREIGN KEY (creatorId) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // 11. Memories
    await sqliteClient.execute(`
      CREATE TABLE IF NOT EXISTS memories (
        id TEXT PRIMARY KEY,
        homeId TEXT NOT NULL,
        creatorId TEXT NOT NULL,
        title TEXT NOT NULL,
        story TEXT NOT NULL,
        date TEXT NOT NULL,
        imageUrl TEXT,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (homeId) REFERENCES homes(id) ON DELETE CASCADE,
        FOREIGN KEY (creatorId) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // 12. Vault Files
    await sqliteClient.execute(`
      CREATE TABLE IF NOT EXISTS vault_files (
        id TEXT PRIMARY KEY,
        homeId TEXT NOT NULL,
        uploaderId TEXT NOT NULL,
        title TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT,
        contentOrUrl TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (homeId) REFERENCES homes(id) ON DELETE CASCADE,
        FOREIGN KEY (uploaderId) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // 13. Notifications
    await sqliteClient.execute(`
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY,
        homeId TEXT NOT NULL,
        recipientId TEXT NOT NULL,
        senderId TEXT NOT NULL,
        type TEXT NOT NULL,
        title TEXT NOT NULL,
        body TEXT NOT NULL,
        read INTEGER NOT NULL DEFAULT 0,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (homeId) REFERENCES homes(id) ON DELETE CASCADE
      );
    `);

    // 14. Message Reactions
    await sqliteClient.execute(`
      CREATE TABLE IF NOT EXISTS message_reactions (
        id TEXT PRIMARY KEY,
        messageId TEXT NOT NULL,
        userId TEXT NOT NULL,
        emoji TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        UNIQUE(messageId, userId, emoji),
        FOREIGN KEY (messageId) REFERENCES messages(id) ON DELETE CASCADE,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // 15. Conversation Reads (tracks read progress per conversation)
    await sqliteClient.execute(`
      CREATE TABLE IF NOT EXISTS conversation_reads (
        id TEXT PRIMARY KEY,
        conversationId TEXT NOT NULL,
        userId TEXT NOT NULL,
        lastReadMessageId TEXT,
        lastReadAt TEXT NOT NULL,
        UNIQUE(conversationId, userId),
        FOREIGN KEY (conversationId) REFERENCES conversations(id) ON DELETE CASCADE,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // 16. Assistant Memories (persistent memories stored by Ask Homely)
    await sqliteClient.execute(`
      CREATE TABLE IF NOT EXISTS assistant_memories (
        id TEXT PRIMARY KEY,
        homeId TEXT NOT NULL,
        creatorId TEXT NOT NULL,
        key TEXT NOT NULL,
        content TEXT NOT NULL,
        category TEXT DEFAULT 'general',
        createdAt TEXT NOT NULL,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (homeId) REFERENCES homes(id) ON DELETE CASCADE,
        FOREIGN KEY (creatorId) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // 17. Ask Homely Messages (conversation history)
    await sqliteClient.execute(`
      CREATE TABLE IF NOT EXISTS ask_homely_messages (
        id TEXT PRIMARY KEY,
        homeId TEXT NOT NULL,
        userId TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        source TEXT,
        actionPending TEXT,
        actionResult TEXT,
        results TEXT,
        sources TEXT,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (homeId) REFERENCES homes(id) ON DELETE CASCADE,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // 18. Notification Preferences
    await sqliteClient.execute(`
      CREATE TABLE IF NOT EXISTS notification_preferences (
        userId TEXT PRIMARY KEY,
        messages INTEGER NOT NULL DEFAULT 1,
        feedActivity INTEGER NOT NULL DEFAULT 1,
        events INTEGER NOT NULL DEFAULT 1,
        memories INTEGER NOT NULL DEFAULT 1,
        familyActivity INTEGER NOT NULL DEFAULT 1,
        askHomely INTEGER NOT NULL DEFAULT 1,
        browserPush INTEGER NOT NULL DEFAULT 0,
        updatedAt TEXT NOT NULL,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    // Safe column additions for modern chat & notification features
    const safeAddColumn = async (table: string, colDef: string) => {
      try {
        await sqliteClient.execute(`ALTER TABLE ${table} ADD COLUMN ${colDef}`);
      } catch {
        // column already exists
      }
    };
    await safeAddColumn('messages', 'mediaType TEXT');
    await safeAddColumn('messages', 'mediaName TEXT');
    await safeAddColumn('messages', 'mediaSize INTEGER');
    await safeAddColumn('messages', 'mediaDuration REAL');
    await safeAddColumn('messages', 'isPinned INTEGER DEFAULT 0');
    await safeAddColumn('messages', 'pinnedAt TEXT');
    await safeAddColumn('messages', 'pinnedBy TEXT');
    await safeAddColumn('messages', 'isEdited INTEGER DEFAULT 0');
    await safeAddColumn('messages', 'editedAt TEXT');
    await safeAddColumn('messages', 'extraData TEXT');
    await safeAddColumn('users', 'lastActiveAt TEXT');
    await safeAddColumn('notifications', 'targetType TEXT');
    await safeAddColumn('notifications', 'targetId TEXT');
    await safeAddColumn('notifications', 'metadata TEXT');

    // Memory comments & reactions tables
    await sqliteClient.execute(`
      CREATE TABLE IF NOT EXISTS memory_comments (
        id TEXT PRIMARY KEY,
        memoryId TEXT NOT NULL,
        authorId TEXT NOT NULL,
        content TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        FOREIGN KEY (memoryId) REFERENCES memories(id) ON DELETE CASCADE,
        FOREIGN KEY (authorId) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    await sqliteClient.execute(`
      CREATE TABLE IF NOT EXISTS memory_reactions (
        id TEXT PRIMARY KEY,
        memoryId TEXT NOT NULL,
        userId TEXT NOT NULL,
        emoji TEXT NOT NULL,
        createdAt TEXT NOT NULL,
        UNIQUE(memoryId, userId, emoji),
        FOREIGN KEY (memoryId) REFERENCES memories(id) ON DELETE CASCADE,
        FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
      );
    `);

    await safeAddColumn('memories', 'images TEXT');
    await safeAddColumn('memories', 'location TEXT');
    await safeAddColumn('memories', 'taggedMemberIds TEXT');
    await safeAddColumn('memories', 'updatedAt TEXT');

    // Indexes for fast lookup
    await sqliteClient.execute('CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);');
    await sqliteClient.execute('CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);');
    await sqliteClient.execute('CREATE INDEX IF NOT EXISTS idx_homes_inviteCode ON homes(inviteCode);');
    await sqliteClient.execute('CREATE INDEX IF NOT EXISTS idx_home_members_home ON home_members(homeId);');
    await sqliteClient.execute('CREATE INDEX IF NOT EXISTS idx_home_members_user ON home_members(userId);');
    await sqliteClient.execute('CREATE INDEX IF NOT EXISTS idx_posts_home ON posts(homeId);');
    await sqliteClient.execute('CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(postId);');
    await sqliteClient.execute('CREATE INDEX IF NOT EXISTS idx_reactions_post ON reactions(postId);');
    await sqliteClient.execute('CREATE INDEX IF NOT EXISTS idx_conversations_home ON conversations(homeId);');
    await sqliteClient.execute('CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversationId);');
    await sqliteClient.execute('CREATE INDEX IF NOT EXISTS idx_msg_reactions_msg ON message_reactions(messageId);');
    await sqliteClient.execute('CREATE INDEX IF NOT EXISTS idx_conv_reads_user ON conversation_reads(userId);');
    await sqliteClient.execute('CREATE INDEX IF NOT EXISTS idx_conv_reads_conv ON conversation_reads(conversationId);');
    await sqliteClient.execute('CREATE INDEX IF NOT EXISTS idx_events_home ON events(homeId);');
    await sqliteClient.execute('CREATE INDEX IF NOT EXISTS idx_memories_home ON memories(homeId);');
    await sqliteClient.execute('CREATE INDEX IF NOT EXISTS idx_vault_home ON vault_files(homeId);');
    await sqliteClient.execute('CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipientId);');
    await sqliteClient.execute('CREATE INDEX IF NOT EXISTS idx_notifications_home ON notifications(homeId);');
    await sqliteClient.execute('CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(recipientId, read);');
    await sqliteClient.execute('CREATE INDEX IF NOT EXISTS idx_assistant_memories_home ON assistant_memories(homeId);');
    await sqliteClient.execute('CREATE INDEX IF NOT EXISTS idx_ask_homely_home_user ON ask_homely_messages(homeId, userId);');

    // Run Migration from Legacy JSON file if database is new
    await migrateFromJsonIfEmpty();
  } catch (err) {
    console.error('Fatal error initializing SQLite database:', err);
    throw err;
  }
}

async function migrateFromJsonIfEmpty(): Promise<void> {
  const usersCountRes = await sqliteClient.execute('SELECT COUNT(*) as count FROM users');
  const userCount = Number(usersCountRes.rows[0]?.count || 0);

  if (userCount === 0 && fs.existsSync(LEGACY_JSON_FILE)) {
    try {
      console.log('Migrating existing data from homely.db.json into SQLite database...');
      const raw = fs.readFileSync(LEGACY_JSON_FILE, 'utf-8');
      const legacy = JSON.parse(raw);

      // Migrate Users
      if (Array.isArray(legacy.users)) {
        for (const u of legacy.users) {
          await sqliteClient.execute({
            sql: `INSERT OR IGNORE INTO users (id, name, email, passwordHash, salt, avatar, createdAt)
                  VALUES (?, ?, ?, ?, ?, ?, ?)`,
            args: [u.id, u.name, u.email, u.passwordHash, u.salt, u.avatar || '', u.createdAt]
          });
        }
      }

      // Migrate Sessions
      if (Array.isArray(legacy.sessions)) {
        for (const s of legacy.sessions) {
          await sqliteClient.execute({
            sql: `INSERT OR IGNORE INTO sessions (token, userId, expiresAt)
                  VALUES (?, ?, ?)`,
            args: [s.token, s.userId, s.expiresAt]
          });
        }
      }

      // Migrate Homes
      if (Array.isArray(legacy.homes)) {
        for (const h of legacy.homes) {
          await sqliteClient.execute({
            sql: `INSERT OR IGNORE INTO homes (id, name, description, avatar, inviteCode, ownerId, createdAt)
                  VALUES (?, ?, ?, ?, ?, ?, ?)`,
            args: [h.id, h.name, h.description || '', h.avatar || '', h.inviteCode, h.ownerId, h.createdAt]
          });
        }
      }

      // Migrate Home Members
      if (Array.isArray(legacy.home_members)) {
        for (const m of legacy.home_members) {
          await sqliteClient.execute({
            sql: `INSERT OR IGNORE INTO home_members (id, homeId, userId, role, joinedAt)
                  VALUES (?, ?, ?, ?, ?)`,
            args: [m.id, m.homeId, m.userId, m.role, m.joinedAt]
          });
        }
      }

      // Migrate Posts
      if (Array.isArray(legacy.posts)) {
        for (const p of legacy.posts) {
          await sqliteClient.execute({
            sql: `INSERT OR IGNORE INTO posts (id, homeId, authorId, content, type, imageUrl, createdAt)
                  VALUES (?, ?, ?, ?, ?, ?, ?)`,
            args: [p.id, p.homeId, p.authorId, p.content, p.type, p.imageUrl || null, p.createdAt]
          });
        }
      }

      // Migrate Comments
      if (Array.isArray(legacy.comments)) {
        for (const c of legacy.comments) {
          await sqliteClient.execute({
            sql: `INSERT OR IGNORE INTO comments (id, postId, authorId, content, createdAt)
                  VALUES (?, ?, ?, ?, ?)`,
            args: [c.id, c.postId, c.authorId, c.content, c.createdAt]
          });
        }
      }

      // Migrate Reactions
      if (Array.isArray(legacy.reactions)) {
        for (const r of legacy.reactions) {
          await sqliteClient.execute({
            sql: `INSERT OR IGNORE INTO reactions (id, postId, userId, emoji, createdAt)
                  VALUES (?, ?, ?, ?, ?)`,
            args: [r.id, r.postId, r.userId, r.emoji, r.createdAt]
          });
        }
      }

      // Migrate Conversations
      if (Array.isArray(legacy.conversations)) {
        for (const c of legacy.conversations) {
          await sqliteClient.execute({
            sql: `INSERT OR IGNORE INTO conversations (id, homeId, type, participantIds, createdAt, updatedAt)
                  VALUES (?, ?, ?, ?, ?, ?)`,
            args: [c.id, c.homeId, c.type, JSON.stringify(c.participantIds || []), c.createdAt, c.updatedAt || c.createdAt]
          });
        }
      }

      // Migrate Messages
      if (Array.isArray(legacy.messages)) {
        for (const m of legacy.messages) {
          await sqliteClient.execute({
            sql: `INSERT OR IGNORE INTO messages (id, conversationId, senderId, content, replyToId, mediaUrl, createdAt)
                  VALUES (?, ?, ?, ?, ?, ?, ?)`,
            args: [m.id, m.conversationId, m.senderId, m.content, m.replyToId || null, m.mediaUrl || null, m.createdAt]
          });
        }
      }

      // Migrate Events
      if (Array.isArray(legacy.events)) {
        for (const e of legacy.events) {
          await sqliteClient.execute({
            sql: `INSERT OR IGNORE INTO events (id, homeId, creatorId, title, description, date, time, location, attendeeIds, createdAt)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [e.id, e.homeId, e.creatorId, e.title, e.description || '', e.date, e.time || '18:00', e.location || null, JSON.stringify(e.attendeeIds || []), e.createdAt]
          });
        }
      }

      // Migrate Memories
      if (Array.isArray(legacy.memories)) {
        for (const m of legacy.memories) {
          await sqliteClient.execute({
            sql: `INSERT OR IGNORE INTO memories (id, homeId, creatorId, title, story, date, imageUrl, createdAt)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [m.id, m.homeId, m.creatorId, m.title, m.story, m.date, m.imageUrl || null, m.createdAt]
          });
        }
      }

      // Migrate Vault Files
      if (Array.isArray(legacy.vault_files)) {
        for (const vf of legacy.vault_files) {
          await sqliteClient.execute({
            sql: `INSERT OR IGNORE INTO vault_files (id, homeId, uploaderId, title, category, description, contentOrUrl, createdAt)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [vf.id, vf.homeId, vf.uploaderId, vf.title, vf.category, vf.description || '', vf.contentOrUrl, vf.createdAt]
          });
        }
      }

      // Migrate Notifications
      if (Array.isArray(legacy.notifications)) {
        for (const n of legacy.notifications) {
          await sqliteClient.execute({
            sql: `INSERT OR IGNORE INTO notifications (id, homeId, recipientId, senderId, type, title, body, read, createdAt)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [n.id, n.homeId, n.recipientId, n.senderId, n.type, n.title, n.body, n.read ? 1 : 0, n.createdAt]
          });
        }
      }

      console.log('Successfully completed data migration to SQLite database!');
    } catch (migErr) {
      console.error('Error during JSON to SQLite migration:', migErr);
    }
  }
}

// -------------------------------------------------------------
// Cryptography & Auth Helpers
// -------------------------------------------------------------
export function hashPassword(password: string, salt?: string): { hash: string; salt: string } {
  const chosenSalt = salt || crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, chosenSalt, 64).toString('hex');
  return { hash, salt: chosenSalt };
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const computed = crypto.scryptSync(password, salt, 64).toString('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(computed, 'hex'));
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

export function generateInviteCode(prefix: string): string {
  const clean = prefix.replace(/[^a-zA-Z]/g, '').slice(0, 4).toUpperCase() || 'HOME';
  const randNum = Math.floor(1000 + Math.random() * 9000);
  return `${clean}-${randNum}`;
}

// -------------------------------------------------------------
// USER & SESSION REPOSITORY
// -------------------------------------------------------------
export async function getUserByEmail(email: string): Promise<User | null> {
  await ensureDbReady();
  const res = await sqliteClient.execute({
    sql: 'SELECT * FROM users WHERE email = ? COLLATE NOCASE LIMIT 1',
    args: [email.trim()]
  });
  if (res.rows.length === 0) return null;
  return res.rows[0] as unknown as User;
}

export async function getUserById(id: string): Promise<User | null> {
  await ensureDbReady();
  const res = await sqliteClient.execute({
    sql: 'SELECT * FROM users WHERE id = ? LIMIT 1',
    args: [id]
  });
  if (res.rows.length === 0) return null;
  return res.rows[0] as unknown as User;
}

export async function createUser(user: User): Promise<User> {
  await ensureDbReady();
  await sqliteClient.execute({
    sql: `INSERT INTO users (id, name, email, passwordHash, salt, avatar, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [user.id, user.name, user.email, user.passwordHash, user.salt, user.avatar || '', user.createdAt]
  });
  return user;
}

export async function updateUserProfile(id: string, name?: string, avatar?: string): Promise<User | null> {
  await ensureDbReady();
  const user = await getUserById(id);
  if (!user) return null;

  const newName = name && name.trim() ? name.trim() : user.name;
  const newAvatar = avatar !== undefined ? avatar.trim() : user.avatar;

  await sqliteClient.execute({
    sql: 'UPDATE users SET name = ?, avatar = ? WHERE id = ?',
    args: [newName, newAvatar, id]
  });

  return {
    ...user,
    name: newName,
    avatar: newAvatar
  };
}

export async function createSession(userId: string): Promise<Session> {
  await ensureDbReady();
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  await sqliteClient.execute({
    sql: 'INSERT INTO sessions (token, userId, expiresAt) VALUES (?, ?, ?)',
    args: [token, userId, expiresAt]
  });
  return { token, userId, expiresAt };
}

export async function removeSession(token: string): Promise<void> {
  await ensureDbReady();
  await sqliteClient.execute({
    sql: 'DELETE FROM sessions WHERE token = ?',
    args: [token]
  });
}

export async function getUserByToken(token: string): Promise<User | null> {
  await ensureDbReady();
  const res = await sqliteClient.execute({
    sql: `SELECT u.*, s.expiresAt as sessionExpiresAt
          FROM sessions s
          JOIN users u ON u.id = s.userId
          WHERE s.token = ? LIMIT 1`,
    args: [token]
  });
  if (res.rows.length === 0) return null;

  const row = res.rows[0];
  const expiresAt = new Date(row.sessionExpiresAt as string);
  if (expiresAt < new Date()) {
    // expired session cleanup
    await removeSession(token);
    return null;
  }

  return {
    id: row.id as string,
    name: row.name as string,
    email: row.email as string,
    passwordHash: row.passwordHash as string,
    salt: row.salt as string,
    avatar: row.avatar as string,
    createdAt: row.createdAt as string
  };
}

// -------------------------------------------------------------
// HOMES & MEMBERSHIP REPOSITORY
// -------------------------------------------------------------
export async function getHomeById(homeId: string): Promise<Home | null> {
  await ensureDbReady();
  const res = await sqliteClient.execute({
    sql: 'SELECT * FROM homes WHERE id = ? LIMIT 1',
    args: [homeId]
  });
  if (res.rows.length === 0) return null;
  return res.rows[0] as unknown as Home;
}

export async function getHomeByInviteCode(inviteCode: string): Promise<Home | null> {
  await ensureDbReady();
  const res = await sqliteClient.execute({
    sql: 'SELECT * FROM homes WHERE inviteCode = ? COLLATE NOCASE LIMIT 1',
    args: [inviteCode.trim().toUpperCase()]
  });
  if (res.rows.length === 0) return null;
  return res.rows[0] as unknown as Home;
}

export async function createHome(home: Home): Promise<Home> {
  await ensureDbReady();
  await sqliteClient.execute({
    sql: `INSERT INTO homes (id, name, description, avatar, coverImage, icon, themeColor, inviteCode, ownerId, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      home.id,
      home.name,
      home.description,
      home.avatar,
      home.coverImage || 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=1200&auto=format&fit=crop&q=80',
      home.icon || '🏡',
      home.themeColor || '#4f46e5',
      home.inviteCode,
      home.ownerId,
      home.createdAt
    ]
  });
  return home;
}

export async function updateHome(
  homeId: string,
  updates: Partial<Pick<Home, 'name' | 'description' | 'avatar' | 'coverImage' | 'icon' | 'themeColor'>>
): Promise<Home | null> {
  await ensureDbReady();
  const current = await getHomeById(homeId);
  if (!current) return null;

  const newName = updates.name !== undefined ? updates.name.trim() : current.name;
  const newDesc = updates.description !== undefined ? updates.description.trim() : current.description;
  const newAvatar = updates.avatar !== undefined ? updates.avatar.trim() : current.avatar;
  const newCoverImage = updates.coverImage !== undefined ? updates.coverImage.trim() : (current.coverImage || 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=1200&auto=format&fit=crop&q=80');
  const newIcon = updates.icon !== undefined ? updates.icon.trim() : (current.icon || '🏡');
  const newThemeColor = updates.themeColor !== undefined ? updates.themeColor.trim() : (current.themeColor || '#4f46e5');

  await sqliteClient.execute({
    sql: `UPDATE homes 
          SET name = ?, description = ?, avatar = ?, coverImage = ?, icon = ?, themeColor = ?
          WHERE id = ?`,
    args: [newName, newDesc, newAvatar, newCoverImage, newIcon, newThemeColor, homeId]
  });

  return getHomeById(homeId);
}

export async function regenerateHomeInviteCode(homeId: string): Promise<Home | null> {
  await ensureDbReady();
  const current = await getHomeById(homeId);
  if (!current) return null;

  const newCode = generateInviteCode(current.name);
  await sqliteClient.execute({
    sql: 'UPDATE homes SET inviteCode = ? WHERE id = ?',
    args: [newCode, homeId]
  });
  return getHomeById(homeId);
}

export async function updateHomeMemberRole(homeId: string, userId: string, role: UserRole): Promise<boolean> {
  await ensureDbReady();
  const res = await sqliteClient.execute({
    sql: 'UPDATE home_members SET role = ? WHERE homeId = ? AND userId = ?',
    args: [role, homeId, userId]
  });
  return (res.rowsAffected || 0) > 0;
}

export async function removeHomeMember(homeId: string, userId: string): Promise<boolean> {
  await ensureDbReady();
  const res = await sqliteClient.execute({
    sql: 'DELETE FROM home_members WHERE homeId = ? AND userId = ?',
    args: [homeId, userId]
  });
  return (res.rowsAffected || 0) > 0;
}

export async function getUserHomes(userId: string): Promise<Home[]> {
  await ensureDbReady();
  const res = await sqliteClient.execute({
    sql: `SELECT h.*
          FROM home_members hm
          JOIN homes h ON h.id = hm.homeId
          WHERE hm.userId = ?
          ORDER BY hm.joinedAt ASC`,
    args: [userId]
  });
  return res.rows as unknown as Home[];
}

export async function isUserInHome(userId: string, homeId: string): Promise<boolean> {
  await ensureDbReady();
  const res = await sqliteClient.execute({
    sql: 'SELECT 1 FROM home_members WHERE userId = ? AND homeId = ? LIMIT 1',
    args: [userId, homeId]
  });
  return res.rows.length > 0;
}

export async function getUserRoleInHome(userId: string, homeId: string): Promise<UserRole | null> {
  await ensureDbReady();
  const res = await sqliteClient.execute({
    sql: 'SELECT role FROM home_members WHERE userId = ? AND homeId = ? LIMIT 1',
    args: [userId, homeId]
  });
  if (res.rows.length === 0) return null;
  return res.rows[0].role as UserRole;
}

export async function addHomeMember(member: HomeMember): Promise<HomeMember> {
  await ensureDbReady();
  await sqliteClient.execute({
    sql: `INSERT INTO home_members (id, homeId, userId, role, joinedAt)
          VALUES (?, ?, ?, ?, ?)`,
    args: [member.id, member.homeId, member.userId, member.role, member.joinedAt]
  });
  return member;
}

export async function getHomeMembers(homeId: string) {
  await ensureDbReady();
  const res = await sqliteClient.execute({
    sql: `SELECT hm.id, hm.homeId, hm.userId, hm.role, hm.joinedAt,
                 u.name, u.email, u.avatar
          FROM home_members hm
          JOIN users u ON u.id = hm.userId
          WHERE hm.homeId = ?
          ORDER BY hm.joinedAt ASC`,
    args: [homeId]
  });
  return res.rows.map(r => ({
    id: r.id as string,
    homeId: r.homeId as string,
    userId: r.userId as string,
    role: r.role as UserRole,
    joinedAt: r.joinedAt as string,
    name: (r.name as string) || 'Unknown',
    email: (r.email as string) || '',
    avatar: (r.avatar as string) || ''
  }));
}

// -------------------------------------------------------------
// POSTS & FEED REPOSITORY
// -------------------------------------------------------------
export async function getPostsForHome(homeId: string, currentUserId: string) {
  await ensureDbReady();

  const postsRes = await sqliteClient.execute({
    sql: `SELECT p.*, u.name as authorName, u.email as authorEmail, u.avatar as authorAvatar
          FROM posts p
          LEFT JOIN users u ON u.id = p.authorId
          WHERE p.homeId = ?
          ORDER BY p.createdAt DESC`,
    args: [homeId]
  });

  const posts = postsRes.rows;
  if (posts.length === 0) return [];

  const postIds = posts.map(p => `'${p.id}'`).join(',');

  // Fetch comments for all posts
  const commentsRes = await sqliteClient.execute(`
    SELECT c.*, u.name as authorName, u.email as authorEmail, u.avatar as authorAvatar
    FROM comments c
    LEFT JOIN users u ON u.id = c.authorId
    WHERE c.postId IN (${postIds})
    ORDER BY c.createdAt ASC
  `);

  // Fetch reactions for all posts
  const reactionsRes = await sqliteClient.execute(`
    SELECT * FROM reactions WHERE postId IN (${postIds})
  `);

  const commentsByPost: Record<string, any[]> = {};
  for (const c of commentsRes.rows) {
    const pId = c.postId as string;
    if (!commentsByPost[pId]) commentsByPost[pId] = [];
    commentsByPost[pId].push({
      id: c.id,
      content: c.content,
      createdAt: c.createdAt,
      author: {
        id: c.authorId,
        name: c.authorName || 'Family Member',
        email: c.authorEmail || '',
        avatar: c.authorAvatar || ''
      }
    });
  }

  const reactionsByPost: Record<string, any[]> = {};
  for (const r of reactionsRes.rows) {
    const pId = r.postId as string;
    if (!reactionsByPost[pId]) reactionsByPost[pId] = [];
    reactionsByPost[pId].push(r);
  }

  return posts.map(p => {
    const pId = p.id as string;
    const postReactions = reactionsByPost[pId] || [];

    const reactionCounts: Record<string, { count: number; userIds: string[]; hasReacted: boolean }> = {};
    postReactions.forEach(r => {
      const emoji = r.emoji as string;
      const uId = r.userId as string;
      if (!reactionCounts[emoji]) {
        reactionCounts[emoji] = { count: 0, userIds: [], hasReacted: false };
      }
      reactionCounts[emoji].count += 1;
      reactionCounts[emoji].userIds.push(uId);
      if (uId === currentUserId) {
        reactionCounts[emoji].hasReacted = true;
      }
    });

    return {
      id: p.id as string,
      content: p.content as string,
      type: p.type as string,
      imageUrl: (p.imageUrl as string) || undefined,
      createdAt: p.createdAt as string,
      author: {
        id: p.authorId as string,
        name: (p.authorName as string) || 'Family Member',
        email: (p.authorEmail as string) || '',
        avatar: (p.authorAvatar as string) || ''
      },
      comments: commentsByPost[pId] || [],
      reactions: reactionCounts
    };
  });
}

export async function getPostCommentAuthorIds(postId: string): Promise<string[]> {
  await ensureDbReady();
  const res = await sqliteClient.execute({
    sql: 'SELECT DISTINCT authorId FROM comments WHERE postId = ?',
    args: [postId]
  });
  return res.rows.map(r => r.authorId as string);
}

export async function createPost(post: Post): Promise<Post> {
  await ensureDbReady();
  await sqliteClient.execute({
    sql: `INSERT INTO posts (id, homeId, authorId, content, type, imageUrl, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [post.id, post.homeId, post.authorId, post.content, post.type, post.imageUrl || null, post.createdAt]
  });
  return post;
}

export async function getPostById(postId: string): Promise<Post | null> {
  await ensureDbReady();
  const res = await sqliteClient.execute({
    sql: 'SELECT * FROM posts WHERE id = ? LIMIT 1',
    args: [postId]
  });
  if (res.rows.length === 0) return null;
  return res.rows[0] as unknown as Post;
}

export async function deletePost(postId: string): Promise<boolean> {
  await ensureDbReady();
  await sqliteClient.execute({
    sql: 'DELETE FROM posts WHERE id = ?',
    args: [postId]
  });
  return true;
}

export async function toggleReaction(postId: string, userId: string, emoji: string): Promise<{ success: boolean; added: boolean }> {
  await ensureDbReady();
  const existingRes = await sqliteClient.execute({
    sql: 'SELECT id FROM reactions WHERE postId = ? AND userId = ? AND emoji = ? LIMIT 1',
    args: [postId, userId, emoji]
  });

  if (existingRes.rows.length > 0) {
    await sqliteClient.execute({
      sql: 'DELETE FROM reactions WHERE postId = ? AND userId = ? AND emoji = ?',
      args: [postId, userId, emoji]
    });
    return { success: true, added: false };
  } else {
    const rxId = `rx_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    await sqliteClient.execute({
      sql: 'INSERT INTO reactions (id, postId, userId, emoji, createdAt) VALUES (?, ?, ?, ?, ?)',
      args: [rxId, postId, userId, emoji, new Date().toISOString()]
    });
    return { success: true, added: true };
  }
}

export async function createComment(comment: PostComment): Promise<PostComment> {
  await ensureDbReady();
  await sqliteClient.execute({
    sql: 'INSERT INTO comments (id, postId, authorId, content, createdAt) VALUES (?, ?, ?, ?, ?)',
    args: [comment.id, comment.postId, comment.authorId, comment.content, comment.createdAt]
  });
  return comment;
}

// -------------------------------------------------------------
// CONVERSATIONS & CHAT REPOSITORY
// -------------------------------------------------------------
export async function getConversationsForUser(homeId: string, userId: string) {
  await ensureDbReady();

  // Find conversations for this home
  const convRes = await sqliteClient.execute({
    sql: 'SELECT * FROM conversations WHERE homeId = ? ORDER BY updatedAt DESC',
    args: [homeId]
  });

  const memberConvRows: Array<{
    id: string;
    homeId: string;
    type: string;
    participantIds: string;
    createdAt: string;
    updatedAt: string;
  }> = convRes.rows
    .map(c => ({
      id: c.id as string,
      homeId: c.homeId as string,
      type: c.type as string,
      participantIds: c.participantIds as string,
      createdAt: c.createdAt as string,
      updatedAt: c.updatedAt as string
    }))
    .filter(c => {
      try {
        const pIds = JSON.parse(c.participantIds);
        return Array.isArray(pIds) && pIds.includes(userId);
      } catch {
        return false;
      }
    });

  // Ensure family conversation exists and user is included
  let familyChat = memberConvRows.find(c => c.type === 'family');
  if (!familyChat) {
    const anyFamily = convRes.rows.find(c => c.type === 'family');
    if (anyFamily) {
      let pIds: string[] = [];
      try {
        pIds = JSON.parse(anyFamily.participantIds as string);
      } catch {
        pIds = [];
      }
      if (!pIds.includes(userId)) {
        pIds.push(userId);
        await sqliteClient.execute({
          sql: 'UPDATE conversations SET participantIds = ? WHERE id = ?',
          args: [JSON.stringify(pIds), anyFamily.id]
        });
      }
      memberConvRows.unshift({
        id: anyFamily.id as string,
        homeId: anyFamily.homeId as string,
        type: anyFamily.type as string,
        participantIds: JSON.stringify(pIds),
        createdAt: anyFamily.createdAt as string,
        updatedAt: anyFamily.updatedAt as string
      });
    } else {
      const members = await getHomeMembers(homeId);
      const famId = `conv_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      const now = new Date().toISOString();
      const pIds = members.map(m => m.userId);
      await sqliteClient.execute({
        sql: 'INSERT INTO conversations (id, homeId, type, participantIds, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
        args: [famId, homeId, 'family', JSON.stringify(pIds), now, now]
      });
      memberConvRows.unshift({
        id: famId,
        homeId,
        type: 'family',
        participantIds: JSON.stringify(pIds),
        createdAt: now,
        updatedAt: now
      });
    }
  }

  // Populate lastMessage & participants for each conversation
  const populated = [];
  const nowTs = Date.now();

  for (const c of memberConvRows) {
    const cId = c.id as string;
    const lastMsgRes = await sqliteClient.execute({
      sql: `SELECT m.*, u.name as senderName
            FROM messages m
            LEFT JOIN users u ON u.id = m.senderId
            WHERE m.conversationId = ?
            ORDER BY m.createdAt DESC LIMIT 1`,
      args: [cId]
    });
    const lastMsg = lastMsgRes.rows[0];

    // Calculate unread count based on conversation_reads
    const readRes = await sqliteClient.execute({
      sql: 'SELECT lastReadAt FROM conversation_reads WHERE conversationId = ? AND userId = ? LIMIT 1',
      args: [cId, userId]
    });
    const lastReadAt = readRes.rows[0]?.lastReadAt as string | undefined;

    let unreadCount = 0;
    if (lastReadAt) {
      const unreadRes = await sqliteClient.execute({
        sql: 'SELECT COUNT(*) as cnt FROM messages WHERE conversationId = ? AND senderId != ? AND createdAt > ?',
        args: [cId, userId, lastReadAt]
      });
      unreadCount = Number(unreadRes.rows[0]?.cnt || 0);
    } else {
      const unreadRes = await sqliteClient.execute({
        sql: 'SELECT COUNT(*) as cnt FROM messages WHERE conversationId = ? AND senderId != ?',
        args: [cId, userId]
      });
      unreadCount = Number(unreadRes.rows[0]?.cnt || 0);
    }

    // Pinned messages count
    const pinnedRes = await sqliteClient.execute({
      sql: 'SELECT COUNT(*) as cnt FROM messages WHERE conversationId = ? AND isPinned = 1',
      args: [cId]
    });
    const pinnedCount = Number(pinnedRes.rows[0]?.cnt || 0);

    let pIds: string[] = [];
    try {
      pIds = JSON.parse(c.participantIds as string);
    } catch {
      pIds = [];
    }

    const participants = [];
    for (const pid of pIds) {
      const u = await getUserById(pid);
      const isOnline = !!(u?.lastActiveAt && (nowTs - new Date(u.lastActiveAt).getTime() < 60000));
      participants.push(
        u
          ? { id: u.id, name: u.name, email: u.email, avatar: u.avatar, isOnline, lastActiveAt: u.lastActiveAt }
          : { id: pid, name: 'Family Member', email: '', avatar: '', isOnline: false }
      );
    }

    const otherParticipant = c.type === 'direct' ? participants.find(p => p.id !== userId) : null;

    populated.push({
      id: c.id as string,
      type: c.type as 'family' | 'direct',
      homeId: c.homeId as string,
      name: c.type === 'family' ? 'Family Living Room' : (otherParticipant?.name || 'Direct Chat'),
      avatar: c.type === 'family' ? '' : (otherParticipant?.avatar || ''),
      participants,
      unreadCount,
      pinnedCount,
      isOnline: c.type === 'direct' ? otherParticipant?.isOnline : undefined,
      lastActiveAt: c.type === 'direct' ? otherParticipant?.lastActiveAt : undefined,
      lastMessage: lastMsg ? {
        id: lastMsg.id as string,
        content: lastMsg.content as string,
        senderId: lastMsg.senderId as string,
        senderName: (lastMsg.senderName as string) || undefined,
        mediaType: (lastMsg.mediaType as string) || undefined,
        createdAt: lastMsg.createdAt as string
      } : null,
      updatedAt: c.updatedAt as string
    });
  }

  // Sort so Family Living Room is top, then by most recent activity
  populated.sort((a, b) => {
    if (a.type === 'family') return -1;
    if (b.type === 'family') return 1;
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
  });

  return populated;
}

export async function findDirectConversation(homeId: string, userA: string, userB: string): Promise<Conversation | null> {
  await ensureDbReady();
  const res = await sqliteClient.execute({
    sql: "SELECT * FROM conversations WHERE homeId = ? AND type = 'direct'",
    args: [homeId]
  });

  for (const row of res.rows) {
    try {
      const pIds = JSON.parse(row.participantIds as string);
      if (Array.isArray(pIds) && pIds.includes(userA) && pIds.includes(userB)) {
        return {
          id: row.id as string,
          homeId: row.homeId as string,
          type: 'direct',
          participantIds: pIds,
          createdAt: row.createdAt as string,
          updatedAt: row.updatedAt as string
        };
      }
    } catch {
      // skip
    }
  }
  return null;
}

export async function createConversation(conv: Conversation): Promise<Conversation> {
  await ensureDbReady();
  await sqliteClient.execute({
    sql: 'INSERT INTO conversations (id, homeId, type, participantIds, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?)',
    args: [conv.id, conv.homeId, conv.type, JSON.stringify(conv.participantIds), conv.createdAt, conv.updatedAt]
  });
  return conv;
}

export async function getConversationById(convId: string): Promise<Conversation | null> {
  await ensureDbReady();
  const res = await sqliteClient.execute({
    sql: 'SELECT * FROM conversations WHERE id = ? LIMIT 1',
    args: [convId]
  });
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  let pIds: string[] = [];
  try {
    pIds = JSON.parse(row.participantIds as string);
  } catch {
    pIds = [];
  }
  return {
    id: row.id as string,
    homeId: row.homeId as string,
    type: row.type as 'family' | 'direct',
    participantIds: pIds,
    createdAt: row.createdAt as string,
    updatedAt: row.updatedAt as string
  };
}

export async function addParticipantToConversation(convId: string, userId: string): Promise<void> {
  await ensureDbReady();
  const conv = await getConversationById(convId);
  if (!conv) return;
  if (!conv.participantIds.includes(userId)) {
    conv.participantIds.push(userId);
    await sqliteClient.execute({
      sql: 'UPDATE conversations SET participantIds = ? WHERE id = ?',
      args: [JSON.stringify(conv.participantIds), convId]
    });
  }
}

export async function getMessages(conversationId: string, currentUserId: string) {
  await ensureDbReady();
  const now = new Date().toISOString();

  // 1. Fetch raw messages
  const res = await sqliteClient.execute({
    sql: `SELECT m.*, u.name as senderName, u.email as senderEmail, u.avatar as senderAvatar
          FROM messages m
          LEFT JOIN users u ON u.id = m.senderId
          WHERE m.conversationId = ?
          ORDER BY m.createdAt ASC`,
    args: [conversationId]
  });

  const rawMessages = res.rows;

  // 2. Mark this conversation as read for current user
  if (rawMessages.length > 0) {
    const latestMsg = rawMessages[rawMessages.length - 1];
    const readId = `cr_${conversationId}_${currentUserId}`;
    await sqliteClient.execute({
      sql: `INSERT INTO conversation_reads (id, conversationId, userId, lastReadMessageId, lastReadAt)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(conversationId, userId) DO UPDATE SET
              lastReadMessageId = excluded.lastReadMessageId,
              lastReadAt = excluded.lastReadAt`,
      args: [readId, conversationId, currentUserId, latestMsg.id as string, now]
    });
  }

  // 3. Fetch conversation type and other reads for delivery/seen status
  const conv = await getConversationById(conversationId);
  const readsRes = await sqliteClient.execute({
    sql: `SELECT cr.*, u.name as userName, u.avatar as userAvatar
          FROM conversation_reads cr
          LEFT JOIN users u ON u.id = cr.userId
          WHERE cr.conversationId = ?`,
    args: [conversationId]
  });
  const allReads = readsRes.rows;

  // 4. Fetch reactions for these messages
  const msgIds = rawMessages.map(m => m.id as string);
  const reactionsByMsg: Record<string, Record<string, { emoji: string; count: number; users: string[]; hasReacted: boolean }>> = {};

  if (msgIds.length > 0) {
    // query reactions in chunks if needed, or query all for conversation
    const reactionsRes = await sqliteClient.execute({
      sql: `SELECT mr.* FROM message_reactions mr
            JOIN messages m ON m.id = mr.messageId
            WHERE m.conversationId = ?`,
      args: [conversationId]
    });

    for (const r of reactionsRes.rows) {
      const mid = r.messageId as string;
      const emoji = r.emoji as string;
      const uid = r.userId as string;
      if (!reactionsByMsg[mid]) reactionsByMsg[mid] = {};
      if (!reactionsByMsg[mid][emoji]) {
        reactionsByMsg[mid][emoji] = { emoji, count: 0, users: [], hasReacted: false };
      }
      reactionsByMsg[mid][emoji].count++;
      reactionsByMsg[mid][emoji].users.push(uid);
      if (uid === currentUserId) {
        reactionsByMsg[mid][emoji].hasReacted = true;
      }
    }
  }

  // 5. Fetch reply targets for messages that reply to another message
  const replyIds = rawMessages
    .map(m => m.replyToId as string)
    .filter(Boolean);

  const repliesMap: Record<string, { id: string; senderName: string; content: string; mediaType?: string }> = {};
  if (replyIds.length > 0) {
    const placeholders = replyIds.map(() => '?').join(',');
    const replyRes = await sqliteClient.execute({
      sql: `SELECT m.id, m.content, m.mediaType, u.name as senderName
            FROM messages m
            LEFT JOIN users u ON u.id = m.senderId
            WHERE m.id IN (${placeholders})`,
      args: replyIds
    });
    for (const row of replyRes.rows) {
      repliesMap[row.id as string] = {
        id: row.id as string,
        senderName: (row.senderName as string) || 'Family Member',
        content: (row.content as string) || '',
        mediaType: (row.mediaType as string) || undefined
      };
    }
  }

  // 6. Map and return rich messages
  return rawMessages.map(m => {
    const isOwn = m.senderId === currentUserId;
    const mid = m.id as string;
    const createdAt = m.createdAt as string;

    // Reactions array
    const reactionsList = reactionsByMsg[mid] ? Object.values(reactionsByMsg[mid]) : [];

    // Reply info
    const replyTo = m.replyToId ? repliesMap[m.replyToId as string] : undefined;

    // Extra data parsing (polls, locations)
    let poll = undefined;
    let location = undefined;
    if (m.extraData) {
      try {
        const parsed = JSON.parse(m.extraData as string);
        if (m.mediaType === 'poll') poll = parsed;
        if (m.mediaType === 'location') location = parsed;
      } catch {
        // ignore malformed JSON
      }
    }

    // Status: sent, delivered, read
    let status: 'sent' | 'delivered' | 'read' = 'sent';
    let readBy: Array<{ userId: string; name: string; avatar: string; readAt: string }> = [];

    if (conv?.type === 'direct') {
      const otherRead = allReads.find(r => r.userId !== m.senderId);
      if (otherRead && otherRead.lastReadAt && otherRead.lastReadAt >= createdAt) {
        status = 'read';
      } else {
        // Check if recipient is active
        status = 'delivered';
      }
    } else {
      // Family group
      const readers = allReads.filter(r => r.userId !== m.senderId && r.lastReadAt && r.lastReadAt >= createdAt);
      readBy = readers.map(r => ({
        userId: r.userId as string,
        name: (r.userName as string) || 'Family Member',
        avatar: (r.userAvatar as string) || '',
        readAt: r.lastReadAt as string
      }));
      if (readBy.length > 0) status = 'read';
    }

    return {
      id: mid,
      conversationId: m.conversationId as string,
      content: m.content as string,
      replyToId: (m.replyToId as string) || undefined,
      replyTo,
      mediaUrl: (m.mediaUrl as string) || undefined,
      mediaType: (m.mediaType as any) || undefined,
      mediaName: (m.mediaName as string) || undefined,
      mediaSize: m.mediaSize ? Number(m.mediaSize) : undefined,
      mediaDuration: m.mediaDuration ? Number(m.mediaDuration) : undefined,
      isPinned: Number(m.isPinned || 0) === 1,
      pinnedAt: (m.pinnedAt as string) || undefined,
      pinnedBy: (m.pinnedBy as string) || undefined,
      isEdited: Number(m.isEdited || 0) === 1,
      editedAt: (m.editedAt as string) || undefined,
      extraData: (m.extraData as string) || undefined,
      poll,
      location,
      createdAt,
      isOwn,
      sender: {
        id: m.senderId as string,
        name: (m.senderName as string) || 'Family Member',
        avatar: (m.senderAvatar as string) || ''
      },
      reactions: reactionsList,
      status,
      readBy
    };
  });
}

export async function getMessageById(messageId: string): Promise<Message | null> {
  await ensureDbReady();
  const res = await sqliteClient.execute({
    sql: 'SELECT * FROM messages WHERE id = ? LIMIT 1',
    args: [messageId]
  });
  if (res.rows.length === 0) return null;
  return res.rows[0] as unknown as Message;
}

export async function createMessage(msg: Message): Promise<Message> {
  await ensureDbReady();
  await sqliteClient.execute({
    sql: `INSERT INTO messages (
      id, conversationId, senderId, content, replyToId, mediaUrl,
      mediaType, mediaName, mediaSize, mediaDuration, isPinned, pinnedAt, pinnedBy,
      isEdited, editedAt, extraData, createdAt
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      msg.id,
      msg.conversationId,
      msg.senderId,
      msg.content,
      msg.replyToId || null,
      msg.mediaUrl || null,
      msg.mediaType || null,
      msg.mediaName || null,
      msg.mediaSize || null,
      msg.mediaDuration || null,
      msg.isPinned ? 1 : 0,
      msg.pinnedAt || null,
      msg.pinnedBy || null,
      msg.isEdited ? 1 : 0,
      msg.editedAt || null,
      msg.extraData || null,
      msg.createdAt
    ]
  });

  // update conversation updatedAt timestamp
  await sqliteClient.execute({
    sql: 'UPDATE conversations SET updatedAt = ? WHERE id = ?',
    args: [msg.createdAt, msg.conversationId]
  });

  return msg;
}

export async function updateMessage(messageId: string, userId: string, newContent: string): Promise<boolean> {
  await ensureDbReady();
  const res = await sqliteClient.execute({
    sql: 'SELECT * FROM messages WHERE id = ? LIMIT 1',
    args: [messageId]
  });
  if (res.rows.length === 0) return false;
  const msg = res.rows[0];
  if (msg.senderId !== userId) return false;

  const now = new Date().toISOString();
  await sqliteClient.execute({
    sql: 'UPDATE messages SET content = ?, isEdited = 1, editedAt = ? WHERE id = ?',
    args: [newContent, now, messageId]
  });
  return true;
}

export async function deleteMessage(messageId: string, userId: string, homeId: string): Promise<boolean> {
  await ensureDbReady();
  const res = await sqliteClient.execute({
    sql: 'SELECT * FROM messages WHERE id = ? LIMIT 1',
    args: [messageId]
  });
  if (res.rows.length === 0) return false;
  const msg = res.rows[0];
  const role = await getUserRoleInHome(userId, homeId);
  const isOwnerOrAdmin = role === 'owner' || role === 'admin';
  if (msg.senderId !== userId && !isOwnerOrAdmin) return false;

  await sqliteClient.execute({
    sql: 'DELETE FROM messages WHERE id = ?',
    args: [messageId]
  });
  await sqliteClient.execute({
    sql: 'DELETE FROM message_reactions WHERE messageId = ?',
    args: [messageId]
  });
  return true;
}

export async function toggleMessageReaction(messageId: string, userId: string, emoji: string) {
  await ensureDbReady();
  const existing = await sqliteClient.execute({
    sql: 'SELECT id FROM message_reactions WHERE messageId = ? AND userId = ? AND emoji = ? LIMIT 1',
    args: [messageId, userId, emoji]
  });

  if (existing.rows.length > 0) {
    await sqliteClient.execute({
      sql: 'DELETE FROM message_reactions WHERE messageId = ? AND userId = ? AND emoji = ?',
      args: [messageId, userId, emoji]
    });
  } else {
    const id = `mr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    await sqliteClient.execute({
      sql: 'INSERT INTO message_reactions (id, messageId, userId, emoji, createdAt) VALUES (?, ?, ?, ?, ?)',
      args: [id, messageId, userId, emoji, new Date().toISOString()]
    });
  }

  return getReactionsForMessage(messageId, userId);
}

export async function getReactionsForMessage(messageId: string, currentUserId: string) {
  await ensureDbReady();
  const res = await sqliteClient.execute({
    sql: 'SELECT * FROM message_reactions WHERE messageId = ?',
    args: [messageId]
  });

  const byEmoji: Record<string, { emoji: string; count: number; users: string[]; hasReacted: boolean }> = {};
  for (const row of res.rows) {
    const e = row.emoji as string;
    const uid = row.userId as string;
    if (!byEmoji[e]) {
      byEmoji[e] = { emoji: e, count: 0, users: [], hasReacted: false };
    }
    byEmoji[e].count++;
    byEmoji[e].users.push(uid);
    if (uid === currentUserId) {
      byEmoji[e].hasReacted = true;
    }
  }

  return Object.values(byEmoji);
}

export async function togglePinMessage(messageId: string, homeId: string, userId: string) {
  await ensureDbReady();
  const res = await sqliteClient.execute({
    sql: 'SELECT isPinned FROM messages WHERE id = ? LIMIT 1',
    args: [messageId]
  });
  if (res.rows.length === 0) return null;
  const row = res.rows[0];

  const currentlyPinned = Number(row.isPinned || 0) === 1;
  const newPinned = currentlyPinned ? 0 : 1;
  const now = new Date().toISOString();

  await sqliteClient.execute({
    sql: 'UPDATE messages SET isPinned = ?, pinnedAt = ?, pinnedBy = ? WHERE id = ?',
    args: [newPinned, newPinned ? now : null, newPinned ? userId : null, messageId]
  });

  return {
    id: messageId,
    isPinned: newPinned === 1,
    pinnedAt: newPinned ? now : undefined,
    pinnedBy: newPinned ? userId : undefined
  };
}

export async function getPinnedMessages(conversationId: string, currentUserId: string) {
  await ensureDbReady();
  const res = await sqliteClient.execute({
    sql: `SELECT m.*, u.name as senderName, u.email as senderEmail, u.avatar as senderAvatar
          FROM messages m
          LEFT JOIN users u ON u.id = m.senderId
          WHERE m.conversationId = ? AND m.isPinned = 1
          ORDER BY m.pinnedAt DESC, m.createdAt DESC`,
    args: [conversationId]
  });

  return res.rows.map(m => ({
    id: m.id as string,
    conversationId: m.conversationId as string,
    content: m.content as string,
    mediaUrl: (m.mediaUrl as string) || undefined,
    mediaType: (m.mediaType as any) || undefined,
    mediaName: (m.mediaName as string) || undefined,
    createdAt: m.createdAt as string,
    isPinned: true,
    pinnedAt: (m.pinnedAt as string) || undefined,
    pinnedBy: (m.pinnedBy as string) || undefined,
    isOwn: m.senderId === currentUserId,
    sender: {
      id: m.senderId as string,
      name: (m.senderName as string) || 'Family Member',
      avatar: (m.senderAvatar as string) || ''
    }
  }));
}

export async function searchMessages(conversationId: string, query?: string, date?: string, currentUserId?: string) {
  await ensureDbReady();
  let sql = `SELECT m.*, u.name as senderName, u.email as senderEmail, u.avatar as senderAvatar
             FROM messages m
             LEFT JOIN users u ON u.id = m.senderId
             WHERE m.conversationId = ?`;
  const args: any[] = [conversationId];

  if (query && query.trim()) {
    sql += ` AND LOWER(m.content) LIKE LOWER(?)`;
    args.push(`%${query.trim()}%`);
  }

  if (date && date.trim()) {
    sql += ` AND m.createdAt LIKE ?`;
    args.push(`${date.trim()}%`);
  }

  sql += ` ORDER BY m.createdAt DESC LIMIT 50`;

  const res = await sqliteClient.execute({ sql, args });

  return res.rows.map(m => ({
    id: m.id as string,
    conversationId: m.conversationId as string,
    content: m.content as string,
    replyToId: (m.replyToId as string) || undefined,
    mediaUrl: (m.mediaUrl as string) || undefined,
    mediaType: (m.mediaType as any) || undefined,
    mediaName: (m.mediaName as string) || undefined,
    createdAt: m.createdAt as string,
    isPinned: Number(m.isPinned || 0) === 1,
    isOwn: m.senderId === currentUserId,
    sender: {
      id: m.senderId as string,
      name: (m.senderName as string) || 'Family Member',
      avatar: (m.senderAvatar as string) || ''
    }
  }));
}

export async function votePoll(messageId: string, userId: string, optionId: string) {
  await ensureDbReady();
  const res = await sqliteClient.execute({
    sql: 'SELECT * FROM messages WHERE id = ? LIMIT 1',
    args: [messageId]
  });
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  if (row.mediaType !== 'poll' || !row.extraData) return null;

  let poll: any;
  try {
    poll = JSON.parse(row.extraData as string);
  } catch {
    return null;
  }

  if (!poll || !Array.isArray(poll.options)) return null;

  for (const opt of poll.options) {
    if (!Array.isArray(opt.votes)) opt.votes = [];
    if (opt.id === optionId) {
      if (opt.votes.includes(userId)) {
        opt.votes = opt.votes.filter((uid: string) => uid !== userId);
      } else {
        opt.votes.push(userId);
      }
    } else {
      opt.votes = opt.votes.filter((uid: string) => uid !== userId);
    }
  }

  const updatedExtra = JSON.stringify(poll);
  await sqliteClient.execute({
    sql: 'UPDATE messages SET extraData = ? WHERE id = ?',
    args: [updatedExtra, messageId]
  });

  return poll;
}

// In-memory typing tracker for real-time presence and typing
const typingRegistry = new Map<string, Map<string, { name: string; expiresAt: number }>>();

export async function updateUserHeartbeat(userId: string, conversationId: string, isTyping: boolean) {
  await ensureDbReady();
  const now = new Date().toISOString();
  await sqliteClient.execute({
    sql: 'UPDATE users SET lastActiveAt = ? WHERE id = ?',
    args: [now, userId]
  });

  const user = await getUserById(userId);
  const userName = user?.name || 'Family Member';

  if (!typingRegistry.has(conversationId)) {
    typingRegistry.set(conversationId, new Map());
  }
  const convTyping = typingRegistry.get(conversationId)!;

  const nowTs = Date.now();
  for (const [uid, item] of convTyping.entries()) {
    if (item.expiresAt < nowTs) {
      convTyping.delete(uid);
    }
  }

  if (isTyping) {
    convTyping.set(userId, { name: userName, expiresAt: nowTs + 4000 });
  } else {
    convTyping.delete(userId);
  }

  const activeTypingNames: string[] = [];
  for (const [uid, item] of convTyping.entries()) {
    if (uid !== userId && item.expiresAt >= nowTs) {
      activeTypingNames.push(item.name);
    }
  }

  return {
    typingUsers: activeTypingNames
  };
}

// -------------------------------------------------------------
// EVENTS REPOSITORY
// -------------------------------------------------------------
export async function getEvents(homeId: string, currentUserId: string) {
  await ensureDbReady();
  const res = await sqliteClient.execute({
    sql: `SELECT e.*, u.name as creatorName, u.email as creatorEmail, u.avatar as creatorAvatar
          FROM events e
          LEFT JOIN users u ON u.id = e.creatorId
          WHERE e.homeId = ?
          ORDER BY e.date ASC, e.time ASC`,
    args: [homeId]
  });

  const events = [];
  for (const row of res.rows) {
    let attendeeIds: string[] = [];
    try {
      attendeeIds = JSON.parse(row.attendeeIds as string);
    } catch {
      attendeeIds = [];
    }

    const attendees = [];
    for (const aId of attendeeIds) {
      const u = await getUserById(aId);
      attendees.push(u ? { id: u.id, name: u.name, email: u.email, avatar: u.avatar } : { id: aId, name: 'Member', email: '', avatar: '' });
    }

    events.push({
      id: row.id as string,
      homeId: row.homeId as string,
      creatorId: row.creatorId as string,
      title: row.title as string,
      description: (row.description as string) || '',
      date: row.date as string,
      time: (row.time as string) || '18:00',
      location: (row.location as string) || undefined,
      attendeeIds,
      createdAt: row.createdAt as string,
      isAttending: attendeeIds.includes(currentUserId),
      creator: {
        id: row.creatorId as string,
        name: (row.creatorName as string) || 'Family Member',
        email: (row.creatorEmail as string) || '',
        avatar: (row.creatorAvatar as string) || ''
      },
      attendees
    });
  }

  return events;
}

export async function createEvent(event: FamilyEvent): Promise<FamilyEvent> {
  await ensureDbReady();
  await sqliteClient.execute({
    sql: `INSERT INTO events (id, homeId, creatorId, title, description, date, time, location, attendeeIds, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [event.id, event.homeId, event.creatorId, event.title, event.description, event.date, event.time, event.location || null, JSON.stringify(event.attendeeIds), event.createdAt]
  });
  return event;
}

export async function getEventById(eventId: string): Promise<FamilyEvent | null> {
  await ensureDbReady();
  const res = await sqliteClient.execute({
    sql: 'SELECT * FROM events WHERE id = ? LIMIT 1',
    args: [eventId]
  });
  if (res.rows.length === 0) return null;
  const row = res.rows[0];
  let attendeeIds: string[] = [];
  try {
    attendeeIds = JSON.parse(row.attendeeIds as string);
  } catch {
    attendeeIds = [];
  }
  return {
    id: row.id as string,
    homeId: row.homeId as string,
    creatorId: row.creatorId as string,
    title: row.title as string,
    description: (row.description as string) || '',
    date: row.date as string,
    time: (row.time as string) || '18:00',
    location: (row.location as string) || undefined,
    attendeeIds,
    createdAt: row.createdAt as string
  };
}

export async function toggleEventRsvp(eventId: string, userId: string): Promise<{ success: boolean; isAttending: boolean; attendeeCount: number } | null> {
  await ensureDbReady();
  const event = await getEventById(eventId);
  if (!event) return null;

  const idx = event.attendeeIds.indexOf(userId);
  let isAttending = false;
  if (idx >= 0) {
    event.attendeeIds.splice(idx, 1);
    isAttending = false;
  } else {
    event.attendeeIds.push(userId);
    isAttending = true;
  }

  await sqliteClient.execute({
    sql: 'UPDATE events SET attendeeIds = ? WHERE id = ?',
    args: [JSON.stringify(event.attendeeIds), eventId]
  });

  return {
    success: true,
    isAttending,
    attendeeCount: event.attendeeIds.length
  };
}

export async function deleteEvent(eventId: string): Promise<boolean> {
  await ensureDbReady();
  await sqliteClient.execute({
    sql: 'DELETE FROM events WHERE id = ?',
    args: [eventId]
  });
  return true;
}

// -------------------------------------------------------------
// MEMORIES REPOSITORY
// -------------------------------------------------------------
export async function getMemories(
  homeId: string,
  currentUserId?: string,
  filters?: {
    search?: string;
    personId?: string;
    startDate?: string;
    endDate?: string;
    sort?: 'recent' | 'oldest';
  }
): Promise<FamilyMemory[]> {
  await ensureDbReady();

  let sql = `SELECT m.*, u.name as creatorName, u.email as creatorEmail, u.avatar as creatorAvatar
             FROM memories m
             LEFT JOIN users u ON u.id = m.creatorId
             WHERE m.homeId = ?`;
  const args: any[] = [homeId];

  if (filters?.search && filters.search.trim()) {
    const term = `%${filters.search.trim().toLowerCase()}%`;
    sql += ` AND (LOWER(m.title) LIKE ? OR LOWER(m.story) LIKE ? OR (m.location IS NOT NULL AND LOWER(m.location) LIKE ?))`;
    args.push(term, term, term);
  }

  if (filters?.startDate) {
    sql += ` AND m.date >= ?`;
    args.push(filters.startDate);
  }

  if (filters?.endDate) {
    sql += ` AND m.date <= ?`;
    args.push(filters.endDate);
  }

  if (filters?.sort === 'oldest') {
    sql += ` ORDER BY m.date ASC, m.createdAt ASC`;
  } else {
    sql += ` ORDER BY m.date DESC, m.createdAt DESC`;
  }

  const res = await sqliteClient.execute({ sql, args });

  // Get home members to resolve tagged names & avatars
  const homeMembers = await getHomeMembers(homeId);
  const memberMap = new Map<string, { id: string; name: string; avatar: string; email?: string }>();
  for (const hm of homeMembers) {
    memberMap.set(hm.userId, {
      id: hm.userId,
      name: hm.name,
      avatar: hm.avatar,
      email: hm.email
    });
  }

  // Get all comments for memories in this home
  const commentsRes = await sqliteClient.execute({
    sql: `SELECT c.*, u.name as authorName, u.email as authorEmail, u.avatar as authorAvatar
          FROM memory_comments c
          LEFT JOIN users u ON u.id = c.authorId
          JOIN memories m ON m.id = c.memoryId
          WHERE m.homeId = ?
          ORDER BY c.createdAt ASC`,
    args: [homeId]
  });

  const commentsByMemory: Record<string, MemoryComment[]> = {};
  for (const r of commentsRes.rows) {
    const memId = r.memoryId as string;
    if (!commentsByMemory[memId]) commentsByMemory[memId] = [];
    commentsByMemory[memId].push({
      id: r.id as string,
      memoryId: memId,
      authorId: r.authorId as string,
      content: r.content as string,
      createdAt: r.createdAt as string,
      author: {
        id: r.authorId as string,
        name: (r.authorName as string) || 'Family Member',
        email: (r.authorEmail as string) || '',
        avatar: (r.authorAvatar as string) || ''
      }
    });
  }

  // Get all reactions for memories in this home
  const reactionsRes = await sqliteClient.execute({
    sql: `SELECT r.*
          FROM memory_reactions r
          JOIN memories m ON m.id = r.memoryId
          WHERE m.homeId = ?`,
    args: [homeId]
  });

  const reactionsByMemory: Record<string, any[]> = {};
  for (const r of reactionsRes.rows) {
    const memId = r.memoryId as string;
    if (!reactionsByMemory[memId]) reactionsByMemory[memId] = [];
    reactionsByMemory[memId].push(r);
  }

  const memories: FamilyMemory[] = [];

  for (const m of res.rows) {
    const memId = m.id as string;
    const creatorId = m.creatorId as string;

    // Parse images array
    let images: string[] = [];
    if (m.images && typeof m.images === 'string') {
      try {
        const parsed = JSON.parse(m.images);
        if (Array.isArray(parsed)) images = parsed;
      } catch {
        images = [];
      }
    }
    if (images.length === 0 && m.imageUrl) {
      images = [m.imageUrl as string];
    }

    // Parse taggedMemberIds
    let taggedMemberIds: string[] = [];
    if (m.taggedMemberIds && typeof m.taggedMemberIds === 'string') {
      try {
        const parsed = JSON.parse(m.taggedMemberIds);
        if (Array.isArray(parsed)) taggedMemberIds = parsed;
      } catch {
        taggedMemberIds = [];
      }
    }

    // Resolve taggedMembers details
    const taggedMembers = taggedMemberIds.map(id => {
      const user = memberMap.get(id);
      return {
        id,
        name: user ? user.name : 'Family Member',
        avatar: user ? user.avatar : ''
      };
    });

    // Compute reaction summary
    const memReactions = reactionsByMemory[memId] || [];
    const reactionCounts: Record<string, { count: number; userIds: string[]; hasReacted: boolean }> = {};
    for (const r of memReactions) {
      const emoji = r.emoji as string;
      const uId = r.userId as string;
      if (!reactionCounts[emoji]) {
        reactionCounts[emoji] = { count: 0, userIds: [], hasReacted: false };
      }
      reactionCounts[emoji].count += 1;
      reactionCounts[emoji].userIds.push(uId);
      if (currentUserId && uId === currentUserId) {
        reactionCounts[emoji].hasReacted = true;
      }
    }

    // Filter by person if specified
    if (filters?.personId) {
      const pId = filters.personId;
      const isCreator = creatorId === pId;
      const isTagged = taggedMemberIds.includes(pId);
      if (!isCreator && !isTagged) {
        continue;
      }
    }

    memories.push({
      id: memId,
      homeId: m.homeId as string,
      creatorId,
      title: m.title as string,
      story: m.story as string,
      date: m.date as string,
      imageUrl: images[0] || (m.imageUrl as string) || undefined,
      images,
      location: (m.location as string) || undefined,
      taggedMemberIds,
      createdAt: m.createdAt as string,
      updatedAt: (m.updatedAt as string) || undefined,
      creator: {
        id: creatorId,
        name: (m.creatorName as string) || 'Family Member',
        email: (m.creatorEmail as string) || '',
        avatar: (m.creatorAvatar as string) || ''
      },
      taggedMembers,
      reactions: reactionCounts,
      comments: commentsByMemory[memId] || []
    });
  }

  return memories;
}

export async function getMemoryById(memoryId: string, currentUserId?: string): Promise<FamilyMemory | null> {
  await ensureDbReady();
  const res = await sqliteClient.execute({
    sql: `SELECT m.*, u.name as creatorName, u.email as creatorEmail, u.avatar as creatorAvatar
          FROM memories m
          LEFT JOIN users u ON u.id = m.creatorId
          WHERE m.id = ?`,
    args: [memoryId]
  });

  if (res.rows.length === 0) return null;
  const m = res.rows[0];
  const homeId = m.homeId as string;

  const homeMembers = await getHomeMembers(homeId);
  const memberMap = new Map<string, { id: string; name: string; avatar: string }>();
  for (const hm of homeMembers) {
    memberMap.set(hm.userId, { id: hm.userId, name: hm.name, avatar: hm.avatar });
  }

  const commentsRes = await sqliteClient.execute({
    sql: `SELECT c.*, u.name as authorName, u.email as authorEmail, u.avatar as authorAvatar
          FROM memory_comments c
          LEFT JOIN users u ON u.id = c.authorId
          WHERE c.memoryId = ?
          ORDER BY c.createdAt ASC`,
    args: [memoryId]
  });

  const comments: MemoryComment[] = commentsRes.rows.map(r => ({
    id: r.id as string,
    memoryId: r.memoryId as string,
    authorId: r.authorId as string,
    content: r.content as string,
    createdAt: r.createdAt as string,
    author: {
      id: r.authorId as string,
      name: (r.authorName as string) || 'Family Member',
      email: (r.authorEmail as string) || '',
      avatar: (r.authorAvatar as string) || ''
    }
  }));

  const reactionsRes = await sqliteClient.execute({
    sql: `SELECT r.* FROM memory_reactions r WHERE r.memoryId = ?`,
    args: [memoryId]
  });

  const reactionCounts: Record<string, { count: number; userIds: string[]; hasReacted: boolean }> = {};
  for (const r of reactionsRes.rows) {
    const emoji = r.emoji as string;
    const uId = r.userId as string;
    if (!reactionCounts[emoji]) {
      reactionCounts[emoji] = { count: 0, userIds: [], hasReacted: false };
    }
    reactionCounts[emoji].count += 1;
    reactionCounts[emoji].userIds.push(uId);
    if (currentUserId && uId === currentUserId) {
      reactionCounts[emoji].hasReacted = true;
    }
  }

  let images: string[] = [];
  if (m.images && typeof m.images === 'string') {
    try {
      const parsed = JSON.parse(m.images);
      if (Array.isArray(parsed)) images = parsed;
    } catch {
      images = [];
    }
  }
  if (images.length === 0 && m.imageUrl) {
    images = [m.imageUrl as string];
  }

  let taggedMemberIds: string[] = [];
  if (m.taggedMemberIds && typeof m.taggedMemberIds === 'string') {
    try {
      const parsed = JSON.parse(m.taggedMemberIds);
      if (Array.isArray(parsed)) taggedMemberIds = parsed;
    } catch {
      taggedMemberIds = [];
    }
  }

  const taggedMembers = taggedMemberIds.map(id => {
    const user = memberMap.get(id);
    return {
      id,
      name: user ? user.name : 'Family Member',
      avatar: user ? user.avatar : ''
    };
  });

  return {
    id: m.id as string,
    homeId,
    creatorId: m.creatorId as string,
    title: m.title as string,
    story: m.story as string,
    date: m.date as string,
    imageUrl: images[0] || (m.imageUrl as string) || undefined,
    images,
    location: (m.location as string) || undefined,
    taggedMemberIds,
    createdAt: m.createdAt as string,
    updatedAt: (m.updatedAt as string) || undefined,
    creator: {
      id: m.creatorId as string,
      name: (m.creatorName as string) || 'Family Member',
      email: (m.creatorEmail as string) || '',
      avatar: (m.creatorAvatar as string) || ''
    },
    taggedMembers,
    reactions: reactionCounts,
    comments
  };
}

export async function createMemory(memory: FamilyMemory): Promise<FamilyMemory> {
  await ensureDbReady();
  const images = memory.images || (memory.imageUrl ? [memory.imageUrl] : []);
  const imagesJson = JSON.stringify(images);
  const taggedJson = JSON.stringify(memory.taggedMemberIds || []);
  const firstImage = images[0] || memory.imageUrl || null;

  await sqliteClient.execute({
    sql: `INSERT INTO memories (id, homeId, creatorId, title, story, date, imageUrl, images, location, taggedMemberIds, createdAt, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      memory.id,
      memory.homeId,
      memory.creatorId,
      memory.title,
      memory.story,
      memory.date,
      firstImage,
      imagesJson,
      memory.location || null,
      taggedJson,
      memory.createdAt,
      memory.updatedAt || null
    ]
  });
  return memory;
}

export async function updateMemory(memoryId: string, updates: Partial<FamilyMemory>): Promise<FamilyMemory | null> {
  await ensureDbReady();
  const existing = await getMemoryById(memoryId);
  if (!existing) return null;

  const now = new Date().toISOString();
  const images = updates.images !== undefined ? updates.images : (existing.images || []);
  const firstImage = images[0] || updates.imageUrl || existing.imageUrl || null;
  const taggedIds = updates.taggedMemberIds !== undefined ? updates.taggedMemberIds : (existing.taggedMemberIds || []);

  await sqliteClient.execute({
    sql: `UPDATE memories SET
            title = ?,
            story = ?,
            date = ?,
            imageUrl = ?,
            images = ?,
            location = ?,
            taggedMemberIds = ?,
            updatedAt = ?
          WHERE id = ?`,
    args: [
      updates.title !== undefined ? updates.title : existing.title,
      updates.story !== undefined ? updates.story : existing.story,
      updates.date !== undefined ? updates.date : existing.date,
      firstImage,
      JSON.stringify(images),
      updates.location !== undefined ? updates.location : (existing.location || null),
      JSON.stringify(taggedIds),
      now,
      memoryId
    ]
  });

  return getMemoryById(memoryId);
}

export async function deleteMemory(memoryId: string): Promise<boolean> {
  await ensureDbReady();
  await sqliteClient.execute({
    sql: 'DELETE FROM memory_reactions WHERE memoryId = ?',
    args: [memoryId]
  });
  await sqliteClient.execute({
    sql: 'DELETE FROM memory_comments WHERE memoryId = ?',
    args: [memoryId]
  });
  await sqliteClient.execute({
    sql: 'DELETE FROM memories WHERE id = ?',
    args: [memoryId]
  });
  return true;
}

export async function toggleMemoryReaction(
  memoryId: string,
  userId: string,
  emoji: string
): Promise<{ reacted: boolean }> {
  await ensureDbReady();
  const existing = await sqliteClient.execute({
    sql: 'SELECT id FROM memory_reactions WHERE memoryId = ? AND userId = ? AND emoji = ?',
    args: [memoryId, userId, emoji]
  });

  if (existing.rows.length > 0) {
    await sqliteClient.execute({
      sql: 'DELETE FROM memory_reactions WHERE memoryId = ? AND userId = ? AND emoji = ?',
      args: [memoryId, userId, emoji]
    });
    return { reacted: false };
  } else {
    const id = `mr_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    await sqliteClient.execute({
      sql: 'INSERT INTO memory_reactions (id, memoryId, userId, emoji, createdAt) VALUES (?, ?, ?, ?, ?)',
      args: [id, memoryId, userId, emoji, new Date().toISOString()]
    });
    return { reacted: true };
  }
}

export async function addMemoryComment(comment: {
  id: string;
  memoryId: string;
  authorId: string;
  content: string;
  createdAt: string;
}): Promise<MemoryComment> {
  await ensureDbReady();
  await sqliteClient.execute({
    sql: 'INSERT INTO memory_comments (id, memoryId, authorId, content, createdAt) VALUES (?, ?, ?, ?, ?)',
    args: [comment.id, comment.memoryId, comment.authorId, comment.content, comment.createdAt]
  });

  const userRes = await sqliteClient.execute({
    sql: 'SELECT name, avatar, email FROM users WHERE id = ?',
    args: [comment.authorId]
  });
  const u = userRes.rows[0];

  return {
    id: comment.id,
    memoryId: comment.memoryId,
    authorId: comment.authorId,
    content: comment.content,
    createdAt: comment.createdAt,
    author: {
      id: comment.authorId,
      name: (u?.name as string) || 'Family Member',
      avatar: (u?.avatar as string) || '',
      email: (u?.email as string) || ''
    }
  };
}

export async function getMemoryCommentById(commentId: string) {
  await ensureDbReady();
  const res = await sqliteClient.execute({
    sql: 'SELECT * FROM memory_comments WHERE id = ?',
    args: [commentId]
  });
  if (res.rows.length === 0) return null;
  const r = res.rows[0];
  return {
    id: r.id as string,
    memoryId: r.memoryId as string,
    authorId: r.authorId as string,
    content: r.content as string,
    createdAt: r.createdAt as string
  };
}

export async function deleteMemoryComment(commentId: string): Promise<boolean> {
  await ensureDbReady();
  await sqliteClient.execute({
    sql: 'DELETE FROM memory_comments WHERE id = ?',
    args: [commentId]
  });
  return true;
}

// -------------------------------------------------------------
// VAULT REPOSITORY
// -------------------------------------------------------------
export async function getVaultFiles(homeId: string) {
  await ensureDbReady();
  const res = await sqliteClient.execute({
    sql: `SELECT vf.*, u.name as uploaderName, u.email as uploaderEmail, u.avatar as uploaderAvatar
          FROM vault_files vf
          LEFT JOIN users u ON u.id = vf.uploaderId
          WHERE vf.homeId = ?
          ORDER BY vf.createdAt DESC`,
    args: [homeId]
  });

  return res.rows.map(vf => ({
    id: vf.id as string,
    homeId: vf.homeId as string,
    uploaderId: vf.uploaderId as string,
    title: vf.title as string,
    category: vf.category as any,
    description: (vf.description as string) || '',
    contentOrUrl: vf.contentOrUrl as string,
    createdAt: vf.createdAt as string,
    uploader: {
      id: vf.uploaderId as string,
      name: (vf.uploaderName as string) || 'Family Member',
      email: (vf.uploaderEmail as string) || '',
      avatar: (vf.uploaderAvatar as string) || ''
    }
  }));
}

export async function createVaultFile(file: VaultFile): Promise<VaultFile> {
  await ensureDbReady();
  await sqliteClient.execute({
    sql: 'INSERT INTO vault_files (id, homeId, uploaderId, title, category, description, contentOrUrl, createdAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    args: [file.id, file.homeId, file.uploaderId, file.title, file.category, file.description || '', file.contentOrUrl, file.createdAt]
  });
  return file;
}

// -------------------------------------------------------------
// NOTIFICATIONS REPOSITORY & PREFERENCES
// -------------------------------------------------------------

export async function getUserNotificationPreferences(userId: string): Promise<NotificationPreferences> {
  await ensureDbReady();
  const res = await sqliteClient.execute({
    sql: 'SELECT * FROM notification_preferences WHERE userId = ? LIMIT 1',
    args: [userId]
  });
  if (res.rows.length === 0) {
    return {
      userId,
      messages: true,
      feedActivity: true,
      events: true,
      memories: true,
      familyActivity: true,
      askHomely: true,
      browserPush: false
    };
  }
  const row = res.rows[0];
  return {
    userId,
    messages: Boolean(row.messages),
    feedActivity: Boolean(row.feedActivity),
    events: Boolean(row.events),
    memories: Boolean(row.memories),
    familyActivity: Boolean(row.familyActivity),
    askHomely: Boolean(row.askHomely),
    browserPush: Boolean(row.browserPush),
    updatedAt: (row.updatedAt as string) || undefined
  };
}

export async function updateUserNotificationPreferences(
  userId: string,
  prefs: Partial<NotificationPreferences>
): Promise<NotificationPreferences> {
  await ensureDbReady();
  const current = await getUserNotificationPreferences(userId);
  const updated: NotificationPreferences = {
    userId,
    messages: prefs.messages !== undefined ? Boolean(prefs.messages) : current.messages,
    feedActivity: prefs.feedActivity !== undefined ? Boolean(prefs.feedActivity) : current.feedActivity,
    events: prefs.events !== undefined ? Boolean(prefs.events) : current.events,
    memories: prefs.memories !== undefined ? Boolean(prefs.memories) : current.memories,
    familyActivity: prefs.familyActivity !== undefined ? Boolean(prefs.familyActivity) : current.familyActivity,
    askHomely: prefs.askHomely !== undefined ? Boolean(prefs.askHomely) : current.askHomely,
    browserPush: prefs.browserPush !== undefined ? Boolean(prefs.browserPush) : current.browserPush,
    updatedAt: new Date().toISOString()
  };

  await sqliteClient.execute({
    sql: `INSERT INTO notification_preferences (userId, messages, feedActivity, events, memories, familyActivity, askHomely, browserPush, updatedAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(userId) DO UPDATE SET
            messages = excluded.messages,
            feedActivity = excluded.feedActivity,
            events = excluded.events,
            memories = excluded.memories,
            familyActivity = excluded.familyActivity,
            askHomely = excluded.askHomely,
            browserPush = excluded.browserPush,
            updatedAt = excluded.updatedAt`,
    args: [
      updated.userId,
      updated.messages ? 1 : 0,
      updated.feedActivity ? 1 : 0,
      updated.events ? 1 : 0,
      updated.memories ? 1 : 0,
      updated.familyActivity ? 1 : 0,
      updated.askHomely ? 1 : 0,
      updated.browserPush ? 1 : 0,
      updated.updatedAt!
    ]
  });

  return updated;
}

export function shouldDeliverNotification(type: NotificationType, prefs: NotificationPreferences): boolean {
  if (type.startsWith('message')) return prefs.messages;
  if (type.startsWith('post') || type.startsWith('comment') || type === 'reaction') return prefs.feedActivity;
  if (type.startsWith('event')) return prefs.events;
  if (type.startsWith('memory')) return prefs.memories;
  if (type.startsWith('member') || type.startsWith('home')) return prefs.familyActivity;
  if (type.startsWith('ask_homely')) return prefs.askHomely;
  return true;
}

let lastReminderCheck = 0;
export async function checkAndGenerateEventReminders(specificHomeId?: string): Promise<void> {
  const nowTs = Date.now();
  // Check reminders at most once every 30 seconds
  if (nowTs - lastReminderCheck < 30000 && !specificHomeId) {
    return;
  }
  lastReminderCheck = nowTs;

  try {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    let query = 'SELECT * FROM events WHERE (date = ? OR date = ?)';
    const args: any[] = [todayStr, tomorrowStr];
    if (specificHomeId) {
      query += ' AND homeId = ?';
      args.push(specificHomeId);
    }
    const eventsRes = await sqliteClient.execute({ sql: query, args });

    for (const row of eventsRes.rows) {
      const eventId = row.id as string;
      const eventHomeId = row.homeId as string;
      const eventTitle = row.title as string;
      const eventDate = row.date as string;
      const eventTime = (row.time as string) || '18:00';
      const eventLocation = (row.location as string) || '';

      let attendeeIds: string[] = [];
      try {
        attendeeIds = JSON.parse(row.attendeeIds as string);
      } catch {
        attendeeIds = [];
      }

      let targetUserIds = attendeeIds;
      if (targetUserIds.length === 0) {
        const members = await getHomeMembers(eventHomeId);
        targetUserIds = members.map(m => m.userId);
      }

      const [hours, minutes] = eventTime.split(':').map(Number);
      const eventDateTime = new Date(eventDate);
      eventDateTime.setHours(hours || 0, minutes || 0, 0, 0);
      const diffMs = eventDateTime.getTime() - now.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      // Event reminder: coming up within next 24 hours
      if (diffHours > 0 && diffHours <= 24) {
        for (const uid of targetUserIds) {
          const existingRes = await sqliteClient.execute({
            sql: `SELECT id FROM notifications WHERE recipientId = ? AND targetId = ? AND type = 'event_reminder' LIMIT 1`,
            args: [uid, eventId]
          });
          if (existingRes.rows.length === 0) {
            await createNotification({
              id: `notif_rem_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
              homeId: eventHomeId,
              recipientId: uid,
              senderId: row.creatorId as string,
              type: 'event_reminder',
              title: `Event Reminder: ${eventTitle}`,
              body: `Coming up ${eventDate === todayStr ? 'today' : 'tomorrow'} at ${eventTime}${eventLocation ? ` • ${eventLocation}` : ''}`,
              targetType: 'event',
              targetId: eventId,
              read: false,
              createdAt: new Date().toISOString()
            });
          }
        }
      }

      // Event starting soon: starting in 2 hours or less
      if (diffHours > 0 && diffHours <= 2) {
        for (const uid of targetUserIds) {
          const existingRes = await sqliteClient.execute({
            sql: `SELECT id FROM notifications WHERE recipientId = ? AND targetId = ? AND type = 'event_starting_soon' LIMIT 1`,
            args: [uid, eventId]
          });
          if (existingRes.rows.length === 0) {
            const minsLeft = Math.max(1, Math.round(diffHours * 60));
            await createNotification({
              id: `notif_soon_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
              homeId: eventHomeId,
              recipientId: uid,
              senderId: row.creatorId as string,
              type: 'event_starting_soon',
              title: `Starting Soon: ${eventTitle}`,
              body: `Starts in about ${minsLeft} minutes at ${eventTime}${eventLocation ? ` • ${eventLocation}` : ''}`,
              targetType: 'event',
              targetId: eventId,
              read: false,
              createdAt: new Date().toISOString()
            });
          }
        }
      }
    }
  } catch (err) {
    console.warn('Error checking event reminders:', err);
  }
}

export async function getNotifications(
  recipientId: string,
  homeId?: string,
  unreadOnly: boolean = false
): Promise<NotificationItem[]> {
  await ensureDbReady();
  await checkAndGenerateEventReminders(homeId);

  // STRICT HOME ISOLATION & USER PRIVACY:
  // User can ONLY retrieve notifications where they are the recipient AND
  // they are currently a confirmed active member of that notification's home!
  let sql = `
    SELECT
      n.*,
      h.name as homeName,
      u.name as senderName,
      u.avatar as senderAvatar
    FROM notifications n
    INNER JOIN home_members hm ON hm.homeId = n.homeId AND hm.userId = ?
    INNER JOIN homes h ON h.id = n.homeId
    LEFT JOIN users u ON u.id = n.senderId
    WHERE n.recipientId = ?
  `;
  const args: any[] = [recipientId, recipientId];

  if (homeId) {
    sql += ' AND n.homeId = ?';
    args.push(homeId);
  }

  if (unreadOnly) {
    sql += ' AND n.read = 0';
  }

  sql += ' ORDER BY n.createdAt DESC LIMIT 60';

  const res = await sqliteClient.execute({ sql, args });
  return res.rows.map(n => ({
    id: n.id as string,
    homeId: n.homeId as string,
    homeName: (n.homeName as string) || undefined,
    recipientId: n.recipientId as string,
    senderId: n.senderId as string,
    sender: n.senderName ? {
      id: n.senderId as string,
      name: n.senderName as string,
      avatar: (n.senderAvatar as string) || undefined
    } : undefined,
    type: n.type as NotificationType,
    title: n.title as string,
    body: n.body as string,
    targetType: (n.targetType as any) || undefined,
    targetId: (n.targetId as string) || undefined,
    metadata: (n.metadata as string) || undefined,
    read: Boolean(n.read),
    createdAt: n.createdAt as string
  }));
}

export async function getUnreadNotificationCount(
  recipientId: string,
  homeId?: string
): Promise<{ total: number; byHome: Record<string, number> }> {
  await ensureDbReady();
  await checkAndGenerateEventReminders(homeId);

  let sql = `
    SELECT n.homeId, COUNT(*) as count
    FROM notifications n
    INNER JOIN home_members hm ON hm.homeId = n.homeId AND hm.userId = ?
    WHERE n.recipientId = ? AND n.read = 0
  `;
  const args: any[] = [recipientId, recipientId];

  if (homeId) {
    sql += ' AND n.homeId = ?';
    args.push(homeId);
  }

  sql += ' GROUP BY n.homeId';

  const res = await sqliteClient.execute({ sql, args });
  const byHome: Record<string, number> = {};
  let total = 0;
  for (const row of res.rows) {
    const hid = row.homeId as string;
    const cnt = Number(row.count) || 0;
    byHome[hid] = cnt;
    total += cnt;
  }

  return { total, byHome };
}

export async function createNotification(notif: NotificationItem): Promise<NotificationItem | null> {
  await ensureDbReady();

  // 1. Never notify sender about their own action
  if (notif.senderId && notif.senderId === notif.recipientId) {
    return null;
  }

  // 2. Strict Home Isolation: verify recipient is a member of the Home
  const isMember = await isUserInHome(notif.recipientId, notif.homeId);
  if (!isMember) {
    return null;
  }

  // 3. User Notification Preferences check
  const prefs = await getUserNotificationPreferences(notif.recipientId);
  if (!shouldDeliverNotification(notif.type, prefs)) {
    return null;
  }

  await sqliteClient.execute({
    sql: `INSERT INTO notifications (id, homeId, recipientId, senderId, type, title, body, targetType, targetId, metadata, read, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      notif.id,
      notif.homeId,
      notif.recipientId,
      notif.senderId,
      notif.type,
      notif.title,
      notif.body,
      notif.targetType || null,
      notif.targetId || null,
      notif.metadata || null,
      notif.read ? 1 : 0,
      notif.createdAt
    ]
  });

  return notif;
}

export async function markNotificationAsRead(notificationId: string, recipientId: string): Promise<boolean> {
  await ensureDbReady();
  const res = await sqliteClient.execute({
    sql: 'UPDATE notifications SET read = 1 WHERE id = ? AND recipientId = ?',
    args: [notificationId, recipientId]
  });
  return res.rowsAffected > 0;
}

export async function markNotificationsAsRead(recipientId: string, homeId?: string): Promise<void> {
  await ensureDbReady();
  if (homeId) {
    await sqliteClient.execute({
      sql: 'UPDATE notifications SET read = 1 WHERE recipientId = ? AND homeId = ?',
      args: [recipientId, homeId]
    });
  } else {
    await sqliteClient.execute({
      sql: 'UPDATE notifications SET read = 1 WHERE recipientId = ?',
      args: [recipientId]
    });
  }
}

export async function deleteNotification(notificationId: string, recipientId: string): Promise<boolean> {
  await ensureDbReady();
  const res = await sqliteClient.execute({
    sql: 'DELETE FROM notifications WHERE id = ? AND recipientId = ?',
    args: [notificationId, recipientId]
  });
  return res.rowsAffected > 0;
}

// -------------------------------------------------------------
// ASK HOMELY AI CONTEXT HELPER
// -------------------------------------------------------------
export async function getHomeAiContext(homeId: string) {
  await ensureDbReady();
  const home = await getHomeById(homeId);
  const members = await getHomeMembers(homeId);

  const postsRes = await sqliteClient.execute({
    sql: `SELECT p.*, u.name as authorName
          FROM posts p
          LEFT JOIN users u ON u.id = p.authorId
          WHERE p.homeId = ?
          ORDER BY p.createdAt DESC LIMIT 10`,
    args: [homeId]
  });

  const eventsRes = await sqliteClient.execute({
    sql: 'SELECT * FROM events WHERE homeId = ? ORDER BY date ASC LIMIT 10',
    args: [homeId]
  });

  const memoriesRes = await sqliteClient.execute({
    sql: 'SELECT * FROM memories WHERE homeId = ? ORDER BY date DESC LIMIT 5',
    args: [homeId]
  });

  const vaultRes = await sqliteClient.execute({
    sql: 'SELECT * FROM vault_files WHERE homeId = ? ORDER BY createdAt DESC LIMIT 10',
    args: [homeId]
  });

  const events = eventsRes.rows.map(e => {
    let aIds: string[] = [];
    try {
      aIds = JSON.parse(e.attendeeIds as string);
    } catch {
      aIds = [];
    }
    return {
      title: e.title as string,
      date: e.date as string,
      time: e.time as string,
      location: (e.location as string) || 'Home',
      attendeeCount: aIds.length
    };
  });

  return {
    home,
    members,
    posts: postsRes.rows.map(p => ({
      authorName: (p.authorName as string) || 'Family Member',
      content: p.content as string,
      type: p.type as string
    })),
    events,
    memories: memoriesRes.rows.map(m => ({
      title: m.title as string,
      story: m.story as string
    })),
    vaultFiles: vaultRes.rows.map(v => ({
      title: v.title as string,
      category: v.category as string,
      description: (v.description as string) || '',
      contentOrUrl: v.contentOrUrl as string
    }))
  };
}

// -------------------------------------------------------------
// HOME DASHBOARD AGGREGATOR
// -------------------------------------------------------------
export async function getHomeDashboardData(homeId: string, currentUserId: string) {
  await ensureDbReady();
  const home = await getHomeById(homeId);
  if (!home) return null;

  const role = await getUserRoleInHome(currentUserId, homeId);
  const members = await getHomeMembers(homeId);

  // All posts for feed + notices
  const allPosts = await getPostsForHome(homeId, currentUserId);
  const notices = allPosts.filter(p => p.type === 'announcement');

  // Upcoming events
  const allEvents = await getEvents(homeId, currentUserId);
  const todayStr = new Date().toISOString().split('T')[0];
  const upcomingEvents = allEvents
    .filter(e => e.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));

  // Memories
  const memories = await getMemories(homeId);

  // Build Recent Activity items
  const postActivities = allPosts.slice(0, 8).map(p => ({
    id: `act_p_${p.id}`,
    type: 'post' as const,
    title: p.type === 'announcement' ? 'Family Announcement' : p.type === 'memory' ? 'Family Memory' : 'New post shared',
    description: p.content.length > 70 ? p.content.slice(0, 70) + '...' : p.content,
    actor: p.author,
    createdAt: p.createdAt
  }));

  const eventActivities = allEvents.slice(0, 4).map(e => ({
    id: `act_e_${e.id}`,
    type: 'event' as const,
    title: `New event: ${e.title}`,
    description: `${e.date} at ${e.time}${e.location ? ` • ${e.location}` : ''}`,
    actor: e.creator,
    createdAt: e.createdAt
  }));

  const memoryActivities = memories.slice(0, 4).map(m => ({
    id: `act_m_${m.id}`,
    type: 'memory' as const,
    title: `Memory added: ${m.title}`,
    description: m.story.length > 70 ? m.story.slice(0, 70) + '...' : m.story,
    actor: m.creator,
    createdAt: m.createdAt
  }));

  const memberActivities = members.slice(0, 3).map(m => ({
    id: `act_m_${m.id}`,
    type: 'member_joined' as const,
    title: `${m.name} is in the home`,
    description: `Role: ${m.role.charAt(0).toUpperCase() + m.role.slice(1)}`,
    actor: { id: m.userId, name: m.name, avatar: m.avatar },
    createdAt: m.joinedAt
  }));

  const recentActivity = [...postActivities, ...eventActivities, ...memoryActivities, ...memberActivities]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 8);

  return {
    home,
    role,
    members,
    notices,
    upcomingEvents: upcomingEvents.slice(0, 4),
    memories: memories.slice(0, 6),
    posts: allPosts,
    recentActivity
  };
}

// -------------------------------------------------------------
// ASSISTANT MEMORIES REPOSITORY (PERSISTENT MEMORY)
// -------------------------------------------------------------
export async function saveAssistantMemory(
  homeId: string,
  creatorId: string,
  key: string,
  content: string,
  category: string = 'general'
): Promise<AssistantMemory> {
  await ensureDbReady();
  const normalizedKey = key.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const now = new Date().toISOString();

  // Check if existing memory with same key in this home exists
  const existingRes = await sqliteClient.execute({
    sql: 'SELECT * FROM assistant_memories WHERE homeId = ? AND key = ? LIMIT 1',
    args: [homeId, normalizedKey]
  });

  if (existingRes.rows.length > 0) {
    const existingId = existingRes.rows[0].id as string;
    await sqliteClient.execute({
      sql: 'UPDATE assistant_memories SET content = ?, category = ?, updatedAt = ? WHERE id = ?',
      args: [content.trim(), category, now, existingId]
    });
    return {
      id: existingId,
      homeId,
      creatorId,
      key: normalizedKey,
      content: content.trim(),
      category,
      createdAt: existingRes.rows[0].createdAt as string,
      updatedAt: now
    };
  }

  const id = `am_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
  const memory: AssistantMemory = {
    id,
    homeId,
    creatorId,
    key: normalizedKey,
    content: content.trim(),
    category,
    createdAt: now,
    updatedAt: now
  };

  await sqliteClient.execute({
    sql: 'INSERT INTO assistant_memories (id, homeId, creatorId, key, content, category, createdAt, updatedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
    args: [memory.id, memory.homeId, memory.creatorId, memory.key, memory.content, memory.category, memory.createdAt, memory.updatedAt]
  });

  return memory;
}

export async function getAssistantMemories(homeId: string, query?: string): Promise<AssistantMemory[]> {
  await ensureDbReady();
  let sql = 'SELECT * FROM assistant_memories WHERE homeId = ?';
  const args: any[] = [homeId];

  if (query && query.trim()) {
    sql += ' AND (LOWER(key) LIKE LOWER(?) OR LOWER(content) LIKE LOWER(?) OR LOWER(category) LIKE LOWER(?))';
    const pattern = `%${query.trim()}%`;
    args.push(pattern, pattern, pattern);
  }

  sql += ' ORDER BY updatedAt DESC LIMIT 50';

  const res = await sqliteClient.execute({ sql, args });
  return res.rows.map(r => ({
    id: r.id as string,
    homeId: r.homeId as string,
    creatorId: r.creatorId as string,
    key: r.key as string,
    content: r.content as string,
    category: (r.category as string) || 'general',
    createdAt: r.createdAt as string,
    updatedAt: r.updatedAt as string
  }));
}

export async function getAssistantMemoryById(id: string): Promise<AssistantMemory | null> {
  await ensureDbReady();
  const res = await sqliteClient.execute({
    sql: 'SELECT * FROM assistant_memories WHERE id = ? LIMIT 1',
    args: [id]
  });
  if (res.rows.length === 0) return null;
  const r = res.rows[0];
  return {
    id: r.id as string,
    homeId: r.homeId as string,
    creatorId: r.creatorId as string,
    key: r.key as string,
    content: r.content as string,
    category: (r.category as string) || 'general',
    createdAt: r.createdAt as string,
    updatedAt: r.updatedAt as string
  };
}

export async function deleteAssistantMemory(homeId: string, idOrKey: string): Promise<boolean> {
  await ensureDbReady();
  const res = await sqliteClient.execute({
    sql: 'DELETE FROM assistant_memories WHERE homeId = ? AND (id = ? OR key = ?)',
    args: [homeId, idOrKey, idOrKey.trim().toLowerCase()]
  });
  return (res.rowsAffected || 0) > 0;
}

export async function deleteAssistantMemoryById(id: string, homeId: string): Promise<boolean> {
  await ensureDbReady();
  const res = await sqliteClient.execute({
    sql: 'DELETE FROM assistant_memories WHERE id = ? AND homeId = ?',
    args: [id, homeId]
  });
  return (res.rowsAffected || 0) > 0;
}

// -------------------------------------------------------------
// ASK HOMELY MESSAGES REPOSITORY (CONVERSATION HISTORY)
// -------------------------------------------------------------
export async function getAskHomelyMessages(homeId: string, userId: string, limit: number = 50): Promise<AskHomelyMessage[]> {
  await ensureDbReady();
  const res = await sqliteClient.execute({
    sql: 'SELECT * FROM ask_homely_messages WHERE homeId = ? AND userId = ? ORDER BY createdAt ASC LIMIT ?',
    args: [homeId, userId, limit]
  });

  return res.rows.map(r => {
    let actionPending: AskHomelyActionPending | undefined;
    let actionResult: any | undefined;
    let results: any[] | undefined;
    let sources: any[] | undefined;

    if (r.actionPending) {
      try { actionPending = JSON.parse(r.actionPending as string); } catch {}
    }
    if (r.actionResult) {
      try { actionResult = JSON.parse(r.actionResult as string); } catch {}
    }
    if (r.results) {
      try { results = JSON.parse(r.results as string); } catch {}
    }
    if (r.sources) {
      try { sources = JSON.parse(r.sources as string); } catch {}
    }

    return {
      id: r.id as string,
      homeId: r.homeId as string,
      userId: r.userId as string,
      role: r.role as 'user' | 'assistant',
      content: r.content as string,
      source: (r.source as string) || undefined,
      actionPending,
      actionResult,
      results,
      sources,
      createdAt: r.createdAt as string
    };
  });
}

export async function saveAskHomelyMessage(msg: AskHomelyMessage): Promise<AskHomelyMessage> {
  await ensureDbReady();
  await sqliteClient.execute({
    sql: `INSERT INTO ask_homely_messages (id, homeId, userId, role, content, source, actionPending, actionResult, results, sources, createdAt)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      msg.id,
      msg.homeId,
      msg.userId,
      msg.role,
      msg.content,
      msg.source || null,
      msg.actionPending ? JSON.stringify(msg.actionPending) : null,
      msg.actionResult ? JSON.stringify(msg.actionResult) : null,
      msg.results ? JSON.stringify(msg.results) : null,
      msg.sources ? JSON.stringify(msg.sources) : null,
      msg.createdAt
    ]
  });
  return msg;
}

export async function clearAskHomelyHistory(homeId: string, userId: string): Promise<boolean> {
  await ensureDbReady();
  await sqliteClient.execute({
    sql: 'DELETE FROM ask_homely_messages WHERE homeId = ? AND userId = ?',
    args: [homeId, userId]
  });
  return true;
}

export async function updateAskHomelyMessageAction(messageId: string, actionPending: any, actionResult: any): Promise<boolean> {
  await ensureDbReady();
  await sqliteClient.execute({
    sql: 'UPDATE ask_homely_messages SET actionPending = ?, actionResult = ? WHERE id = ?',
    args: [
      actionPending ? JSON.stringify(actionPending) : null,
      actionResult ? JSON.stringify(actionResult) : null,
      messageId
    ]
  });
  return true;
}

// -------------------------------------------------------------
// SCOPED, PERMISSION-CHECKED HOME RECORDS RETRIEVER
// -------------------------------------------------------------
export async function searchHomeRecords(
  homeId: string,
  currentUserId: string,
  options: {
    query?: string;
    domains?: string[];
    dateFilter?: string;
    author?: string;
    limit?: number;
  } = {}
) {
  await ensureDbReady();
  const q = (options.query || '').trim().toLowerCase();
  const domains = options.domains || ['members', 'events', 'posts', 'announcements', 'memories', 'vault', 'assistant_memories'];
  const maxLimit = options.limit || 20;

  const home = await getHomeById(homeId);
  const members = await getHomeMembers(homeId);

  // 1. Members
  let matchedMembers = members;
  if (q) {
    matchedMembers = members.filter(m => m.name.toLowerCase().includes(q) || m.role.toLowerCase().includes(q));
  }

  // 2. Events (scoped to home, attendees resolved to actual names)
  let matchedEvents: any[] = [];
  if (domains.includes('events')) {
    const allEvents = await getEvents(homeId, currentUserId);
    matchedEvents = allEvents;
    if (q) {
      matchedEvents = matchedEvents.filter(e =>
        e.title.toLowerCase().includes(q) ||
        (e.description && e.description.toLowerCase().includes(q)) ||
        (e.location && e.location.toLowerCase().includes(q)) ||
        e.date.includes(q)
      );
    }
    if (options.dateFilter) {
      const df = options.dateFilter;
      const todayStr = new Date().toISOString().split('T')[0];
      if (df === 'upcoming') {
        matchedEvents = matchedEvents.filter(e => e.date >= todayStr);
      } else if (df === 'past') {
        matchedEvents = matchedEvents.filter(e => e.date < todayStr);
      } else if (df.startsWith('range:')) {
        const [, start, end] = df.split(':');
        matchedEvents = matchedEvents.filter(e => e.date >= start && e.date <= end);
      } else if (df.length === 10) {
        matchedEvents = matchedEvents.filter(e => e.date === df);
      }
    }
    matchedEvents = matchedEvents.slice(0, maxLimit);
  }

  // 3. Posts & Announcements
  let matchedPosts: any[] = [];
  let matchedAnnouncements: any[] = [];
  if (domains.includes('posts') || domains.includes('announcements')) {
    const allPosts = await getPostsForHome(homeId, currentUserId);
    let candidatePosts = allPosts;

    if (options.author) {
      const authQ = options.author.toLowerCase();
      candidatePosts = candidatePosts.filter(p => p.author.name.toLowerCase().includes(authQ));
    }

    if (q) {
      candidatePosts = candidatePosts.filter(p =>
        p.content.toLowerCase().includes(q) ||
        p.author.name.toLowerCase().includes(q) ||
        p.type.toLowerCase().includes(q)
      );
    }

    if (domains.includes('announcements')) {
      matchedAnnouncements = candidatePosts.filter(p => p.type === 'announcement').slice(0, maxLimit);
    }
    if (domains.includes('posts')) {
      matchedPosts = candidatePosts.slice(0, maxLimit);
    }
  }

  // 4. Family Scrapbook Memories
  let matchedMemories: any[] = [];
  if (domains.includes('memories')) {
    const allMemories = await getMemories(homeId);
    matchedMemories = allMemories;
    if (q) {
      matchedMemories = matchedMemories.filter(m =>
        m.title.toLowerCase().includes(q) ||
        m.story.toLowerCase().includes(q) ||
        m.creator.name.toLowerCase().includes(q)
      );
    }
    matchedMemories = matchedMemories.slice(0, maxLimit);
  }

  // 5. Vault Files
  let matchedVault: any[] = [];
  if (domains.includes('vault')) {
    const allVault = await getVaultFiles(homeId);
    matchedVault = allVault;
    if (q) {
      matchedVault = matchedVault.filter(v =>
        v.title.toLowerCase().includes(q) ||
        (v.description && v.description.toLowerCase().includes(q)) ||
        v.category.toLowerCase().includes(q) ||
        v.contentOrUrl.toLowerCase().includes(q)
      );
    }
    matchedVault = matchedVault.slice(0, maxLimit);
  }

  // 6. Assistant Persistent Memories
  let matchedAssistantMemories: AssistantMemory[] = [];
  if (domains.includes('assistant_memories')) {
    matchedAssistantMemories = await getAssistantMemories(homeId, q || undefined);
  }

  return {
    home,
    members: matchedMembers,
    events: matchedEvents,
    posts: matchedPosts,
    announcements: matchedAnnouncements,
    memories: matchedMemories,
    vaultFiles: matchedVault,
    assistantMemories: matchedAssistantMemories
  };
}

