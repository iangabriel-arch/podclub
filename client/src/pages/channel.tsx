import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'wouter';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { ChannelWithMeta, MessageWithAuthor } from '@shared/schema';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { clockTime, dayLabel, plural, relativeTime } from '@/lib/format';
import { CoverArt, Equalizer, UserBadge } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useToast } from '@/hooks/use-toast';
import { DeleteChannelDialog, EditChannelDialog, InviteDialog } from '@/components/channel-dialogs';
import { ReportDialog, type ReportTarget } from '@/components/report-dialog';
import {
  CornerUpLeft,
  Flag,
  MoreHorizontal,
  Pencil,
  Send,
  Settings2,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';

type ChannelDetail = ChannelWithMeta & { isMember: boolean };
type Member = {
  id: number;
  username: string;
  displayName: string;
  hue: number;
  banned: number;
  role: string;
  joinedAt: number;
};

export default function ChannelPage() {
  const params = useParams<{ id: string }>();
  const channelId = Number(params.id);
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<MessageWithAuthor | null>(null);
  const [editing, setEditing] = useState<MessageWithAuthor | null>(null);
  const [editDraft, setEditDraft] = useState('');
  const [reportTarget, setReportTarget] = useState<ReportTarget | null>(null);
  const [showMembers, setShowMembers] = useState(true);
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [inviteOpen, setInviteOpen] = useState(false);

  const bottomRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const channelQuery = useQuery<ChannelDetail>({
    queryKey: ['/api/channels', channelId],
    enabled: Number.isFinite(channelId),
  });

  const messagesQuery = useQuery<MessageWithAuthor[]>({
    queryKey: ['/api/channels', channelId, 'messages'],
    enabled: Number.isFinite(channelId),
    refetchInterval: 5000,
  });

  const membersQuery = useQuery<Member[]>({
    queryKey: ['/api/channels', channelId, 'members'],
    enabled: Number.isFinite(channelId),
  });

  const channel = channelQuery.data;
  const messages = messagesQuery.data ?? [];
  const isOwner = channel?.ownerId === user?.id;
  const canPost = Boolean(channel?.isMember);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length, channelId]);

  useEffect(() => {
    setDraft('');
    setReplyTo(null);
    setEditing(null);
  }, [channelId]);

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['/api/channels', channelId, 'messages'] });
    void queryClient.invalidateQueries({ queryKey: ['/api/channels'] });
  };

  const sendMutation = useMutation({
    mutationFn: (body: string) =>
      apiRequest('POST', `/api/channels/${channelId}/messages`, {
        body,
        replyToId: replyTo?.id ?? null,
      }),
    onSuccess: () => {
      setDraft('');
      setReplyTo(null);
      invalidate();
    },
    onError: (error: Error) =>
      toast({ title: 'Message not sent', description: error.message, variant: 'destructive' }),
  });

  const editMutation = useMutation({
    mutationFn: ({ id, body }: { id: number; body: string }) =>
      apiRequest('PATCH', `/api/messages/${id}`, { body }),
    onSuccess: () => {
      setEditing(null);
      setEditDraft('');
      invalidate();
    },
    onError: (error: Error) =>
      toast({ title: 'Could not edit message', description: error.message, variant: 'destructive' }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest('DELETE', `/api/messages/${id}`),
    onSuccess: () => {
      invalidate();
      toast({ title: 'Message deleted' });
    },
    onError: (error: Error) =>
      toast({ title: 'Could not delete message', description: error.message, variant: 'destructive' }),
  });

  /** Group consecutive messages from the same author, and insert day dividers. */
  const grouped = useMemo(() => {
    const out: Array<
      | { kind: 'day'; key: string; label: string }
      | { kind: 'message'; key: string; message: MessageWithAuthor; compact: boolean }
    > = [];
    let lastDay = '';
    let lastAuthor = -1;
    let lastTime = 0;
    messages.forEach((message) => {
      const day = dayLabel(message.createdAt);
      if (day !== lastDay) {
        out.push({ kind: 'day', key: `day-${day}-${message.id}`, label: day });
        lastDay = day;
        lastAuthor = -1;
      }
      const compact =
        message.userId === lastAuthor &&
        message.createdAt - lastTime < 5 * 60_000 &&
        !message.replyToId;
      out.push({ kind: 'message', key: `m-${message.id}`, message, compact });
      lastAuthor = message.userId;
      lastTime = message.createdAt;
    });
    return out;
  }, [messages]);

  if (channelQuery.isLoading) {
    return <ChannelSkeleton />;
  }

  if (channelQuery.isError || !channel) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <div className="max-w-sm text-center">
          <h2 className="text-lg font-bold">This room is not available</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {(channelQuery.error as Error | null)?.message ??
              'The channel may have been deleted by its owner.'}
          </p>
          <Button className="mt-6" asChild>
            <Link href="/app">Back to your rooms</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="flex min-w-0 flex-1 flex-col">
        {/* -------------------------------- header ------------------------------- */}
        <header className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3 sm:gap-4 sm:px-5">
          <CoverArt seed={channel.hue} topic={channel.topic} thumb className="h-11 w-11 shrink-0 rounded-lg" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-base font-bold" data-testid="text-channel-title">
                {channel.name}
              </h1>
              <Badge
                variant="outline"
                className="hidden shrink-0 font-medium text-muted-foreground sm:inline-flex"
              >
                {channel.topic}
              </Badge>
              {isOwner && (
                <Badge variant="secondary" className="hidden shrink-0 sm:inline-flex">
                  You host
                </Badge>
              )}
            </div>
            <p className="truncate text-xs text-muted-foreground">
              {plural(channel.memberCount, 'member')} · {plural(messages.length, 'message')} ·{' '}
              {relativeTime(channel.lastActivity)}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowMembers((v) => !v)}
                  aria-label="Toggle member list"
                  data-testid="button-toggle-members"
                  className={cn(showMembers && 'bg-accent')}
                >
                  <Users className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Members</TooltipContent>
            </Tooltip>

            {(isOwner || isAdmin) && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setInviteOpen(true)}
                  data-testid="button-invite"
                >
                  <UserPlus className="h-4 w-4" />
                  <span className="hidden sm:inline">Invite</span>
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label="Channel settings" data-testid="button-channel-menu">
                      <Settings2 className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <DropdownMenuItem onSelect={() => setEditOpen(true)} data-testid="menu-edit-channel">
                      <Pencil className="h-4 w-4" />
                      Edit description
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setInviteOpen(true)}>
                      <UserPlus className="h-4 w-4" />
                      Invite link
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onSelect={() => setDeleteOpen(true)}
                      className="text-destructive"
                      data-testid="menu-delete-channel"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete channel
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </header>

        {/* ------------------------------- transcript ---------------------------- */}
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto max-w-3xl px-5 py-6">
            {/* room intro */}
            <div className="mb-8">
              <CoverArt seed={channel.hue} topic={channel.topic} className="h-16 w-16 rounded-xl" />
              <h2 className="mt-4 text-xl font-extrabold tracking-tight">{channel.name}</h2>
              <p className="mt-2 max-w-xl text-pretty text-sm leading-relaxed text-muted-foreground">
                {channel.description || 'No description yet.'}
              </p>
              <p className="mt-3 text-xs text-muted-foreground">
                Hosted by {channel.ownerName} · This is the beginning of the room.
              </p>
            </div>

            {messagesQuery.isLoading ? (
              <div className="space-y-6">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="h-9 w-9 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-3 w-32" />
                      <Skeleton className="h-3 w-full max-w-md" />
                      <Skeleton className="h-3 w-2/3 max-w-sm" />
                    </div>
                  </div>
                ))}
              </div>
            ) : messagesQuery.isError ? (
              <div className="rounded-lg border border-card-border bg-card p-6 text-center">
                <p className="text-sm font-medium">{(messagesQuery.error as Error).message}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Ask the host for an invite link to join this room.
                </p>
              </div>
            ) : messages.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border p-10 text-center">
                <Equalizer className="mx-auto text-primary" bars={4} />
                <p className="mt-4 text-sm font-medium">Nothing has been said yet</p>
                <p className="mx-auto mt-1 max-w-xs text-sm text-muted-foreground">
                  Drop the first record, or the first question. Rooms tend to wake up after one
                  message.
                </p>
              </div>
            ) : (
              <ol className="space-y-0.5">
                {grouped.map((item) =>
                  item.kind === 'day' ? (
                    <li key={item.key} className="flex items-center gap-3 py-5">
                      <Separator className="flex-1" />
                      <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
                      <Separator className="flex-1" />
                    </li>
                  ) : (
                    <MessageRow
                      key={item.key}
                      message={item.message}
                      compact={item.compact}
                      isMine={item.message.userId === user?.id}
                      canModerate={isAdmin || isOwner}
                      canPost={canPost}
                      isEditing={editing?.id === item.message.id}
                      editDraft={editDraft}
                      onEditDraft={setEditDraft}
                      onStartEdit={() => {
                        setEditing(item.message);
                        setEditDraft(item.message.body);
                      }}
                      onCancelEdit={() => {
                        setEditing(null);
                        setEditDraft('');
                      }}
                      onSaveEdit={() =>
                        editMutation.mutate({ id: item.message.id, body: editDraft.trim() })
                      }
                      savingEdit={editMutation.isPending}
                      onDelete={() => deleteMutation.mutate(item.message.id)}
                      onReply={() => {
                        setReplyTo(item.message);
                        composerRef.current?.focus();
                      }}
                      onReport={() =>
                        setReportTarget({
                          userId: item.message.userId,
                          name: item.message.authorName,
                          channelId: channel.id,
                          messageId: item.message.id,
                          quote: item.message.body,
                        })
                      }
                    />
                  )
                )}
              </ol>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* -------------------------------- composer ----------------------------- */}
        <div className="shrink-0 border-t border-border bg-background px-5 py-4">
          <div className="mx-auto max-w-3xl">
            {!canPost ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-card px-4 py-3">
                <p className="text-sm text-muted-foreground">
                  You are viewing this room but are not a member yet.
                </p>
                <Button size="sm" variant="outline" asChild>
                  <Link href="/discover">Find an invite</Link>
                </Button>
              </div>
            ) : (
              <>
                {replyTo && (
                  <div className="mb-2 flex items-start gap-2 rounded-md border-l-2 border-primary bg-muted/40 px-3 py-2">
                    <CornerUpLeft className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold">Replying to {replyTo.authorName}</p>
                      <p className="truncate text-xs text-muted-foreground">{replyTo.body}</p>
                    </div>
                    <button
                      onClick={() => setReplyTo(null)}
                      aria-label="Cancel reply"
                      className="rounded p-0.5 text-muted-foreground hover:text-foreground"
                      data-testid="button-cancel-reply"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                <div className="flex items-end gap-2 rounded-xl border border-input bg-card p-2 focus-within:border-ring">
                  <Textarea
                    ref={composerRef}
                    value={draft}
                    onChange={(event) => setDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        if (draft.trim()) sendMutation.mutate(draft.trim());
                      }
                    }}
                    rows={1}
                    placeholder={`Say something in ${channel.name}…`}
                    data-testid="input-message"
                    className="max-h-40 min-h-9 resize-none border-0 bg-transparent px-2 py-1.5 shadow-none focus-visible:ring-0"
                  />
                  <Button
                    size="icon"
                    onClick={() => draft.trim() && sendMutation.mutate(draft.trim())}
                    disabled={!draft.trim() || sendMutation.isPending}
                    aria-label="Send message"
                    data-testid="button-send"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
                <p className="mt-2 px-1 text-xs text-muted-foreground">
                  Enter to send · Shift + Enter for a new line
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* ------------------------------ member panel ----------------------------- */}
      {showMembers && (
        <aside className="hidden w-64 shrink-0 flex-col border-l border-border bg-sidebar xl:flex">
          <p className="px-5 py-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {plural(membersQuery.data?.length ?? 0, 'member')}
          </p>
          <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 pb-4">
            {(membersQuery.data ?? []).map((member) => (
              <li key={member.id} className="group flex items-center gap-3 rounded-md px-2 py-2">
                <UserBadge name={member.displayName} hue={member.hue} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-medium">{member.displayName}</span>
                    {member.banned === 1 && (
                      <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">
                        Banned
                      </Badge>
                    )}
                  </span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {member.id === channel.ownerId ? 'Host' : `@${member.username}`}
                  </span>
                </span>
                {member.id !== user?.id && (
                  <button
                    onClick={() =>
                      setReportTarget({
                        userId: member.id,
                        name: member.displayName,
                        channelId: channel.id,
                      })
                    }
                    aria-label={`Report ${member.displayName}`}
                    data-testid={`button-report-member-${member.id}`}
                    className="rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                  >
                    <Flag className="h-3.5 w-3.5" />
                  </button>
                )}
              </li>
            ))}
          </ul>
        </aside>
      )}

      <EditChannelDialog channel={channel} open={editOpen} onOpenChange={setEditOpen} />
      <DeleteChannelDialog
        channel={channel}
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        onDeleted={() => navigate('/app')}
      />
      <InviteDialog channel={channel} open={inviteOpen} onOpenChange={setInviteOpen} />
      <ReportDialog target={reportTarget} onClose={() => setReportTarget(null)} />
    </div>
  );
}

/* ------------------------------- message row ------------------------------- */

function MessageRow({
  message,
  compact,
  isMine,
  canModerate,
  canPost,
  isEditing,
  editDraft,
  onEditDraft,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  savingEdit,
  onDelete,
  onReply,
  onReport,
}: {
  message: MessageWithAuthor;
  compact: boolean;
  isMine: boolean;
  canModerate: boolean;
  canPost: boolean;
  isEditing: boolean;
  editDraft: string;
  onEditDraft: (value: string) => void;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  savingEdit: boolean;
  onDelete: () => void;
  onReply: () => void;
  onReport: () => void;
}) {
  /* Keeps the hover action bar mounted while its menu is open — otherwise the
     bar collapses on pointer-out and the menu loses its anchor. */
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <li
      className={cn('group relative rounded-md px-2 hover:bg-muted/40', compact ? 'py-0.5' : 'pt-3 pb-1')}
      data-testid={`message-${message.id}`}
    >
      {message.replyTo && (
        <div className="mb-1 flex items-center gap-1.5 pl-12 text-xs text-muted-foreground">
          <CornerUpLeft className="h-3 w-3 shrink-0" />
          <span className="font-medium text-foreground/80">{message.replyTo.authorName}</span>
          <span className="truncate italic">{message.replyTo.body}</span>
        </div>
      )}

      <div className="flex gap-3">
        <div className="w-9 shrink-0">
          {compact ? (
            <span className="hidden select-none pt-1 text-[10px] tabular-nums text-muted-foreground group-hover:block">
              {clockTime(message.createdAt)}
            </span>
          ) : (
            <UserBadge name={message.authorName} hue={message.authorHue} size="sm" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          {!compact && (
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-sm font-semibold">{message.authorName}</span>
              {message.authorBanned === 1 && (
                <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">
                  Banned
                </Badge>
              )}
              <span className="text-xs tabular-nums text-muted-foreground">
                {clockTime(message.createdAt)}
              </span>
            </div>
          )}

          {isEditing ? (
            <div className="mt-1.5">
              <Textarea
                value={editDraft}
                onChange={(event) => onEditDraft(event.target.value)}
                onFocus={(event) =>
                  event.currentTarget.scrollIntoView({ block: 'center', behavior: 'smooth' })
                }
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    if (editDraft.trim()) onSaveEdit();
                  }
                  if (event.key === 'Escape') onCancelEdit();
                }}
                rows={2}
                autoFocus
                data-testid={`input-edit-message-${message.id}`}
                className="resize-none"
              />
              <div className="mt-2 flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={onSaveEdit}
                  disabled={!editDraft.trim() || savingEdit}
                  data-testid={`button-save-edit-${message.id}`}
                >
                  Save
                </Button>
                <Button size="sm" variant="ghost" onClick={onCancelEdit}>
                  Cancel
                </Button>
                <span className="text-xs text-muted-foreground">Escape to cancel</span>
              </div>
            </div>
          ) : (
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">
              {message.body}
              {message.editedAt && (
                <span className="ml-1.5 align-baseline text-xs text-muted-foreground">(edited)</span>
              )}
            </p>
          )}
        </div>
      </div>

      {/* hover actions */}
      {!isEditing && canPost && (
        <div
          className={`absolute right-2 top-1 items-center gap-0.5 rounded-md border border-border bg-popover p-0.5 shadow-sm group-hover:flex ${
            menuOpen ? 'flex' : 'hidden'
          }`}
        >
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={onReply}
                aria-label="Reply"
                data-testid={`button-reply-${message.id}`}
              >
                <CornerUpLeft className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Reply</TooltipContent>
          </Tooltip>

          {isMine && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={onStartEdit}
                  aria-label="Edit"
                  data-testid={`button-edit-${message.id}`}
                >
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Edit</TooltipContent>
            </Tooltip>
          )}

          <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                aria-label="More actions"
                data-testid={`button-message-menu-${message.id}`}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onSelect={onReply}>
                <CornerUpLeft className="h-4 w-4" />
                Reply
              </DropdownMenuItem>
              {isMine && (
                <DropdownMenuItem onSelect={onStartEdit}>
                  <Pencil className="h-4 w-4" />
                  Edit message
                </DropdownMenuItem>
              )}
              {!isMine && (
                <DropdownMenuItem onSelect={onReport} data-testid={`menu-report-${message.id}`}>
                  <Flag className="h-4 w-4" />
                  Report author
                </DropdownMenuItem>
              )}
              {(isMine || canModerate) && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onSelect={onDelete}
                    className="text-destructive"
                    data-testid={`menu-delete-${message.id}`}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete message
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      )}
    </li>
  );
}

function ChannelSkeleton() {
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-4 border-b border-border px-5 py-3">
        <Skeleton className="h-11 w-11 rounded-lg" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-32" />
        </div>
      </div>
      <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
        <Skeleton className="h-16 w-16 rounded-xl" />
        <Skeleton className="h-5 w-56" />
        <Skeleton className="h-3 w-full max-w-md" />
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="h-9 w-9 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-3 w-full max-w-md" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
