/**
 * Schema DDL, generated from ./migrations by drizzle-kit and made idempotent.
 * Applied on boot so a cold serverless instance can build its own database.
 */
export const DDL = `
CREATE TABLE IF NOT EXISTS "channels" (
	"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"topic" text DEFAULT 'Music' NOT NULL,
	"owner_id" integer NOT NULL,
	"invite_code" text NOT NULL,
	"hue" integer DEFAULT 346 NOT NULL,
	"created_at" integer NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "channels_invite_code_unique" ON "channels" ("invite_code");
CREATE TABLE IF NOT EXISTS "memberships" (
	"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	"channel_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"joined_at" integer NOT NULL
);

CREATE TABLE IF NOT EXISTS "messages" (
	"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	"channel_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"body" text NOT NULL,
	"reply_to_id" integer,
	"edited_at" integer,
	"deleted" integer DEFAULT 0 NOT NULL,
	"created_at" integer NOT NULL
);

CREATE TABLE IF NOT EXISTS "reports" (
	"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	"target_user_id" integer NOT NULL,
	"reporter_id" integer NOT NULL,
	"channel_id" integer,
	"message_id" integer,
	"reason" text NOT NULL,
	"status" text DEFAULT 'open' NOT NULL,
	"created_at" integer NOT NULL
);

CREATE TABLE IF NOT EXISTS "users" (
	"id" integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	"username" text NOT NULL,
	"display_name" text NOT NULL,
	"password" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"banned" integer DEFAULT 0 NOT NULL,
	"ban_reason" text,
	"bio" text DEFAULT '' NOT NULL,
	"hue" integer DEFAULT 346 NOT NULL,
	"created_at" integer NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "users_username_unique" ON "users" ("username");
`;
