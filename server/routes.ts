import type { Express, Request, Response } from 'express';
import type { Server } from 'node:http';
import { storage, stripPassword } from './storage';
import { seedIfEmpty } from './seed';
import {
  registerSchema,
  loginSchema,
  channelFormSchema,
  messageFormSchema,
  reportFormSchema,
  MAX_CHANNELS_PER_USER,
} from '@shared/schema';

/**
 * Auth model
 * ----------
 * The sandbox iframe blocks cookies and storage, so the client keeps the signed-in
 * user in React state and sends its id on every request via the `x-user-id` header.
 * Swapping this for a real token check is a one-line change in `currentUser`.
 */
function currentUser(req: Request) {
  const raw = req.header('x-user-id');
  if (!raw) return undefined;
  const id = Number(raw);
  if (!Number.isFinite(id)) return undefined;
  return storage.getUser(id);
}

function requireUser(req: Request, res: Response) {
  const user = currentUser(req);
  if (!user) {
    res.status(401).json({ message: 'Sign in to continue.' });
    return undefined;
  }
  if (user.banned) {
    res.status(403).json({ message: user.banReason || 'Your account has been suspended.' });
    return undefined;
  }
  return user;
}

function requireAdmin(req: Request, res: Response) {
  const user = requireUser(req, res);
  if (!user) return undefined;
  if (user.role !== 'admin') {
    res.status(403).json({ message: 'Admins only.' });
    return undefined;
  }
  return user;
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  seedIfEmpty();

  /* ---------------------------------- auth --------------------------------- */

  app.post('/api/auth/register', (req, res) => {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Invalid details.' });
    }
    if (storage.getUserByUsername(parsed.data.username)) {
      return res.status(409).json({ message: 'That username is already taken.' });
    }
    const user = storage.createUser({ ...parsed.data, role: 'user', bio: '', hue: 0 });
    return res.status(201).json(stripPassword(user));
  });

  app.post('/api/auth/login', (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Invalid details.' });
    }
    const user = storage.getUserByUsername(parsed.data.username.trim().toLowerCase());
    if (!user || user.password !== parsed.data.password) {
      return res.status(401).json({ message: 'Wrong username or password.' });
    }
    if (user.banned) {
      return res.status(403).json({ message: user.banReason || 'Your account has been suspended.' });
    }
    return res.json(stripPassword(user));
  });

  app.get('/api/auth/me', (req, res) => {
    const user = currentUser(req);
    if (!user) return res.status(401).json({ message: 'Not signed in.' });
    return res.json(stripPassword(user));
  });

  /* -------------------------------- channels ------------------------------- */

  app.get('/api/channels', (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    return res.json(storage.listChannelsForUser(user.id));
  });

  app.get('/api/channels/discover', (_req, res) => {
    return res.json(storage.listAllChannels());
  });

  app.get('/api/channels/owned', (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    return res.json(storage.listChannelsOwnedBy(user.id));
  });

  app.post('/api/channels', (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const parsed = channelFormSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Invalid channel.' });
    }
    if (storage.countChannelsOwnedBy(user.id) >= MAX_CHANNELS_PER_USER) {
      return res.status(409).json({
        message: `You can own ${MAX_CHANNELS_PER_USER} channels at a time. Delete one to make room.`,
      });
    }
    return res.status(201).json(storage.createChannel(user.id, parsed.data));
  });

  app.get('/api/channels/:id', (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const channel = storage.getChannel(Number(req.params.id));
    if (!channel) return res.status(404).json({ message: 'Channel not found.' });
    return res.json({ ...channel, isMember: storage.isMember(channel.id, user.id) });
  });

  app.patch('/api/channels/:id', (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const id = Number(req.params.id);
    const channel = storage.getChannel(id);
    if (!channel) return res.status(404).json({ message: 'Channel not found.' });
    if (channel.ownerId !== user.id && user.role !== 'admin') {
      return res.status(403).json({ message: 'Only the channel owner can edit this.' });
    }
    const parsed = channelFormSchema.partial().safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Invalid update.' });
    }
    return res.json(storage.updateChannel(id, parsed.data));
  });

  app.delete('/api/channels/:id', (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const id = Number(req.params.id);
    const channel = storage.getChannel(id);
    if (!channel) return res.status(404).json({ message: 'Channel not found.' });
    if (channel.ownerId !== user.id && user.role !== 'admin') {
      return res.status(403).json({ message: 'Only the channel owner can delete this.' });
    }
    storage.deleteChannel(id);
    return res.json({ ok: true });
  });

  app.get('/api/channels/:id/members', (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    return res.json(storage.listMembers(Number(req.params.id)));
  });

  app.post('/api/channels/:id/leave', (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const id = Number(req.params.id);
    const channel = storage.getChannel(id);
    if (!channel) return res.status(404).json({ message: 'Channel not found.' });
    if (channel.ownerId === user.id) {
      return res.status(409).json({ message: 'Owners cannot leave. Delete the channel instead.' });
    }
    storage.removeMember(id, user.id);
    return res.json({ ok: true });
  });

  /* --------------------------------- invites -------------------------------- */

  app.get('/api/invites/:code', (req, res) => {
    const channel = storage.getChannelByInvite(req.params.code);
    if (!channel) return res.status(404).json({ message: 'That invite link is not valid.' });
    return res.json(channel);
  });

  app.post('/api/invites/:code/accept', (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const channel = storage.getChannelByInvite(req.params.code);
    if (!channel) return res.status(404).json({ message: 'That invite link is not valid.' });
    storage.addMember(channel.id, user.id);
    return res.json(storage.getChannel(channel.id));
  });

  /* -------------------------------- messages ------------------------------- */

  app.get('/api/channels/:id/messages', (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const id = Number(req.params.id);
    if (!storage.getChannel(id)) return res.status(404).json({ message: 'Channel not found.' });
    if (!storage.isMember(id, user.id) && user.role !== 'admin') {
      return res.status(403).json({ message: 'Join this channel to read the conversation.' });
    }
    return res.json(storage.listMessages(id));
  });

  app.post('/api/channels/:id/messages', (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const id = Number(req.params.id);
    if (!storage.getChannel(id)) return res.status(404).json({ message: 'Channel not found.' });
    if (!storage.isMember(id, user.id)) {
      return res.status(403).json({ message: 'Join this channel to post.' });
    }
    const parsed = messageFormSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Message cannot be empty.' });
    return res.status(201).json(storage.createMessage(id, user.id, parsed.data.body.trim(), parsed.data.replyToId));
  });

  app.patch('/api/messages/:id', (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const id = Number(req.params.id);
    const message = storage.getMessage(id);
    if (!message || message.deleted) return res.status(404).json({ message: 'Message not found.' });
    if (message.userId !== user.id) {
      return res.status(403).json({ message: 'You can only edit your own messages.' });
    }
    const parsed = messageFormSchema.pick({ body: true }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Message cannot be empty.' });
    return res.json(storage.updateMessage(id, parsed.data.body.trim()));
  });

  app.delete('/api/messages/:id', (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const id = Number(req.params.id);
    const message = storage.getMessage(id);
    if (!message || message.deleted) return res.status(404).json({ message: 'Message not found.' });
    const channel = storage.getChannel(message.channelId);
    const canDelete =
      message.userId === user.id || user.role === 'admin' || channel?.ownerId === user.id;
    if (!canDelete) {
      return res.status(403).json({ message: 'You can only delete your own messages.' });
    }
    storage.softDeleteMessage(id);
    return res.json({ ok: true });
  });

  /* --------------------------------- reports ------------------------------- */

  app.post('/api/reports', (req, res) => {
    const user = requireUser(req, res);
    if (!user) return;
    const parsed = reportFormSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: parsed.error.issues[0]?.message ?? 'Invalid report.' });
    }
    if (parsed.data.targetUserId === user.id) {
      return res.status(400).json({ message: 'You cannot report yourself.' });
    }
    return res.status(201).json(storage.createReport(user.id, parsed.data));
  });

  /* ---------------------------------- admin -------------------------------- */

  app.get('/api/admin/stats', (req, res) => {
    if (!requireAdmin(req, res)) return;
    return res.json(storage.adminStats());
  });

  app.get('/api/admin/channels', (req, res) => {
    if (!requireAdmin(req, res)) return;
    return res.json(storage.listAllChannels());
  });

  app.get('/api/admin/reports', (req, res) => {
    if (!requireAdmin(req, res)) return;
    return res.json(storage.listReports());
  });

  app.get('/api/admin/users', (req, res) => {
    if (!requireAdmin(req, res)) return;
    return res.json(storage.listUsers());
  });

  app.post('/api/admin/users/:id/ban', (req, res) => {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const id = Number(req.params.id);
    const target = storage.getUser(id);
    if (!target) return res.status(404).json({ message: 'User not found.' });
    if (target.role === 'admin') return res.status(403).json({ message: 'Admins cannot be banned.' });
    const reason = typeof req.body?.reason === 'string' && req.body.reason.trim().length > 0
      ? req.body.reason.trim()
      : 'Violated community guidelines';
    const updated = storage.setBanned(id, true, reason);
    storage.resolveReportsForUser(id, 'resolved');
    return res.json(updated ? stripPassword(updated) : null);
  });

  app.post('/api/admin/users/:id/unban', (req, res) => {
    const admin = requireAdmin(req, res);
    if (!admin) return;
    const id = Number(req.params.id);
    const target = storage.getUser(id);
    if (!target) return res.status(404).json({ message: 'User not found.' });
    const updated = storage.setBanned(id, false);
    storage.resolveReportsForUser(id, 'dismissed');
    return res.json(updated ? stripPassword(updated) : null);
  });

  app.post('/api/admin/reports/:id/dismiss', (req, res) => {
    if (!requireAdmin(req, res)) return;
    return res.json(storage.setReportStatus(Number(req.params.id), 'dismissed'));
  });

  app.delete('/api/admin/channels/:id', (req, res) => {
    if (!requireAdmin(req, res)) return;
    storage.deleteChannel(Number(req.params.id));
    return res.json({ ok: true });
  });

  return httpServer;
}
