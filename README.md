# PodClub

A small, invite-only listening room for people who take music and podcasts seriously. Members create up to five channels, invite people by private link, and talk in threaded group chat. Admins moderate reports and can ban or unban members.

Project 31 — MVP frontend build.

## Stack

- **Frontend:** React 18 + TypeScript, Vite, Tailwind CSS v3, shadcn/ui, wouter (hash routing), TanStack Query v5
- **Backend (dev API):** Express + Drizzle ORM on SQLite (`data.db`)
- **Type:** Cabinet Grotesk (display) + Satoshi (body), via Fontshare
- **Palette:** zinc neutrals, dark-first, single gold accent

## Getting started

```bash
npm install
npm run db:push     # create the SQLite schema
npm run dev         # http://localhost:5000
```

`npm run dev` serves the API and the Vite client on the same port. The database seeds itself with demo channels, members, messages and open reports on first boot.

```bash
npm run build       # production bundle into dist/
npm start           # run the production build
npx tsc --noEmit    # typecheck
```

## Demo accounts

Password for every seeded account is `podclub`.

| Username   | Name           | Role                       |
| ---------- | -------------- | -------------------------- |
| `admin`    | Amara Njoroge  | Admin — moderation console  |
| `gabriel`  | Gabriel Ian    | Hosts Amapiano After Hours |
| `wanjiku`  | Wanjiku Mwangi | Hosts Sunday Morning Jazz  |
| `dami`     | Dami Okonkwo   | Hosts Afrobeats Deep Cuts  |
| `leo`      | Leo Fernandes  | Hosts Casefile Club        |
| `tasha`    | Tasha Wright   | Hosts Lo-fi & Long Focus   |
| `spamking` | Rex Vaughn     | Reported member            |

The auth screen has one-click demo buttons for the first three.

## Structure

```
client/src
  components/       brand marks, app shell, channel + report dialogs, shadcn/ui
  lib/              queryClient (API base + auth headers), auth context, formatters
  pages/            landing, auth, app-home, discover, channel, invite, admin
  index.css         design tokens (zinc + gold), artwork gradients, utilities
server/
  routes.ts         /api/auth, /api/channels, /api/invites, /api/messages, /api/reports, /api/admin
  storage.ts        data access
  seed.ts           demo data
shared/schema.ts    Drizzle tables + Zod schemas, MAX_CHANNELS_PER_USER = 5
```

## Pointing at an external API

All requests go through `apiRequest` in `client/src/lib/queryClient.ts`. Change `API_BASE` there to your external API base URL and the whole client follows. Auth is sent as an `x-user-id` header.

## MVP coverage

**User** — register / login, create a channel (hard cap of 5, enforced client and server side), update description, delete a channel, share an invite link, send messages, edit and delete own messages, reply to any message.

**Admin** — login, see every channel, review reports, ban a reported member (auto-resolves their open reports), unban.
