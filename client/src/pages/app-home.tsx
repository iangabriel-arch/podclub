import { useState } from 'react';
import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import type { ChannelWithMeta } from '@shared/schema';
import { MAX_CHANNELS_PER_USER } from '@shared/schema';
import { useAuth } from '@/lib/auth';
import { plural, relativeTime } from '@/lib/format';
import { CoverArt, Equalizer, LogoMark } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  CreateChannelDialog,
  DeleteChannelDialog,
  EditChannelDialog,
  InviteDialog,
} from '@/components/channel-dialogs';
import { MessageSquare, MoreHorizontal, Pencil, Plus, Trash2, UserPlus, Users } from 'lucide-react';

export default function AppHome() {
  const { user } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<ChannelWithMeta | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ChannelWithMeta | null>(null);
  const [inviteTarget, setInviteTarget] = useState<ChannelWithMeta | null>(null);

  const { data: channels, isLoading } = useQuery<ChannelWithMeta[]>({ queryKey: ['/api/channels'] });

  const mine = (channels ?? []).filter((c) => c.ownerId === user?.id);
  const joined = (channels ?? []).filter((c) => c.ownerId !== user?.id);
  const slotsLeft = MAX_CHANNELS_PER_USER - mine.length;

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-6 py-10">
        {/* --------------------------------- header -------------------------------- */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">
              {new Date().toLocaleDateString(undefined, {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
            </p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight">
              Good to see you, {user?.displayName.split(' ')[0]}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {slotsLeft > 0
                ? `You are hosting ${plural(mine.length, 'room')} and can start ${slotsLeft} more.`
                : 'You are hosting all five of your rooms. Delete one to start another.'}
            </p>
          </div>
          <Button onClick={() => setCreateOpen(true)} disabled={slotsLeft <= 0} data-testid="button-create-channel">
            <Plus className="h-4 w-4" />
            New channel
          </Button>
        </div>

        {/* -------------------------------- quota bar ------------------------------ */}
        <div className="mt-8 rounded-xl border border-card-border bg-card p-5 sheen">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Channel slots</p>
            <p className="text-sm tabular-nums text-muted-foreground" data-testid="text-slots">
              {mine.length} / {MAX_CHANNELS_PER_USER}
            </p>
          </div>
          <div className="mt-3 flex gap-1.5" role="img" aria-label={`${mine.length} of 5 channel slots used`}>
            {Array.from({ length: MAX_CHANNELS_PER_USER }).map((_, i) => (
              <span
                key={i}
                className={`h-1.5 flex-1 rounded-full ${i < mine.length ? 'bg-primary' : 'bg-muted'}`}
              />
            ))}
          </div>
        </div>

        {/* ------------------------------- your rooms ------------------------------ */}
        <section className="mt-10">
          <h2 className="text-base font-bold">Rooms you host</h2>
          {isLoading ? (
            <CardGridSkeleton />
          ) : mine.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-border p-10 text-center">
              <LogoMark className="mx-auto h-8 w-8 text-muted-foreground" />
              <p className="mt-4 text-sm font-medium">You are not hosting anything yet</p>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
                A room works with two people. Name it after the thing you actually want to talk
                about.
              </p>
              <Button className="mt-6" onClick={() => setCreateOpen(true)} data-testid="button-create-first">
                <Plus className="h-4 w-4" />
                Start your first channel
              </Button>
            </div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {mine.map((channel) => (
                <ChannelCard
                  key={channel.id}
                  channel={channel}
                  owned
                  onEdit={() => setEditTarget(channel)}
                  onDelete={() => setDeleteTarget(channel)}
                  onInvite={() => setInviteTarget(channel)}
                />
              ))}
            </div>
          )}
        </section>

        {/* ------------------------------ joined rooms ----------------------------- */}
        <section className="mt-12 pb-6">
          <h2 className="text-base font-bold">Rooms you joined</h2>
          {isLoading ? (
            <CardGridSkeleton />
          ) : joined.length === 0 ? (
            <div className="mt-4 rounded-xl border border-dashed border-border p-8 text-center">
              <p className="text-sm text-muted-foreground">
                Nothing yet. Someone has to send you an invite link, or browse{' '}
                <Link href="/discover" className="font-medium text-primary underline-offset-4 hover:underline">
                  the directory
                </Link>
                .
              </p>
            </div>
          ) : (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {joined.map((channel) => (
                <ChannelCard key={channel.id} channel={channel} />
              ))}
            </div>
          )}
        </section>
      </div>

      <CreateChannelDialog open={createOpen} onOpenChange={setCreateOpen} />
      {editTarget && (
        <EditChannelDialog
          channel={editTarget}
          open
          onOpenChange={(open) => !open && setEditTarget(null)}
        />
      )}
      {deleteTarget && (
        <DeleteChannelDialog
          channel={deleteTarget}
          open
          onOpenChange={(open) => !open && setDeleteTarget(null)}
        />
      )}
      {inviteTarget && (
        <InviteDialog
          channel={inviteTarget}
          open
          onOpenChange={(open) => !open && setInviteTarget(null)}
        />
      )}
    </div>
  );
}

export function ChannelCard({
  channel,
  owned = false,
  onEdit,
  onDelete,
  onInvite,
  footer,
}: {
  channel: ChannelWithMeta;
  owned?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onInvite?: () => void;
  footer?: React.ReactNode;
}) {
  return (
    <article
      className="group relative flex flex-col overflow-hidden rounded-xl border border-card-border bg-card sheen"
      data-testid={`card-channel-${channel.id}`}
    >
      <Link href={`/channels/${channel.id}`} className="block">
        <CoverArt seed={channel.hue} className="aspect-[16/10]">
          <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-4">
            <span className="rounded-full bg-black/35 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/90 backdrop-blur-sm">
              {channel.topic}
            </span>
            <Equalizer className="text-white/60 opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
        </CoverArt>
      </Link>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/channels/${channel.id}`} className="min-w-0">
            <h3 className="truncate text-base font-bold hover:text-primary" title={channel.name}>
              {channel.name}
            </h3>
          </Link>
          {owned && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="-mr-2 -mt-1 h-8 w-8 shrink-0"
                  aria-label={`Manage ${channel.name}`}
                  data-testid={`button-manage-${channel.id}`}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onSelect={onEdit} data-testid={`menu-edit-${channel.id}`}>
                  <Pencil className="h-4 w-4" />
                  Edit description
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onInvite} data-testid={`menu-invite-${channel.id}`}>
                  <UserPlus className="h-4 w-4" />
                  Invite link
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onSelect={onDelete}
                  className="text-destructive"
                  data-testid={`menu-delete-channel-${channel.id}`}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete channel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <p className="mt-2 line-clamp-2 flex-1 text-sm leading-relaxed text-muted-foreground">
          {channel.description || 'No description yet.'}
        </p>

        <div className="mt-4 flex items-center gap-4 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {channel.memberCount}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" />
            {channel.messageCount}
          </span>
          <span className="ml-auto">{relativeTime(channel.lastActivity)}</span>
        </div>

        {!owned && !footer && (
          <p className="mt-3 truncate text-xs text-muted-foreground">Hosted by {channel.ownerName}</p>
        )}
        {footer}
      </div>
    </article>
  );
}

function CardGridSkeleton() {
  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="overflow-hidden rounded-xl border border-card-border bg-card">
          <Skeleton className="aspect-[16/10] rounded-none" />
          <div className="space-y-3 p-5">
            <Skeleton className="h-4 w-2/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}
