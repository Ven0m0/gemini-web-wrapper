import { v4 as uuidv4 } from 'uuid';

export interface Session {
  id: string;
  userId: string;
  messages: Array<{ role: string; content: string; timestamp: number }>;
  createdAt: number;
  updatedAt: number;
}

export interface SessionManager {
  createSession(userId: string): Session;
  getSession(sessionId: string): Session | null;
  addMessage(sessionId: string, role: string, content: string): void;
  getHistory(sessionId: string): Array<{ role: string; content: string }>;
  listSessions(userId: string): Session[];
}

class InMemorySessionManager implements SessionManager {
  private sessions: Map<string, Session> = new Map();
  private userSessions: Map<string, Set<string>> = new Map();

  createSession(userId: string): Session {
    const session: Session = {
      id: uuidv4(),
      userId,
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    
    this.sessions.set(session.id, session);
    
    if (!this.userSessions.has(userId)) {
      this.userSessions.set(userId, new Set());
    }
    this.userSessions.get(userId)!.add(session.id);
    
    return session;
  }

  getSession(sessionId: string): Session | null {
    return this.sessions.get(sessionId) || null;
  }

  addMessage(sessionId: string, role: string, content: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    
    session.messages.push({
      role,
      content,
      timestamp: Date.now(),
    });
    session.updatedAt = Date.now();
  }

  getHistory(sessionId: string): Array<{ role: string; content: string }> {
    const session = this.sessions.get(sessionId);
    if (!session) return [];
    
    return session.messages.map(m => ({
      role: m.role,
      content: m.content,
    }));
  }

  listSessions(userId: string): Session[] {
    const sessionIds = this.userSessions.get(userId);
    if (!sessionIds) return [];
    
    return Array.from(sessionIds)
      .map(id => this.sessions.get(id))
      .filter((s): s is Session => s !== null)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }
}

let sessionManager: SessionManager | null = null;

export function getSessionManager(): SessionManager {
  if (!sessionManager) {
    sessionManager = new InMemorySessionManager();
  }
  return sessionManager;
}
