import { users, channels, memberships, messages, reports } from '@shared/schema';
import type {
  User,
  PublicUser,
  InsertUser,
  Channel,
  ChannelForm,
  ChannelWithMeta,
  Message,
  MessageWithAuthor,
  Report,
  ReportWithContext,
} from '@shared/schema';
import { DDL } from './ddl';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import { eq, and, desc, asc, sql, inArray } from 'drizzle-orm';

/**
 * Where the SQLite file lives. Locally this is ./data.db. On a serverless host
 * (Vercel) the project directory is read-only, so SQLITE_PATH points at /tmp and
 * the instance builds and seeds its own copy on cold start.
 */
const dbPath = process.env.SQLITE_PATH || 'data.db';

const sqlite = new Database(dbPath);
sqlite.pragma('journal_mode = WAL');
sqlite.exec(DDL);

export const db = drizzle(sqlite);

const now = () => Date.now();

function makeInviteCode() {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789';
  let out = '';
  for (let i = 0; i < 8; i += 1) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

function hueFromString(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) % 360;
  }
  return hash;
}

export function stripPassword(user: User): PublicUser {
  const { password: _password, ...rest } = user;
  return rest;
}

export class Storage {
  /* --------------------------------- users -------------------------------- */

  getUser(id: number): User | undefined {
    return db.select().from(users).where(eq(users.id, id)).get();
  }

  getUserByUsername(username: string): User | undefined {
    return db.select().from(users).where(eq(users.username, username)).get();
  }

  listUsers(): PublicUser[] {
    return db
      .select()
      .from(users)
      .orderBy(asc(users.id))
      .all()
      .map(stripPassword);
  }

  createUser(input: InsertUser): User {
    return db
      .insert(users)
      .values({
        username: input.username,
        displayName: input.displayName,
        password: input.password,
        role: input.role ?? 'user',
        bio: input.bio ?? '',
        hue: input.hue ?? hueFromString(input.username),
        createdAt: now(),
      })
      .returning()
      .get();
  }

  setBanned(userId: number, banned: boolean, reason?: string | null): User | undefined {
    return db
      .update(users)
      .set({ banned: banned ? 1 : 0, banReason: banned ? (reason ?? 'Violated community guidelines') : null })
      .where(eq(users.id, userId))
      .returning()
      .get();
  }

  /* ------------------------------- channels ------------------------------- */

  private decorate(rows: Channel[]): ChannelWithMeta[] {
    if (rows.length === 0) return [];
    const ids = rows.map((r) => r.id);

    const owners = db
      .select({ id: users.id, displayName: users.displayName })
      .from(users)
      .where(inArray(users.id, rows.map((r) => r.ownerId)))
      .all();
    const ownerMap = new Map(owners.map((o) => [o.id, o.displayName]));

    const memberCounts = db
      .select({ channelId: memberships.channelId, count: sql<number>`count(*)` })
      .from(memberships)
      .where(inArray(memberships.channelId, ids))
      .groupBy(memberships.channelId)
      .all();
    const memberMap = new Map(memberCounts.map((m) => [m.channelId, Number(m.count)]));

    const msgStats = db
      .select({
        channelId: messages.channelId,
        count: sql<number>`count(*)`,
        last: sql<number>`max(${messages.createdAt})`,
      })
      .from(messages)
      .where(and(inArray(messages.channelId, ids), eq(messages.deleted, 0)))
      .groupBy(messages.channelId)
      .all();
    const msgMap = new Map(msgStats.map((m) => [m.channelId, m]));

    return rows.map((row) => ({
      ...row,
      ownerName: ownerMap.get(row.ownerId) ?? 'Unknown',
      memberCount: memberMap.get(row.id) ?? 0,
      messageCount: Number(msgMap.get(row.id)?.count ?? 0),
      lastActivity: msgMap.get(row.id)?.last ? Number(msgMap.get(row.id)!.last) : null,
    }));
  }

  listAllChannels(): ChannelWithMeta[] {
    return this.decorate(db.select().from(channels).orderBy(desc(channels.createdAt)).all());
  }

  listChannelsOwnedBy(userId: number): ChannelWithMeta[] {
    return this.decorate(
      db.select().from(channels).where(eq(channels.ownerId, userId)).orderBy(desc(channels.createdAt)).all()
    );
  }

  listChannelsForUser(userId: number): ChannelWithMeta[] {
    const joined = db
      .select({ channelId: memberships.channelId })
      .from(memberships)
      .where(eq(memberships.userId, userId))
      .all()
      .map((m) => m.channelId);
    if (joined.length === 0) return [];
    return this.decorate(
      db.select().from(channels).where(inArray(channels.id, joined)).orderBy(desc(channels.createdAt)).all()
    );
  }

  countChannelsOwnedBy(userId: number): number {
    const row = db
      .select({ count: sql<number>`count(*)` })
      .from(channels)
      .where(eq(channels.ownerId, userId))
      .get();
    return Number(row?.count ?? 0);
  }

  getChannel(id: number): ChannelWithMeta | undefined {
    const row = db.select().from(channels).where(eq(channels.id, id)).get();
    if (!row) return undefined;
    return this.decorate([row])[0];
  }

  getChannelByInvite(code: string): ChannelWithMeta | undefined {
    const row = db.select().from(channels).where(eq(channels.inviteCode, code)).get();
    if (!row) return undefined;
    return this.decorate([row])[0];
  }

  createChannel(ownerId: number, input: ChannelForm): ChannelWithMeta {
    const row = db
      .insert(channels)
      .values({
        name: input.name,
        description: input.description ?? '',
        topic: input.topic,
        ownerId,
        inviteCode: makeInviteCode(),
        hue: hueFromString(input.name + input.topic),
        createdAt: now(),
      })
      .returning()
      .get();
    this.addMember(row.id, ownerId);
    return this.decorate([row])[0];
  }

  updateChannel(id: number, patch: Partial<ChannelForm>): ChannelWithMeta | undefined {
    const row = db.update(channels).set(patch).where(eq(channels.id, id)).returning().get();
    if (!row) return undefined;
    return this.decorate([row])[0];
  }

  deleteChannel(id: number) {
    db.delete(messages).where(eq(messages.channelId, id)).run();
    db.delete(memberships).where(eq(memberships.channelId, id)).run();
    db.delete(channels).where(eq(channels.id, id)).run();
  }

  /* ------------------------------- members -------------------------------- */

  addMember(channelId: number, userId: number) {
    const existing = db
      .select()
      .from(memberships)
      .where(and(eq(memberships.channelId, channelId), eq(memberships.userId, userId)))
      .get();
    if (existing) return existing;
    return db.insert(memberships).values({ channelId, userId, joinedAt: now() }).returning().get();
  }

  removeMember(channelId: number, userId: number) {
    db.delete(memberships)
      .where(and(eq(memberships.channelId, channelId), eq(memberships.userId, userId)))
      .run();
  }

  isMember(channelId: number, userId: number): boolean {
    return Boolean(
      db
        .select()
        .from(memberships)
        .where(and(eq(memberships.channelId, channelId), eq(memberships.userId, userId)))
        .get()
    );
  }

  listMembers(channelId: number) {
    return db
      .select({
        id: users.id,
        username: users.username,
        displayName: users.displayName,
        hue: users.hue,
        banned: users.banned,
        role: users.role,
        joinedAt: memberships.joinedAt,
      })
      .from(memberships)
      .innerJoin(users, eq(users.id, memberships.userId))
      .where(eq(memberships.channelId, channelId))
      .orderBy(asc(memberships.joinedAt))
      .all();
  }

  /* ------------------------------- messages ------------------------------- */

  listMessages(channelId: number): MessageWithAuthor[] {
    const rows = db
      .select()
      .from(messages)
      .where(eq(messages.channelId, channelId))
      .orderBy(asc(messages.createdAt))
      .all();
    if (rows.length === 0) return [];

    const authorIds = Array.from(new Set(rows.map((r) => r.userId)));
    const authors = db.select().from(users).where(inArray(users.id, authorIds)).all();
    const authorMap = new Map(authors.map((a) => [a.id, a]));
    const byId = new Map(rows.map((r) => [r.id, r]));

    return rows
      .filter((row) => row.deleted === 0)
      .map((row) => {
        const author = authorMap.get(row.userId);
        const parent = row.replyToId ? byId.get(row.replyToId) : undefined;
        const parentAuthor = parent ? authorMap.get(parent.userId) : undefined;
        return {
          ...row,
          authorName: author?.displayName ?? 'Unknown',
          authorUsername: author?.username ?? 'unknown',
          authorHue: author?.hue ?? 346,
          authorBanned: author?.banned ?? 0,
          replyTo: parent
            ? {
                id: parent.id,
                body: parent.deleted ? 'Message deleted' : parent.body,
                authorName: parentAuthor?.displayName ?? 'Unknown',
                deleted: parent.deleted,
              }
            : null,
        };
      });
  }

  getMessage(id: number): Message | undefined {
    return db.select().from(messages).where(eq(messages.id, id)).get();
  }

  createMessage(channelId: number, userId: number, body: string, replyToId?: number | null): Message {
    return db
      .insert(messages)
      .values({ channelId, userId, body, replyToId: replyToId ?? null, createdAt: now() })
      .returning()
      .get();
  }

  updateMessage(id: number, body: string): Message | undefined {
    return db.update(messages).set({ body, editedAt: now() }).where(eq(messages.id, id)).returning().get();
  }

  softDeleteMessage(id: number) {
    db.update(messages).set({ deleted: 1 }).where(eq(messages.id, id)).run();
  }

  /* -------------------------------- reports ------------------------------- */

  createReport(reporterId: number, input: {
    targetUserId: number;
    channelId?: number | null;
    messageId?: number | null;
    reason: string;
  }): Report {
    return db
      .insert(reports)
      .values({
        targetUserId: input.targetUserId,
        reporterId,
        channelId: input.channelId ?? null,
        messageId: input.messageId ?? null,
        reason: input.reason,
        createdAt: now(),
      })
      .returning()
      .get();
  }

  listReports(): ReportWithContext[] {
    const rows = db.select().from(reports).orderBy(desc(reports.createdAt)).all();
    if (rows.length === 0) return [];

    const allUsers = db.select().from(users).all();
    const userMap = new Map(allUsers.map((u) => [u.id, u]));
    const allChannels = db.select().from(channels).all();
    const channelMap = new Map(allChannels.map((c) => [c.id, c]));
    const msgIds = rows.map((r) => r.messageId).filter((v): v is number => typeof v === 'number');
    const msgs = msgIds.length ? db.select().from(messages).where(inArray(messages.id, msgIds)).all() : [];
    const msgMap = new Map(msgs.map((m) => [m.id, m]));

    const counts = new Map<number, number>();
    rows.forEach((r) => counts.set(r.targetUserId, (counts.get(r.targetUserId) ?? 0) + 1));

    return rows.map((row) => {
      const target = userMap.get(row.targetUserId);
      return {
        ...row,
        targetName: target?.displayName ?? 'Unknown',
        targetUsername: target?.username ?? 'unknown',
        targetBanned: target?.banned ?? 0,
        targetHue: target?.hue ?? 346,
        reporterName: userMap.get(row.reporterId)?.displayName ?? 'Unknown',
        channelName: row.channelId ? (channelMap.get(row.channelId)?.name ?? null) : null,
        messageBody: row.messageId ? (msgMap.get(row.messageId)?.body ?? null) : null,
        reportCount: counts.get(row.targetUserId) ?? 1,
      };
    });
  }

  setReportStatus(id: number, status: string) {
    return db.update(reports).set({ status }).where(eq(reports.id, id)).returning().get();
  }

  resolveReportsForUser(userId: number, status: string) {
    db.update(reports).set({ status }).where(and(eq(reports.targetUserId, userId), eq(reports.status, 'open'))).run();
  }

  /* --------------------------------- stats -------------------------------- */

  adminStats() {
    const count = (table: any) => Number(db.select({ c: sql<number>`count(*)` }).from(table).get()?.c ?? 0);
    const bannedRow = db
      .select({ c: sql<number>`count(*)` })
      .from(users)
      .where(eq(users.banned, 1))
      .get();
    const openRow = db
      .select({ c: sql<number>`count(*)` })
      .from(reports)
      .where(eq(reports.status, 'open'))
      .get();
    return {
      users: count(users),
      channels: count(channels),
      messages: count(messages),
      banned: Number(bannedRow?.c ?? 0),
      openReports: Number(openRow?.c ?? 0),
    };
  }
}

export const storage = new Storage();
