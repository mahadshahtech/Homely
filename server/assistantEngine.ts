import crypto from 'crypto';
import { GoogleGenAI } from '@google/genai';
import {
  getHomeById,
  getUserById,
  getHomeMembers,
  getUserRoleInHome,
  getPostsForHome,
  createPost,
  getEvents,
  createEvent,
  getEventById,
  getMemories,
  createMemory,
  getVaultFiles,
  saveAssistantMemory,
  getAssistantMemories,
  deleteAssistantMemory,
  deleteAssistantMemoryById,
  searchHomeRecords,
  createMessage,
  createNotification
} from './db.ts';
import type {
  User,
  Home,
  FamilyEvent,
  FamilyMemory,
  Post,
  AssistantMemory,
  AskHomelyActionPending,
  AskHomelyMessage
} from './types.ts';

// Initialize Gemini Client server-side
let geminiAi: GoogleGenAI | null = null;
export function getGeminiClient(): GoogleGenAI | null {
  if (!geminiAi && process.env.GEMINI_API_KEY) {
    geminiAi = new GoogleGenAI({});
  }
  return geminiAi;
}

// -------------------------------------------------------------
// RELATIVE DATE RESOLVER
// -------------------------------------------------------------
export interface ResolvedDateContext {
  today: string; // YYYY-MM-DD
  nowTime: string; // HH:MM
  dayOfWeek: string; // Monday, etc.
  tomorrow: string; // YYYY-MM-DD
  yesterday: string; // YYYY-MM-DD
  startOfWeek: string;
  endOfWeek: string;
  nextWeekStart: string;
  nextWeekEnd: string;
}

export function getResolvedDateContext(clientRefDate?: string): ResolvedDateContext {
  const ref = clientRefDate ? new Date(clientRefDate) : new Date();
  const validRef = isNaN(ref.getTime()) ? new Date() : ref;

  const pad = (n: number) => n.toString().padStart(2, '0');
  const formatYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const todayStr = formatYMD(validRef);
  const nowTime = `${pad(validRef.getHours())}:${pad(validRef.getMinutes())}`;
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dayOfWeek = days[validRef.getDay()];

  const tom = new Date(validRef);
  tom.setDate(tom.getDate() + 1);
  const tomorrowStr = formatYMD(tom);

  const yest = new Date(validRef);
  yest.setDate(yest.getDate() - 1);
  const yesterdayStr = formatYMD(yest);

  // This week (Monday to Sunday)
  const dayIdx = validRef.getDay(); // 0 is Sunday
  const diffToMonday = (dayIdx + 6) % 7;
  const monday = new Date(validRef);
  monday.setDate(monday.getDate() - diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 6);

  // Next week
  const nextMonday = new Date(monday);
  nextMonday.setDate(nextMonday.getDate() + 7);
  const nextSunday = new Date(nextMonday);
  nextSunday.setDate(nextSunday.getDate() + 6);

  return {
    today: todayStr,
    nowTime,
    dayOfWeek,
    tomorrow: tomorrowStr,
    yesterday: yesterdayStr,
    startOfWeek: formatYMD(monday),
    endOfWeek: formatYMD(sunday),
    nextWeekStart: formatYMD(nextMonday),
    nextWeekEnd: formatYMD(nextSunday)
  };
}

export function parseRelativeDateString(input: string, ctx: ResolvedDateContext): { date: string; time?: string } {
  const lower = input.toLowerCase();

  // Time extraction
  let time = '19:00';
  const timeMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
  if (timeMatch) {
    let hour = parseInt(timeMatch[1], 10);
    const minute = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    const meridian = timeMatch[3].toLowerCase();
    if (meridian === 'pm' && hour < 12) hour += 12;
    if (meridian === 'am' && hour === 12) hour = 0;
    time = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  } else if (lower.includes('noon')) {
    time = '12:00';
  } else if (lower.includes('morning')) {
    time = '09:00';
  } else if (lower.includes('afternoon')) {
    time = '14:00';
  } else if (lower.includes('evening') || lower.includes('dinner')) {
    time = '19:00';
  } else if (lower.includes('night')) {
    time = '20:00';
  }

  // Date extraction
  let date = ctx.today;
  if (lower.includes('tomorrow')) {
    date = ctx.tomorrow;
  } else if (lower.includes('yesterday')) {
    date = ctx.yesterday;
  } else if (lower.includes('next week')) {
    date = ctx.nextWeekStart;
  } else if (lower.includes('this weekend') || lower.includes('weekend')) {
    // Saturday of this week
    const ref = new Date(ctx.today);
    const day = ref.getDay();
    const toSaturday = (6 - day + 7) % 7 || 7;
    ref.setDate(ref.getDate() + toSaturday);
    date = `${ref.getFullYear()}-${(ref.getMonth() + 1).toString().padStart(2, '0')}-${ref.getDate().toString().padStart(2, '0')}`;
  } else {
    // Day of week matching (e.g. "friday", "next friday")
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    for (let i = 0; i < dayNames.length; i++) {
      if (lower.includes(dayNames[i])) {
        const ref = new Date(ctx.today);
        const currentDay = ref.getDay();
        let targetDiff = (i - currentDay + 7) % 7;
        if (targetDiff === 0 && !lower.includes('today')) targetDiff = 7;
        if (lower.includes(`next ${dayNames[i]}`)) targetDiff += 7;
        ref.setDate(ref.getDate() + targetDiff);
        date = `${ref.getFullYear()}-${(ref.getMonth() + 1).toString().padStart(2, '0')}-${ref.getDate().toString().padStart(2, '0')}`;
        break;
      }
    }
  }

  return { date, time };
}

// -------------------------------------------------------------
// CONTROLLED ACTION EXECUTION ENGINE
// -------------------------------------------------------------
export interface ActionExecutionResult {
  success: boolean;
  type: string;
  message: string;
  item?: any;
  error?: string;
}

export async function executeAssistantAction(
  homeId: string,
  user: User,
  action: AskHomelyActionPending
): Promise<ActionExecutionResult> {
  // 1. Validate home membership and permissions
  const role = await getUserRoleInHome(user.id, homeId);
  if (!role) {
    return {
      success: false,
      type: action.type,
      message: 'Unauthorized: You are not a member of this Home',
      error: 'UNAUTHORIZED_HOME_MEMBERSHIP'
    };
  }

  const payload = action.payload || {};

  switch (action.type) {
    case 'create_event': {
      const title = (payload.title || '').trim();
      const date = (payload.date || '').trim();
      const time = (payload.time || '18:00').trim();
      const location = (payload.location || '').trim();
      const description = (payload.description || '').trim();

      if (!title || !date) {
        return {
          success: false,
          type: action.type,
          message: 'Failed to create event: Title and date are required.',
          error: 'MISSING_FIELDS'
        };
      }

      const eventId = `ev_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      const now = new Date().toISOString();
      const newEvent: FamilyEvent = {
        id: eventId,
        homeId,
        creatorId: user.id,
        title,
        description,
        date,
        time,
        location: location || undefined,
        attendeeIds: [user.id],
        createdAt: now
      };

      await createEvent(newEvent);

      // Dispatch notification to home members
      const members = await getHomeMembers(homeId);
      for (const m of members) {
        if (m.userId !== user.id) {
          await createNotification({
            id: `notif_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
            homeId,
            recipientId: m.userId,
            senderId: user.id,
            type: 'event',
            title: 'New Family Event Created',
            body: `${user.name} created "${title}" on ${date} at ${time}.`,
            read: false,
            createdAt: now
          });
        }
      }

      return {
        success: true,
        type: 'create_event',
        message: `Successfully scheduled **${title}** for ${date} at ${time}!`,
        item: {
          ...newEvent,
          isAttending: true,
          creator: { id: user.id, name: user.name, avatar: user.avatar },
          attendees: [{ id: user.id, name: user.name, avatar: user.avatar }]
        }
      };
    }

    case 'create_post': {
      const content = (payload.content || '').trim();
      if (!content) {
        return {
          success: false,
          type: action.type,
          message: 'Post content cannot be empty.',
          error: 'EMPTY_CONTENT'
        };
      }

      const now = new Date().toISOString();
      const newPost: Post = {
        id: `p_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
        homeId,
        authorId: user.id,
        content,
        type: 'update',
        createdAt: now
      };

      await createPost(newPost);
      return {
        success: true,
        type: 'create_post',
        message: 'Successfully published post to the family feed!',
        item: {
          ...newPost,
          author: { id: user.id, name: user.name, avatar: user.avatar },
          comments: [],
          reactions: {}
        }
      };
    }

    case 'create_announcement': {
      const content = (payload.content || '').trim();
      if (!content) {
        return {
          success: false,
          type: action.type,
          message: 'Announcement content cannot be empty.',
          error: 'EMPTY_CONTENT'
        };
      }

      const now = new Date().toISOString();
      const newAnnouncement: Post = {
        id: `p_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
        homeId,
        authorId: user.id,
        content,
        type: 'announcement',
        createdAt: now
      };

      await createPost(newAnnouncement);

      // Notify all other home members
      const members = await getHomeMembers(homeId);
      for (const m of members) {
        if (m.userId !== user.id) {
          await createNotification({
            id: `notif_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
            homeId,
            recipientId: m.userId,
            senderId: user.id,
            type: 'post',
            title: 'Family Announcement',
            body: `${user.name} shared an announcement: "${content.slice(0, 80)}"`,
            read: false,
            createdAt: now
          });
        }
      }

      return {
        success: true,
        type: 'create_announcement',
        message: 'Family announcement created and broadcast to all members!',
        item: {
          ...newAnnouncement,
          author: { id: user.id, name: user.name, avatar: user.avatar },
          comments: [],
          reactions: {}
        }
      };
    }

    case 'send_family_message': {
      const content = (payload.content || '').trim();
      if (!content) {
        return {
          success: false,
          type: action.type,
          message: 'Message content cannot be empty.',
          error: 'EMPTY_CONTENT'
        };
      }

      // Find the family circle conversation for this home
      const records = await searchHomeRecords(homeId, user.id, { domains: [] });
      // Search conversation
      const convRes = await import('./db.ts').then(db => db.getConversationsForUser(homeId, user.id));
      const familyConv = convRes.find(c => c.type === 'family');
      if (!familyConv) {
        return {
          success: false,
          type: action.type,
          message: 'Could not find the family circle chat conversation for this home.',
          error: 'CONVERSATION_NOT_FOUND'
        };
      }

      const now = new Date().toISOString();
      const msgId = `msg_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      const msg = await createMessage({
        id: msgId,
        conversationId: familyConv.id,
        senderId: user.id,
        content,
        mediaType: payload.isAnnouncement ? 'announcement' : undefined,
        isPinned: payload.isPinned ? true : false,
        pinnedAt: payload.isPinned ? now : undefined,
        pinnedBy: payload.isPinned ? user.name : undefined,
        createdAt: now
      });

      return {
        success: true,
        type: 'send_family_message',
        message: `Message posted to your Family Chat: "${content}"`,
        item: {
          id: msg.id,
          content: msg.content,
          conversationName: familyConv.name || 'Family Circle',
          createdAt: msg.createdAt
        }
      };
    }

    case 'create_family_memory': {
      const title = (payload.title || '').trim();
      const story = (payload.story || '').trim();
      const date = (payload.date || new Date().toISOString().split('T')[0]).trim();

      if (!title || !story) {
        return {
          success: false,
          type: action.type,
          message: 'Title and story are required to save a family memory.',
          error: 'MISSING_FIELDS'
        };
      }

      const now = new Date().toISOString();
      const memId = `mem_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
      const newMem: FamilyMemory = {
        id: memId,
        homeId,
        creatorId: user.id,
        title,
        story,
        date,
        createdAt: now
      };

      await createMemory(newMem);
      return {
        success: true,
        type: 'create_family_memory',
        message: `Family memory "${title}" recorded in the scrapbook!`,
        item: {
          ...newMem,
          creator: { id: user.id, name: user.name, avatar: user.avatar }
        }
      };
    }

    case 'save_assistant_memory': {
      const key = (payload.key || 'note').trim();
      const content = (payload.content || '').trim();
      const category = (payload.category || 'general').trim();

      if (!content) {
        return {
          success: false,
          type: action.type,
          message: 'Nothing to remember: content cannot be empty.',
          error: 'EMPTY_CONTENT'
        };
      }

      const saved = await saveAssistantMemory(homeId, user.id, key, content, category);
      return {
        success: true,
        type: 'save_assistant_memory',
        message: `I'll remember this for your family: "${content}"`,
        item: saved
      };
    }

    case 'delete_assistant_memory': {
      const id = (payload.id || '').trim();
      const key = (payload.key || '').trim();
      if (!id && !key) {
        return {
          success: false,
          type: action.type,
          message: 'Missing memory identifier to forget.',
          error: 'MISSING_ID'
        };
      }

      const deleted = id
        ? await deleteAssistantMemoryById(id, homeId)
        : await deleteAssistantMemory(homeId, key);

      if (!deleted) {
        return {
          success: false,
          type: action.type,
          message: 'Could not find that memory in this Home.',
          error: 'NOT_FOUND'
        };
      }

      return {
        success: true,
        type: 'delete_assistant_memory',
        message: `I have removed that memory from your family records.`
      };
    }

    default:
      return {
        success: false,
        type: action.type,
        message: `Unknown action type: ${action.type}`,
        error: 'UNKNOWN_ACTION'
      };
  }
}

// -------------------------------------------------------------
// CORE QUERY & INTENT PROCESSOR
// -------------------------------------------------------------
export interface AssistantResponse {
  reply: string;
  source?: string;
  actionPending?: AskHomelyActionPending;
  actionResult?: ActionExecutionResult;
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
}

export async function processAssistantQuery(
  homeId: string,
  user: User,
  prompt: string,
  clientRefDate?: string
): Promise<AssistantResponse> {
  const dateCtx = getResolvedDateContext(clientRefDate);
  const q = prompt.trim();
  const lowerQ = q.toLowerCase();

  // ---------------------------------------------------------
  // PRIVACY GUARANTEE: Reject inquiries about private DMs
  // ---------------------------------------------------------
  if (
    lowerQ.includes('private message') ||
    lowerQ.includes('direct message') ||
    lowerQ.includes('dm') ||
    lowerQ.includes('private chat') ||
    lowerQ.includes('secret chat') ||
    (lowerQ.includes('what did') && lowerQ.includes('in private'))
  ) {
    return {
      reply: `🔒 **Privacy Protection**: Ask Homely does not have access to private direct messages (DMs) between family members. Direct chats are strictly private and confidential between the participants.\n\nI only have access to shared family spaces, such as the Home Feed, shared calendar Events, the Family Vault, and family scrapbooks.`,
      source: 'privacy-guard'
    };
  }

  // ---------------------------------------------------------
  // 1. INTENT: SAVE ASSISTANT MEMORY
  // e.g. "Remember that the spare key is with Uncle"
  // ---------------------------------------------------------
  const rememberMatch = q.match(/(?:remember\s+(?:that\s+)?|keep\s+in\s+mind\s+(?:that\s+)?|note\s+down\s+(?:that\s+)?|don't\s+forget\s+(?:that\s+)?)(.+)/i);
  if (rememberMatch && !lowerQ.includes('what do you remember') && !lowerQ.includes('do you remember')) {
    const rawFact = rememberMatch[1].trim().replace(/[.!?]+$/, '');

    // Identify topic key
    let key = 'general_note';
    if (/spare\s*key|key/i.test(rawFact)) key = 'spare_key';
    else if (/wifi|wi-fi|password/i.test(rawFact)) key = 'wifi_password';
    else if (/garage|gate\s*code|door\s*code|code/i.test(rawFact)) key = 'access_code';
    else if (/doctor|pediatrician|clinic|hospital/i.test(rawFact)) key = 'medical_contact';
    else if (/birthday|anniversary/i.test(rawFact)) key = 'family_date';
    else {
      key = rawFact.slice(0, 30).trim().toLowerCase().replace(/[^a-z0-9]+/g, '_');
    }

    const savedMemory = await saveAssistantMemory(homeId, user.id, key, rawFact, 'household');

    return {
      reply: `I've saved that to your Family Memory! 🧠\n\n> **"${rawFact}"**\n\nWhenever you or anyone in **this Home** asks about this, I'll recall it.`,
      source: 'persistent-memory',
      results: [
        {
          type: 'assistant_memory',
          title: 'Family Memory Saved',
          subtitle: `Key: ${key.replace(/_/g, ' ')}`,
          details: rawFact,
          data: savedMemory
        }
      ],
      sources: [
        {
          type: 'assistant_memory',
          title: 'Persistent Family Memory',
          detail: `Saved by ${user.name}`
        }
      ]
    };
  }

  // ---------------------------------------------------------
  // 2. INTENT: FORGET / DELETE ASSISTANT MEMORY
  // e.g. "Forget that the spare key is with Uncle" or "Forget the spare key note"
  // ---------------------------------------------------------
  const forgetMatch = q.match(/(?:forget\s+(?:that\s+)?|delete\s+(?:the\s+)?memory\s+(?:about\s+)?|remove\s+(?:the\s+)?memory\s+(?:about\s+)?)(.+)/i);
  if (forgetMatch) {
    const target = forgetMatch[1].trim();
    // Search existing memories to identify what to delete
    const memories = await getAssistantMemories(homeId, target);
    if (memories.length === 0) {
      return {
        reply: `I checked your family memories, but I couldn't find any saved notes matching **"${target}"**. You can check all saved memories using the button above.`,
        source: 'persistent-memory'
      };
    }

    const memoryToForget = memories[0];
    // Formulate a confirmation action
    const actionPending: AskHomelyActionPending = {
      id: `act_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      type: 'delete_assistant_memory',
      title: 'Forget Family Memory',
      description: `Remove: "${memoryToForget.content}"`,
      payload: {
        id: memoryToForget.id,
        key: memoryToForget.key,
        content: memoryToForget.content
      }
    };

    return {
      reply: `I found the memory: **"${memoryToForget.content}"**.\n\nWould you like me to permanently forget and remove it from this Home?`,
      source: 'persistent-memory',
      actionPending,
      results: [
        {
          type: 'assistant_memory',
          title: 'Memory to Forget',
          subtitle: `Key: ${memoryToForget.key}`,
          details: memoryToForget.content,
          data: memoryToForget
        }
      ]
    };
  }

  // ---------------------------------------------------------
  // 3. INTENT: LIST OR RECALL ASSISTANT MEMORIES
  // e.g. "What do you remember about the spare key?" / "What do you remember?"
  // ---------------------------------------------------------
  if (
    lowerQ.includes('what do you remember') ||
    lowerQ.includes('what have you remembered') ||
    lowerQ.includes('show all memories') ||
    lowerQ.includes('list memories') ||
    (lowerQ.includes('remember') && lowerQ.includes('about'))
  ) {
    let subQuery = '';
    const aboutMatch = q.match(/(?:remember\s+about|memories\s+about)\s+(.+)/i);
    if (aboutMatch) subQuery = aboutMatch[1].trim().replace(/[?.]+$/, '');

    const memories = await getAssistantMemories(homeId, subQuery);

    if (memories.length === 0) {
      if (subQuery) {
        return {
          reply: `I don't have anything saved in family memory about **"${subQuery}"** yet.\n\nYou can tell me: *"Remember that the spare key is with Uncle"* and I will remember it!`,
          source: 'persistent-memory'
        };
      } else {
        return {
          reply: `I haven't been asked to remember any specific family notes yet for this Home.\n\nWhenever you want me to keep track of something (like spare keys, codes, or family preferences), just tell me: *"Remember that [detail]"*!`,
          source: 'persistent-memory'
        };
      }
    }

    const itemsText = memories.map(m => `• **${m.content}** *(Saved on ${m.createdAt.slice(0, 10)})*`).join('\n');
    return {
      reply: subQuery
        ? `Here is what I remember about **${subQuery}**:\n\n${itemsText}`
        : `Here are the notes I'm currently remembering for your family:\n\n${itemsText}`,
      source: 'persistent-memory',
      results: memories.map(m => ({
        type: 'assistant_memory' as const,
        title: m.key.replace(/_/g, ' '),
        subtitle: `Saved ${m.createdAt.slice(0, 10)}`,
        details: m.content,
        data: m
      })),
      sources: [
        {
          type: 'assistant_memory',
          title: 'Persistent Family Memory',
          detail: `${memories.length} item(s) retrieved`
        }
      ]
    };
  }

  // ---------------------------------------------------------
  // 4. INTENT: CREATE EVENT (WITH CONFIRMATION CARD)
  // e.g. "Create an event for dinner tomorrow at 8 PM"
  // ---------------------------------------------------------
  if (
    (lowerQ.includes('create an event') ||
     lowerQ.includes('create event') ||
     lowerQ.includes('schedule an event') ||
     lowerQ.includes('add an event') ||
     lowerQ.includes('put on the calendar') ||
     lowerQ.includes('schedule event'))
  ) {
    const { date, time } = parseRelativeDateString(q, dateCtx);

    // Extract title
    let title = 'Family Gathering';
    const titleMatch = q.match(/(?:for|called|named|titled)\s+([^0-9,.]+?)(?:\s+(?:tomorrow|today|on|at|this|next|\d)|$)/i);
    if (titleMatch && titleMatch[1].trim()) {
      title = titleMatch[1].trim();
    } else {
      // Look for keywords
      if (lowerQ.includes('dinner')) title = 'Family Dinner';
      else if (lowerQ.includes('lunch')) title = 'Family Lunch';
      else if (lowerQ.includes('breakfast')) title = 'Family Breakfast';
      else if (lowerQ.includes('birthday')) title = 'Birthday Celebration';
      else if (lowerQ.includes('movie')) title = 'Family Movie Night';
      else if (lowerQ.includes('meeting')) title = 'Family Meeting';
      else if (lowerQ.includes('trip') || lowerQ.includes('picnic')) title = 'Family Outing';
    }

    // Capitalize title
    title = title.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

    let location = 'Home';
    const locMatch = q.match(/(?:at|in)\s+([A-Z][a-zA-Z\s]+?)(?:\s+(?:tomorrow|today|at\s+\d|\d)|$)/);
    if (locMatch && !locMatch[1].toLowerCase().includes('pm') && !locMatch[1].toLowerCase().includes('am')) {
      location = locMatch[1].trim();
    }

    const actionPending: AskHomelyActionPending = {
      id: `act_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      type: 'create_event',
      title: `Create Event: ${title}`,
      description: `Date: ${date} • Time: ${time} • Location: ${location}`,
      payload: {
        title,
        date,
        time,
        location,
        description: `Scheduled via Ask Homely by ${user.name}`
      }
    };

    return {
      reply: `I'll create the event **"${title}"** for **${date}** at **${time}**${location !== 'Home' ? ` at **${location}**` : ''} for this Home.\n\nShould I go ahead and add this to the family calendar?`,
      source: 'action-proposal',
      actionPending,
      results: [
        {
          type: 'event',
          title,
          subtitle: `${date} at ${time}`,
          details: `Location: ${location}`,
          data: actionPending.payload
        }
      ]
    };
  }

  // ---------------------------------------------------------
  // 5. INTENT: CREATE ANNOUNCEMENT (WITH CONFIRMATION CARD)
  // e.g. "Create a family announcement saying we're leaving at 9"
  // ---------------------------------------------------------
  if (
    lowerQ.includes('create an announcement') ||
    lowerQ.includes('create a family announcement') ||
    lowerQ.includes('make an announcement') ||
    lowerQ.includes('post an announcement')
  ) {
    let content = '';
    const sayingMatch = q.match(/(?:saying|that|content:)\s+(.+)/i);
    if (sayingMatch) {
      content = sayingMatch[1].trim().replace(/^["']|["']$/g, '');
    } else {
      content = q.replace(/^(?:please\s+)?(?:create|make|post)\s+(?:a\s+)?(?:family\s+)?announcement(?:\s+about)?/i, '').trim();
    }

    if (!content) {
      return {
        reply: `What announcement would you like me to post for the family? For example: *"Create an announcement saying we're leaving for the trip at 8 AM tomorrow."*`,
        source: 'action-proposal'
      };
    }

    const actionPending: AskHomelyActionPending = {
      id: `act_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      type: 'create_announcement',
      title: 'Broadcast Family Announcement',
      description: `"${content}"`,
      payload: {
        content
      }
    };

    return {
      reply: `I've prepared a family announcement:\n\n> 📢 **"${content}"**\n\nThis will be pinned in the family feed and sent to all members. Should I publish it now?`,
      source: 'action-proposal',
      actionPending,
      results: [
        {
          type: 'announcement',
          title: 'Family Announcement Draft',
          subtitle: `By ${user.name}`,
          details: content,
          data: { content }
        }
      ]
    };
  }

  // ---------------------------------------------------------
  // 6. INTENT: SEND FAMILY MESSAGE (WITH CONFIRMATION CARD)
  // e.g. "Send a message to the family saying dinner is ready"
  // ---------------------------------------------------------
  if (
    lowerQ.includes('send a message to the family') ||
    lowerQ.includes('send a message to family') ||
    lowerQ.includes('message the family') ||
    lowerQ.includes('send family message')
  ) {
    let content = '';
    const sayingMatch = q.match(/(?:saying|that|with:)\s+(.+)/i);
    if (sayingMatch) {
      content = sayingMatch[1].trim().replace(/^["']|["']$/g, '');
    } else {
      content = q.replace(/^(?:please\s+)?send\s+(?:a\s+)?message\s+to\s+(?:the\s+)?family(?:\s+saying)?/i, '').trim();
    }

    if (!content) {
      return {
        reply: `What message would you like me to send to the family circle chat? For example: *"Send a message to the family saying dinner is ready!"*`,
        source: 'action-proposal'
      };
    }

    const actionPending: AskHomelyActionPending = {
      id: `act_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      type: 'send_family_message',
      title: 'Send to Family Chat',
      description: `"${content}"`,
      payload: {
        content,
        isAnnouncement: true
      }
    };

    return {
      reply: `I'll send this message to the **Family Chat** circle:\n\n> 💬 **"${content}"**\n\nSend it now?`,
      source: 'action-proposal',
      actionPending,
      results: [
        {
          type: 'post',
          title: 'Family Chat Message Draft',
          subtitle: 'Family Circle',
          details: content,
          data: { content }
        }
      ]
    };
  }

  // ---------------------------------------------------------
  // 7. RETRIEVAL & GROUNDING: GATHER RELEVANT HOME RECORDS
  // ---------------------------------------------------------
  // Detect domain relevance
  const isKeyOrVault = /key|spare|vault|code|safe|wifi|pass|password|document|recipe/i.test(lowerQ);
  const isEventOrCal = /event|calendar|schedule|dinner|lunch|party|tomorrow|today|this week|weekend|next week|when|who is attending|rsvp/i.test(lowerQ);
  const isPostOrFeed = /post|update|dad|mom|announcement|feed|said|wrote|yesterday/i.test(lowerQ);
  const isMemoryOrStory = /memory|memories|story|vacation|trip|photo|remember|scrapbook/i.test(lowerQ);
  const isMemberOrFamily = /member|who is in|family|who lives|joined|role/i.test(lowerQ);

  const domainsToSearch: string[] = ['assistant_memories'];
  if (isKeyOrVault) domainsToSearch.push('vault');
  if (isEventOrCal) domainsToSearch.push('events');
  if (isPostOrFeed) domainsToSearch.push('posts', 'announcements');
  if (isMemoryOrStory) domainsToSearch.push('memories');
  if (isMemberOrFamily) domainsToSearch.push('members');

  // If general query, search all
  if (domainsToSearch.length <= 1) {
    domainsToSearch.push('events', 'vault', 'posts', 'announcements', 'memories', 'members');
  }

  const dateFilter = isEventOrCal
    ? (lowerQ.includes('this week') ? `range:${dateCtx.startOfWeek}:${dateCtx.endOfWeek}` : lowerQ.includes('tomorrow') ? dateCtx.tomorrow : lowerQ.includes('today') ? dateCtx.today : 'upcoming')
    : undefined;

  let authorFilter: string | undefined;
  if (lowerQ.includes('dad')) authorFilter = 'Dad';
  else if (lowerQ.includes('mom')) authorFilter = 'Mom';

  let searchQuery = '';
  if (isKeyOrVault) {
    if (lowerQ.includes('key')) searchQuery = 'key';
    else if (lowerQ.includes('wifi')) searchQuery = 'wifi';
    else if (lowerQ.includes('code')) searchQuery = 'code';
  } else if (isPostOrFeed) {
    // Return posts / announcements without over-constraining on question words
    if (lowerQ.includes('announcement')) {
      searchQuery = '';
    } else if (lowerQ.includes('post') || lowerQ.includes('feed') || authorFilter) {
      searchQuery = '';
    }
  } else if (isEventOrCal) {
    searchQuery = '';
  }

  const homeData = await searchHomeRecords(homeId, user.id, {
    query: searchQuery,
    domains: domainsToSearch,
    dateFilter,
    author: authorFilter,
    limit: 10
  });

  const home = homeData.home;
  const members = homeData.members;
  const events = homeData.events;
  const posts = homeData.posts;
  const announcements = homeData.announcements;
  const memories = homeData.memories;
  const vaultFiles = homeData.vaultFiles;
  const assistantMemories = homeData.assistantMemories;

  // ---------------------------------------------------------
  // 8. GEMINI AI AUGMENTATION (WHEN CONFIGURED)
  // ---------------------------------------------------------
  const ai = getGeminiClient();
  if (ai) {
    try {
      const groundedContext = `
Active Family Home: "${home?.name || 'Home'}"
Today's Date: ${dateCtx.today} (${dateCtx.dayOfWeek}), Current Time: ${dateCtx.nowTime}
Tomorrow's Date: ${dateCtx.tomorrow}
This Week Range: ${dateCtx.startOfWeek} to ${dateCtx.endOfWeek}
Next Week Range: ${dateCtx.nextWeekStart} to ${dateCtx.nextWeekEnd}
User Asking: ${user.name} (Role: Member)

Family Members in this Home:
${members.map(m => `- ${m.name} (${m.role})`).join('\n') || 'None'}

Upcoming / Matching Events:
${events.map(e => {
  const going = e.rsvps?.going?.map((u: any) => u.name).join(', ') || e.attendees?.map((a: any) => a.name).join(', ') || 'None';
  const maybe = e.rsvps?.maybe?.map((u: any) => u.name).join(', ') || 'None';
  const declined = e.rsvps?.declined?.map((u: any) => u.name).join(', ') || 'None';
  return `- "${e.title}" on ${e.date} from ${e.time}${e.endTime ? ' to ' + e.endTime : ''} (Location: ${e.location || 'Home'}). RSVP Going: ${going}. RSVP Maybe: ${maybe}. RSVP Can't Go: ${declined}.`;
}).join('\n') || 'No matching events found'}

Family Posts & Announcements:
${posts.map(p => `- [${p.type.toUpperCase()}] ${p.author.name} on ${p.createdAt.slice(0, 10)}: "${p.content}"`).join('\n') || 'No posts recorded'}

Family Scrapbook Memories:
${memories.map(m => `- "${m.title}" (${m.date}${m.location ? ' in ' + m.location : ''}${m.taggedMembers && m.taggedMembers.length ? ' with ' + m.taggedMembers.map((t: any) => t.name).join(', ') : ''}): ${m.story} (Saved by ${m.creator?.name || 'Family'})`).join('\n') || 'No memories found'}

Family Vault (Safe items & codes):
${vaultFiles.map(v => `- [${v.category}] "${v.title}": ${v.description ? v.description + ' - ' : ''}${v.contentOrUrl}`).join('\n') || 'No vault records matching'}

Persistent Family Memories (Remembered facts):
${assistantMemories.map(am => `- Key: "${am.key}" -> "${am.content}" (saved on ${am.createdAt.slice(0, 10)})`).join('\n') || 'No remembered facts'}
`;

      const geminiPrompt = `
You are Ask Homely, the loving, smart, and grounded family AI assistant for "${home?.name}".
Directives:
1. Ground your answers strictly in the provided Family Context above. NEVER invent family members, events, dates, locations, or secrets.
2. If an item cannot be found (e.g. spare keys or a specific date's post), clearly state that you searched the family records and could not find it. Suggest adding it or saving it.
3. If asked about private direct messages (DMs), state warmly that private direct messages are confidential and isolated.
4. Keep answers warm, concise, and helpful. Use markdown bullet points and bolding for clarity.
5. If the user asks about attendees of an event, name the actual members attending from the list.

User Question:
"${q}"
`;

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('GEMINI_TIMEOUT')), 5000)
      );

      const genPromise = ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: [
          {
            role: 'user',
            parts: [{ text: geminiPrompt }, { text: `\n\nFamily Context:\n${groundedContext}` }]
          }
        ]
      });

      const response = await Promise.race([genPromise, timeoutPromise]);

      if (response.text) {
        // Collect rich result cards
        const results: any[] = [];
        const sources: any[] = [];

        if (isEventOrCal && events.length > 0) {
          events.slice(0, 3).forEach(e => {
            results.push({
              type: 'event',
              title: e.title,
              subtitle: `${e.date} at ${e.time}`,
              details: `${e.location ? `📍 ${e.location} • ` : ''}${e.attendees.length} attending (${e.attendees.map((a: any) => a.name).join(', ')})`,
              data: e
            });
          });
          sources.push({ type: 'events', title: 'Family Calendar Events' });
        }

        if (isKeyOrVault && (vaultFiles.length > 0 || assistantMemories.length > 0)) {
          vaultFiles.slice(0, 2).forEach(v => {
            results.push({
              type: 'vault',
              title: v.title,
              subtitle: `Category: ${v.category}`,
              details: v.contentOrUrl,
              data: v
            });
          });
          assistantMemories.slice(0, 2).forEach(am => {
            results.push({
              type: 'assistant_memory',
              title: am.key.replace(/_/g, ' '),
              subtitle: 'Persistent Memory',
              details: am.content,
              data: am
            });
          });
          if (vaultFiles.length > 0) sources.push({ type: 'vault', title: 'Family Vault Records' });
          if (assistantMemories.length > 0) sources.push({ type: 'memory', title: 'Persistent Family Memory' });
        }

        if (isPostOrFeed && posts.length > 0) {
          posts.slice(0, 2).forEach(p => {
            results.push({
              type: p.type === 'announcement' ? 'announcement' : 'post',
              title: `${p.author.name}'s ${p.type === 'announcement' ? 'Announcement' : 'Post'}`,
              subtitle: p.createdAt.slice(0, 10),
              details: p.content,
              data: p
            });
          });
          sources.push({ type: 'posts', title: 'Family Feed & Announcements' });
        }

        return {
          reply: response.text,
          source: 'gemini-grounded',
          results: results.length > 0 ? results : undefined,
          sources: sources.length > 0 ? sources : undefined
        };
      }
    } catch (err: any) {
      console.warn('Gemini API call failed, falling back to deterministic grounded engine:', err?.message);
    }
  }

  // ---------------------------------------------------------
  // 9. HIGH-PRECISION DETERMINISTIC ENGINE (ZERO-HALLUCINATION)
  // ---------------------------------------------------------

  // A. Spare Keys / Vault / Codes
  if (isKeyOrVault) {
    const memoryKeys = assistantMemories.filter(m =>
      m.key.includes('key') || m.content.toLowerCase().includes('key') ||
      m.key.includes('wifi') || m.content.toLowerCase().includes('wifi') ||
      m.key.includes('code') || m.content.toLowerCase().includes('code')
    );
    const vaultKeys = vaultFiles.filter(v =>
      v.title.toLowerCase().includes('key') ||
      v.title.toLowerCase().includes('wifi') ||
      v.title.toLowerCase().includes('code') ||
      v.category === 'home'
    );

    if (memoryKeys.length > 0 || vaultKeys.length > 0) {
      let text = `Here is what I found in **${home?.name}**'s records:\n\n`;
      if (memoryKeys.length > 0) {
        text += `**From Family Memory:**\n${memoryKeys.map(m => `• **${m.content}**`).join('\n')}\n\n`;
      }
      if (vaultKeys.length > 0) {
        text += `**From Family Vault:**\n${vaultKeys.map(v => `• **${v.title}**: ${v.description ? v.description + ' - ' : ''}${v.contentOrUrl}`).join('\n')}`;
      }

      const results = [
        ...memoryKeys.map(m => ({
          type: 'assistant_memory' as const,
          title: m.key.replace(/_/g, ' '),
          subtitle: 'Remembered Fact',
          details: m.content,
          data: m
        })),
        ...vaultKeys.map(v => ({
          type: 'vault' as const,
          title: v.title,
          subtitle: v.category,
          details: v.contentOrUrl,
          data: v
        }))
      ];

      return {
        reply: text.trim(),
        source: 'family-records',
        results,
        sources: [
          ...(memoryKeys.length > 0 ? [{ type: 'assistant_memory', title: 'Persistent Memory' }] : []),
          ...(vaultKeys.length > 0 ? [{ type: 'vault', title: 'Family Vault' }] : [])
        ]
      };
    } else {
      return {
        reply: `I searched your **Family Vault** and **Family Memories**, but could not find any records about keys or codes for **${home?.name}**.\n\nYou can tell me: *"Remember that the spare key is in the lockbox code 1234"* and I will keep track of it for your family!`,
        source: 'family-records'
      };
    }
  }

  // B. Events & Calendar Questions
  if (isEventOrCal) {
    // 1. Check if user is asking about who is attending / RSVP for an event
    if (lowerQ.includes('who is attending') || lowerQ.includes('attending') || lowerQ.includes('who\'s going') || lowerQ.includes('who is going') || lowerQ.includes('rsvp')) {
      // Find event that best matches query words
      let targetEvent = events.find(e => {
        const titleWords = e.title.toLowerCase().split(/\s+/);
        return titleWords.some(w => w.length > 3 && lowerQ.includes(w));
      }) || events[0] || (await getEvents(homeId, user.id))[0];

      if (targetEvent) {
        const goingNames = targetEvent.rsvps?.going?.map((a: any) => a.name).join(', ') || targetEvent.attendees.map((a: any) => a.name).join(', ') || 'None yet';
        const maybeNames = targetEvent.rsvps?.maybe?.map((a: any) => a.name).join(', ') || 'None';
        const declinedNames = targetEvent.rsvps?.declined?.map((a: any) => a.name).join(', ') || 'None';
        const timeStr = `${targetEvent.time}${targetEvent.endTime ? ' – ' + targetEvent.endTime : ''}`;

        return {
          reply: `For **"${targetEvent.title}"** on **${targetEvent.date}** at **${timeStr}**:\n\n• **Going (${targetEvent.rsvps?.going?.length ?? targetEvent.attendees.length}):** ${goingNames}\n• **Maybe (${targetEvent.rsvps?.maybe?.length ?? 0}):** ${maybeNames}\n• **Can't Go (${targetEvent.rsvps?.declined?.length ?? 0}):** ${declinedNames}\n• **Location:** ${targetEvent.location || 'Home'}`,
          source: 'events',
          results: [
            {
              type: 'event',
              title: targetEvent.title,
              subtitle: `${targetEvent.date} at ${timeStr}`,
              details: `${targetEvent.attendees.length} attending: ${goingNames}`,
              data: targetEvent
            }
          ]
        };
      }
    }

    // 2. Check if user asks "when is [dinner / event]?"
    const matchedEvent = events.find(e => {
      const titleWords = e.title.toLowerCase().split(/\s+/);
      return titleWords.some(w => w.length > 3 && lowerQ.includes(w));
    });

    if (matchedEvent) {
      const timeStr = `${matchedEvent.time}${matchedEvent.endTime ? ' – ' + matchedEvent.endTime : ''}`;
      return {
        reply: `**"${matchedEvent.title}"** is scheduled for **${matchedEvent.date}** at **${timeStr}**${matchedEvent.location ? ` at **${matchedEvent.location}**` : ''}.\n\n• **Going:** ${matchedEvent.rsvps?.going?.map(g => g.name).join(', ') || matchedEvent.attendees.map(a => a.name).join(', ') || 'None yet'}\n${matchedEvent.description ? `• **Details:** ${matchedEvent.description}` : ''}`,
        source: 'events',
        results: [{
          type: 'event',
          title: matchedEvent.title,
          subtitle: `${matchedEvent.date} at ${timeStr}`,
          details: `${matchedEvent.location ? `📍 ${matchedEvent.location} • ` : ''}${matchedEvent.attendees.length} attending`,
          data: matchedEvent
        }],
        sources: [{ type: 'events', title: 'Family Events Calendar' }]
      };
    }

    // 3. General list of events
    if (events.length > 0) {
      const eventList = events.map(e => {
        const timeStr = `${e.time}${e.endTime ? ' – ' + e.endTime : ''}`;
        return `• **${e.title}** on **${e.date}** at **${timeStr}**${e.location ? ` at ${e.location}` : ''} (${e.attendees.length} attending)`;
      }).join('\n');

      return {
        reply: `Here are the upcoming events on the family calendar for **${home?.name}**:\n\n${eventList}`,
        source: 'events',
        results: events.slice(0, 4).map(e => ({
          type: 'event',
          title: e.title,
          subtitle: `${e.date} at ${e.time}${e.endTime ? ' – ' + e.endTime : ''}`,
          details: `${e.location ? `📍 ${e.location} • ` : ''}${e.attendees.length} attending`,
          data: e
        })),
        sources: [{ type: 'events', title: 'Family Events Calendar' }]
      };
    } else {
      return {
        reply: `There are currently no events scheduled on the calendar for **${home?.name}** matching that timeframe.\n\nYou can ask me: *"Create an event for dinner tomorrow at 8 PM"* and I'll help set it up!`,
        source: 'events'
      };
    }
  }

  // C. Posts / Announcements Questions
  if (isPostOrFeed) {
    if (lowerQ.includes('announcement')) {
      const allAnnouncements = announcements.length > 0 ? announcements : posts.filter(p => p.type === 'announcement');
      if (allAnnouncements.length > 0) {
        const latest = allAnnouncements[0];
        return {
          reply: `The latest family announcement for **${home?.name}** was shared by **${latest.author.name}** on ${latest.createdAt.slice(0, 10)}:\n\n> 📢 **"${latest.content}"**`,
          source: 'announcements',
          results: [
            {
              type: 'announcement',
              title: `Announcement by ${latest.author.name}`,
              subtitle: latest.createdAt.slice(0, 10),
              details: latest.content,
              data: latest
            }
          ],
          sources: [{ type: 'posts', title: 'Family Announcements' }]
        };
      } else {
        return {
          reply: `There are currently no announcements posted for **${home?.name}**. You can ask me: *"Create a family announcement saying we're leaving at 9"* to post one!`,
          source: 'announcements'
        };
      }
    }

    if (authorFilter) {
      const authorPosts = posts.filter(p => p.author.name.toLowerCase().includes(authorFilter!.toLowerCase()));
      if (authorPosts.length > 0) {
        const latest = authorPosts[0];
        return {
          reply: `Here is what **${latest.author.name}** posted on ${latest.createdAt.slice(0, 10)}:\n\n> "${latest.content}"`,
          source: 'posts',
          results: [
            {
              type: latest.type === 'announcement' ? 'announcement' : 'post',
              title: `${latest.author.name}'s Post`,
              subtitle: latest.createdAt.slice(0, 10),
              details: latest.content,
              data: latest
            }
          ],
          sources: [{ type: 'posts', title: 'Family Feed' }]
        };
      } else {
        return {
          reply: `I searched the family feed, but ${authorFilter} hasn't posted recently in **${home?.name}**.`,
          source: 'posts'
        };
      }
    }

    if (posts.length > 0) {
      const postList = posts.slice(0, 3).map(p =>
        `• **${p.author.name}** (${p.createdAt.slice(0, 10)}): "${p.content}"`
      ).join('\n');
      return {
        reply: `Here are the latest posts from your family feed:\n\n${postList}`,
        source: 'posts',
        results: posts.slice(0, 3).map(p => ({
          type: p.type === 'announcement' ? 'announcement' : 'post',
          title: `${p.author.name}'s Post`,
          subtitle: p.createdAt.slice(0, 10),
          details: p.content,
          data: p
        })),
        sources: [{ type: 'posts', title: 'Family Feed' }]
      };
    } else {
      return {
        reply: `No posts have been shared on the family feed yet for **${home?.name}**. You can share an update or photo directly on the Home tab!`,
        source: 'posts'
      };
    }
  }

  // D. Family Members
  if (isMemberOrFamily) {
    const list = members.map(m => `• **${m.name}** (${m.role})`).join('\n');
    return {
      reply: `**${home?.name}** currently has ${members.length} family member${members.length === 1 ? '' : 's'}:\n\n${list}\n\nInvite Code: **${home?.inviteCode}**`,
      source: 'members',
      results: members.map(m => ({
        type: 'member',
        title: m.name,
        subtitle: m.role,
        details: m.email,
        data: m
      })),
      sources: [{ type: 'members', title: 'Family Roster' }]
    };
  }

  // E. Memories
  if (isMemoryOrStory) {
    if (memories.length > 0) {
      const list = memories.map(m => {
        const details = [
          m.date,
          m.location ? `📍 ${m.location}` : '',
          m.taggedMembers && m.taggedMembers.length ? `👥 with ${m.taggedMembers.map((t: any) => t.name).join(', ')}` : ''
        ].filter(Boolean).join(' • ');
        return `• **${m.title}** (${details}): ${m.story}`;
      }).join('\n');
      return {
        reply: `Here are the scrapbook memories for **${home?.name}**:\n\n${list}`,
        source: 'memories',
        results: memories.slice(0, 3).map(m => ({
          type: 'memory',
          title: m.title,
          subtitle: m.date,
          details: m.story,
          data: m
        })),
        sources: [{ type: 'memories', title: 'Family Scrapbook' }]
      };
    } else {
      return {
        reply: `There are no memories saved in the family scrapbook yet. You can add one anytime in **Family > Memories** or ask me to record one!`,
        source: 'memories'
      };
    }
  }

  // Fallback friendly guidance
  return {
    reply: `Hello ${user.name}! I'm **Ask Homely**, your family assistant for **${home?.name}**.\n\nHere are some things I can do for you:\n• **Find information:** Ask *"Where are the spare keys?"* or *"What did Dad post?"*\n• **Check calendar:** Ask *"What events do we have this week?"* or *"Who is attending dinner?"*\n• **Remember details:** Tell me *"Remember that the gate code is 4921"*\n• **Take action:** Ask *"Create an event for dinner tomorrow at 8 PM"* or *"Create a family announcement saying we're leaving at 9"*\n\nHow can I help you today?`,
    source: 'assistant'
  };
}
