import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

/* ---------------------------------- users --------------------------------- */

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  displayName: text("display_name").notNull(),
  password: text("password").notNull(),
  role: text("role").notNull().default("user"), // "user" | "admin"
  banned: integer("banned").notNull().default(0),
  banReason: text("ban_reason"),
  bio: text("bio").notNull().default(""),
  hue: integer("hue").notNull().default(24),
  createdAt: integer("created_at").notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  banned: true,
  banReason: true,
  createdAt: true,
});

export const registerSchema = z.object({
  username: z
    .string()
    .min(3, "At least 3 characters")
    .max(20, "At most 20 characters")
    .regex(/^[a-z0-9_.]+$/, "Lowercase letters, numbers, _ and . only"),
  displayName: z.string().min(2, "At least 2 characters").max(40),
  password: z.string().min(6, "At least 6 characters").max(72),
});

export const loginSchema = z.object({
  username: z.string().min(1, "Enter your username"),
  password: z.string().min(1, "Enter your password"),
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;
export type PublicUser = Omit<User, "password">;

/* -------------------------------- channels -------------------------------- */

export const channels = sqliteTable("channels", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  topic: text("topic").notNull().default("Music"),
  ownerId: integer("owner_id").notNull(),
  inviteCode: text("invite_code").notNull().unique(),
  hue: integer("hue").notNull().default(24),
  createdAt: integer("created_at").notNull(),
});

export const channelFormSchema = z.object({
  name: z.string().min(3, "At least 3 characters").max(48),
  description: z.string().max(280, "Keep it under 280 characters"),
  topic: z.string().min(1),
});

export type Channel = typeof channels.$inferSelect;
export type ChannelForm = z.infer<typeof channelFormSchema>;

export type ChannelWithMeta = Channel & {
  ownerName: string;
  memberCount: number;
  messageCount: number;
  lastActivity: number | null;
};

/* ------------------------------- memberships ------------------------------ */

export const memberships = sqliteTable("memberships", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  channelId: integer("channel_id").notNull(),
  userId: integer("user_id").notNull(),
  joinedAt: integer("joined_at").notNull(),
});

export type Membership = typeof memberships.$inferSelect;

/* -------------------------------- messages -------------------------------- */

export const messages = sqliteTable("messages", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  channelId: integer("channel_id").notNull(),
  userId: integer("user_id").notNull(),
  body: text("body").notNull(),
  replyToId: integer("reply_to_id"),
  editedAt: integer("edited_at"),
  deleted: integer("deleted").notNull().default(0),
  createdAt: integer("created_at").notNull(),
});

export const messageFormSchema = z.object({
  body: z.string().min(1).max(2000),
  replyToId: z.number().nullable().optional(),
});

export type Message = typeof messages.$inferSelect;

export type MessageWithAuthor = Message & {
  authorName: string;
  authorUsername: string;
  authorHue: number;
  authorBanned: number;
  replyTo: {
    id: number;
    body: string;
    authorName: string;
    deleted: number;
  } | null;
};

/* --------------------------------- reports -------------------------------- */

export const reports = sqliteTable("reports", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  targetUserId: integer("target_user_id").notNull(),
  reporterId: integer("reporter_id").notNull(),
  channelId: integer("channel_id"),
  messageId: integer("message_id"),
  reason: text("reason").notNull(),
  status: text("status").notNull().default("open"), // "open" | "resolved" | "dismissed"
  createdAt: integer("created_at").notNull(),
});

export const reportFormSchema = z.object({
  targetUserId: z.number(),
  channelId: z.number().nullable().optional(),
  messageId: z.number().nullable().optional(),
  reason: z.string().min(4, "Tell us a bit more").max(280),
});

export type Report = typeof reports.$inferSelect;

export type ReportWithContext = Report & {
  targetName: string;
  targetUsername: string;
  targetBanned: number;
  targetHue: number;
  reporterName: string;
  channelName: string | null;
  messageBody: string | null;
  reportCount: number;
};

/* -------------------------------- constants ------------------------------- */

export const MAX_CHANNELS_PER_USER = 5;

export const TOPICS = [
  "Music",
  "Podcasts",
  "Hip-Hop",
  "Afrobeats",
  "Jazz",
  "Electronic",
  "Rock",
  "Amapiano",
  "Classical",
  "True Crime",
  "Tech Talk",
  "Lo-fi",
] as const;
