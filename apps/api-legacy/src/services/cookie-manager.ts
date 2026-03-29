import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import type { CookieItem } from '../models';

export interface CookieProfile {
  id: string;
  name: string;
  cookies: CookieItem[];
  createdAt: number;
  updatedAt: number;
}

export class CookieManager {
  private db: Database.Database | null = null;
  private dbPath: string;

  constructor(dbPath: string = 'data/cookies.db') {
    this.dbPath = dbPath;
  }

  async init(): Promise<void> {
    this.db = new Database(this.dbPath);
    this.db.pragma('journal_mode = WAL');
    
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS profiles (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        cookies TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);
    
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_profiles_name ON profiles(name)
    `);
  }

  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
  }

  async saveProfile(name: string, cookies: CookieItem[]): Promise<CookieProfile> {
    if (!this.db) throw new Error('Database not initialized');
    
    const now = Date.now();
    const id = uuidv4();
    const cookiesJson = JSON.stringify(cookies);
    
    const stmt = this.db.prepare(`
      INSERT INTO profiles (id, name, cookies, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(name) DO UPDATE SET
        cookies = excluded.cookies,
        updated_at = excluded.updated_at
    `);
    
    stmt.run(id, name, cookiesJson, now, now);
    
    return {
      id,
      name,
      cookies,
      createdAt: now,
      updatedAt: now,
    };
  }

  async loadProfile(name: string): Promise<CookieProfile | null> {
    if (!this.db) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare('SELECT * FROM profiles WHERE name = ?');
    const row = stmt.get(name) as { id: string; name: string; cookies: string; created_at: number; updated_at: number } | undefined;
    
    if (!row) return null;
    
    return {
      id: row.id,
      name: row.name,
      cookies: JSON.parse(row.cookies),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async listProfiles(): Promise<Array<{ name: string; createdAt: number }>> {
    if (!this.db) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare('SELECT name, created_at FROM profiles ORDER BY created_at DESC');
    const rows = stmt.all() as Array<{ name: string; created_at: number }>;
    
    return rows.map(row => ({
      name: row.name,
      createdAt: row.created_at,
    }));
  }

  async deleteProfile(name: string): Promise<boolean> {
    if (!this.db) throw new Error('Database not initialized');
    
    const stmt = this.db.prepare('DELETE FROM profiles WHERE name = ?');
    const result = stmt.run(name);
    
    return result.changes > 0;
  }

  async getGeminiCookies(profileName?: string): Promise<CookieItem[] | null> {
    const profile = await this.loadProfile(profileName || 'default');
    if (!profile) return null;
    
    const requiredCookies = ['__Secure-1PSID', '__Secure-1PSIDTS'];
    const hasRequired = requiredCookies.every(name =>
      profile.cookies.some(c => c.name === name)
    );
    
    if (!hasRequired) return null;
    
    return profile.cookies.filter(c => {
      const domain = c.domain;
      return domain === 'google.com' || domain.endsWith('.google.com');
    });
  }
}

let cookieManager: CookieManager | null = null;

export function getCookieManager(): CookieManager {
  if (!cookieManager) {
    cookieManager = new CookieManager();
  }
  return cookieManager;
}
