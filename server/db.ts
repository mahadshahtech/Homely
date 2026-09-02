import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import type {
  DatabaseSchema,
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
  VaultFile,
  NotificationItem,
  UserRole
} from './types';

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'homely.db.json');

const INITIAL_DB: DatabaseSchema = {
  users: [],
  sessions: [],
  homes: [],
  home_members: [],
  posts: [],
  comments: [],
  reactions: [],
  conversations: [],
  messages: [],
  events: [],
  memories: [],
  vault_files: [],
  notifications: []
};

function ensureDb(): DatabaseSchema {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify(INITIAL_DB, null, 2), 'utf-8');
      return INITIAL_DB;
    }
    const raw = fs.readFileSync(DB_FILE, 'utf-8');
    const parsed = JSON.parse(raw);
    return {
      ...INITIAL_DB,
      ...parsed
    };
  } catch (err) {
    console.error('Failed to read database file, initializing clean DB:', err);
    return INITIAL_DB;
  }
}

let dbMemory: DatabaseSchema = ensureDb();

export function saveDb() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmpFile = `${DB_FILE}.tmp.${Date.now()}`;
    fs.writeFileSync(tmpFile, JSON.stringify(dbMemory, null, 2), 'utf-8');
    fs.renameSync(tmpFile, DB_FILE);
  } catch (err) {
    console.error('Error saving DB:', err);
  }
}

export const db = {
  get data(): DatabaseSchema {
    return dbMemory;
  },
  save: saveDb
};

// Cryptography & Auth Helpers
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

// User & Session Management
export function getUserByEmail(email: string): User | undefined {
  return db.data.users.find(u => u.email.toLowerCase() === email.toLowerCase().trim());
}

export function getUserById(id: string): User | undefined {
  return db.data.users.find(u => u.id === id);
}

export function getUserByToken(token: string): User | undefined {
  const session = db.data.sessions.find(s => s.token === token);
  if (!session) return undefined;
  if (new Date(session.expiresAt) < new Date()) {
    // expired
    db.data.sessions = db.data.sessions.filter(s => s.token !== token);
    db.save();
    return undefined;
  }
  return getUserById(session.userId);
}

export function createSession(userId: string): Session {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days
  const session: Session = { token, userId, expiresAt };
  db.data.sessions.push(session);
  db.save();
  return session;
}

export function removeSession(token: string): void {
  db.data.sessions = db.data.sessions.filter(s => s.token !== token);
  db.save();
}

// Membership & Authorization
export function isUserInHome(userId: string, homeId: string): boolean {
  return db.data.home_members.some(m => m.userId === userId && m.homeId === homeId);
}

export function getUserRoleInHome(userId: string, homeId: string): UserRole | null {
  const member = db.data.home_members.find(m => m.userId === userId && m.homeId === homeId);
  return member ? member.role : null;
}

export function getUserHomes(userId: string): Home[] {
  const memberHomeIds = db.data.home_members
    .filter(m => m.userId === userId)
    .map(m => m.homeId);
  return db.data.homes.filter(h => memberHomeIds.includes(h.id));
}

export function getHomeById(homeId: string): Home | undefined {
  return db.data.homes.find(h => h.id === homeId);
}

export function getHomeMembers(homeId: string) {
  const memberships = db.data.home_members.filter(m => m.homeId === homeId);
  return memberships.map(m => {
    const user = getUserById(m.userId);
    return {
      id: m.id,
      userId: m.userId,
      homeId: m.homeId,
      role: m.role,
      joinedAt: m.joinedAt,
      name: user?.name || 'Unknown',
      email: user?.email || '',
      avatar: user?.avatar || ''
    };
  });
}
