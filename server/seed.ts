import { storage, db } from './storage';
import { users } from '@shared/schema';
import { sql } from 'drizzle-orm';

const PEOPLE = [
  { username: 'admin', displayName: 'Amara Njoroge', role: 'admin', bio: 'Keeping PodClub kind.', hue: 346 },
  { username: 'gabriel', displayName: 'Gabriel Ian', role: 'user', bio: 'Builder. Amapiano at 2am.', hue: 268 },
  { username: 'wanjiku', displayName: 'Wanjiku Mwangi', role: 'user', bio: 'Vinyl, jazz, long drives.', hue: 190 },
  { username: 'dami', displayName: 'Dami Okonkwo', role: 'user', bio: 'Afrobeats archivist.', hue: 32 },
  { username: 'leo', displayName: 'Leo Fernandes', role: 'user', bio: 'True crime podcasts only.', hue: 120 },
  { username: 'tasha', displayName: 'Tasha Wright', role: 'user', bio: 'Lo-fi for deep work.', hue: 220 },
  { username: 'spamking', displayName: 'Rex Vaughn', role: 'user', bio: 'DM me for promo codes!!!', hue: 8 },
];

const CHANNEL_SEED: Array<{
  owner: string;
  name: string;
  topic: string;
  description: string;
  members: string[];
  thread: Array<{ by: string; body: string; replyTo?: number }>;
}> = [
  {
    owner: 'gabriel',
    name: 'Amapiano After Hours',
    topic: 'Amapiano',
    description:
      'Log-drum obsessives trading late-night sets. Drop a timestamp with every link — we listen before we talk.',
    members: ['gabriel', 'wanjiku', 'dami', 'tasha', 'spamking'],
    thread: [
      { by: 'gabriel', body: 'New Kabza set dropped this morning. The 14 minute mark is genuinely unfair.' },
      { by: 'dami', body: 'Just got there. That transition into the vocal chop is criminal.' },
      { by: 'wanjiku', body: 'Okay but does anyone else think the log drum is mixed too hot on this one?', replyTo: 1 },
      { by: 'gabriel', body: 'A little. I think it is intentional though, it is built for a big room.', replyTo: 3 },
      { by: 'tasha', body: 'Adding it to the shared playlist. Third one this week that I actually kept.' },
      { by: 'spamking', body: 'CHECK MY LINK IN BIO FOR FREE BEATS 🔥🔥🔥 promo code AMAP50' },
      { by: 'dami', body: 'Reported. Take that somewhere else.', replyTo: 6 },
    ],
  },
  {
    owner: 'wanjiku',
    name: 'Sunday Morning Jazz',
    topic: 'Jazz',
    description: 'Slow records and slower conversation. One album per week, discussed properly.',
    members: ['wanjiku', 'gabriel', 'leo'],
    thread: [
      { by: 'wanjiku', body: 'This week: Alice Coltrane, Journey in Satchidananda. Start to finish, no skipping.' },
      { by: 'leo', body: 'First time hearing this. The harp completely reframes what I thought jazz could do.' },
      { by: 'wanjiku', body: 'That is exactly the reaction I was hoping for.', replyTo: 2 },
      { by: 'gabriel', body: 'Track two is the one I keep coming back to. Something about the drone underneath it.' },
    ],
  },
  {
    owner: 'dami',
    name: 'Afrobeats Deep Cuts',
    topic: 'Afrobeats',
    description: 'Beyond the singles. Album tracks, B-sides, and the producers who never get credited.',
    members: ['dami', 'gabriel', 'tasha'],
    thread: [
      { by: 'dami', body: 'Unpopular opinion: the best Burna track is a deluxe edition bonus cut nobody streams.' },
      { by: 'tasha', body: 'Name it or the claim does not count.' },
      { by: 'dami', body: 'Fair. Dropping it in the playlist tonight, I want reactions before I explain myself.', replyTo: 2 },
    ],
  },
  {
    owner: 'leo',
    name: 'Casefile Club',
    topic: 'True Crime',
    description: 'Weekly episode breakdowns. Spoiler-tagged, no speculation about living suspects.',
    members: ['leo', 'wanjiku'],
    thread: [
      { by: 'leo', body: 'Episode 247 discussion thread. Please tag spoilers past the first act.' },
      { by: 'wanjiku', body: 'The pacing in the second half was rough but the interview at the end saved it.' },
    ],
  },
  {
    owner: 'tasha',
    name: 'Lo-fi & Long Focus',
    topic: 'Lo-fi',
    description: 'Background music for people who ship things. Share what got you through the deadline.',
    members: ['tasha', 'gabriel', 'dami', 'leo'],
    thread: [
      { by: 'tasha', body: 'Four hours of deep work on one 40 minute loop. I have no notes.' },
      { by: 'gabriel', body: 'This is the one I had on while rebuilding the whole front end. Endorsed.' },
    ],
  },
];

export function seedIfEmpty() {
  const existing = Number(db.select({ c: sql<number>`count(*)` }).from(users).get()?.c ?? 0);
  if (existing > 0) return;

  const created = new Map<string, number>();
  PEOPLE.forEach((p) => {
    const user = storage.createUser({
      username: p.username,
      displayName: p.displayName,
      password: 'podclub',
      role: p.role,
      bio: p.bio,
      hue: p.hue,
    });
    created.set(p.username, user.id);
  });

  CHANNEL_SEED.forEach((c) => {
    const ownerId = created.get(c.owner)!;
    const channel = storage.createChannel(ownerId, {
      name: c.name,
      description: c.description,
      topic: c.topic,
    });
    c.members.forEach((m) => storage.addMember(channel.id, created.get(m)!));

    const ids: number[] = [];
    c.thread.forEach((entry, index) => {
      const replyTarget = entry.replyTo ? ids[entry.replyTo - 1] : null;
      const msg = storage.createMessage(channel.id, created.get(entry.by)!, entry.body, replyTarget);
      // stagger timestamps so the transcript reads chronologically
      db.run(
        sql`update messages set created_at = ${Date.now() - (c.thread.length - index) * 1000 * 60 * 17} where id = ${msg.id}`
      );
      ids[index] = msg.id;
    });
  });

  // A pending moderation case so the admin console has something real to act on.
  const spam = created.get('spamking')!;
  storage.createReport(created.get('dami')!, {
    targetUserId: spam,
    channelId: 1,
    reason: 'Posting promo spam in Amapiano After Hours after being asked to stop.',
  });
  storage.createReport(created.get('wanjiku')!, {
    targetUserId: spam,
    channelId: 1,
    reason: 'Same copy-pasted promo message across multiple channels.',
  });
}
