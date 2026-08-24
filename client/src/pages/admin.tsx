import { useState } from 'react';
import { Link } from 'wouter';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { ChannelWithMeta, PublicUser, ReportWithContext } from '@shared/schema';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { plural, relativeTime } from '@/lib/format';
import { CoverArt, UserBadge } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { DeleteChannelDialog } from '@/components/channel-dialogs';
import {
  Ban,
  CheckCircle2,
  Flag,
  Hash,
  Loader2,
  MessageSquare,
  ShieldCheck,
  Trash2,
  UserCheck,
  Users,
} from 'lucide-react';

type Stats = { users: number; channels: number; messages: number; banned: number; openReports: number };

export default function AdminPage() {
  const { toast } = useToast();
  const [banTarget, setBanTarget] = useState<{ id: number; name: string } | null>(null);
  const [banReason, setBanReason] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ChannelWithMeta | null>(null);

  const stats = useQuery<Stats>({ queryKey: ['/api/admin/stats'] });
  const reports = useQuery<ReportWithContext[]>({ queryKey: ['/api/admin/reports'] });
  const channels = useQuery<ChannelWithMeta[]>({ queryKey: ['/api/admin/channels'] });
  const users = useQuery<PublicUser[]>({ queryKey: ['/api/admin/users'] });

  function refresh() {
    ['/api/admin/stats', '/api/admin/reports', '/api/admin/channels', '/api/admin/users'].forEach(
      (key) => void queryClient.invalidateQueries({ queryKey: [key] })
    );
  }

  const ban = useMutation({
    mutationFn: ({ id, reason }: { id: number; reason: string }) =>
      apiRequest('POST', `/api/admin/users/${id}/ban`, { reason }),
    onSuccess: () => {
      refresh();
      setBanTarget(null);
      setBanReason('');
      toast({ title: 'Member banned', description: 'They can no longer sign in or post.' });
    },
    onError: (error: Error) =>
      toast({ title: 'Could not ban member', description: error.message, variant: 'destructive' }),
  });

  const unban = useMutation({
    mutationFn: (id: number) => apiRequest('POST', `/api/admin/users/${id}/unban`),
    onSuccess: () => {
      refresh();
      toast({ title: 'Member reinstated', description: 'They can sign in and post again.' });
    },
    onError: (error: Error) =>
      toast({ title: 'Could not unban member', description: error.message, variant: 'destructive' }),
  });

  const dismiss = useMutation({
    mutationFn: (id: number) => apiRequest('POST', `/api/admin/reports/${id}/dismiss`),
    onSuccess: () => {
      refresh();
      toast({ title: 'Report dismissed' });
    },
  });

  const openReports = (reports.data ?? []).filter((r) => r.status === 'open');
  const closedReports = (reports.data ?? []).filter((r) => r.status !== 'open');
  const bannedUsers = (users.data ?? []).filter((u) => u.banned === 1);

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-card-border bg-card text-primary">
            <ShieldCheck className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Moderation console</h1>
            <p className="text-sm text-muted-foreground">
              Every channel on PodClub, and every report members have filed.
            </p>
          </div>
        </div>

        {/* --------------------------------- stats --------------------------------- */}
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label="Members" value={stats.data?.users} icon={<Users className="h-4 w-4" />} />
          <StatCard label="Channels" value={stats.data?.channels} icon={<Hash className="h-4 w-4" />} />
          <StatCard
            label="Messages"
            value={stats.data?.messages}
            icon={<MessageSquare className="h-4 w-4" />}
          />
          <StatCard
            label="Open reports"
            value={stats.data?.openReports}
            icon={<Flag className="h-4 w-4" />}
            emphasis={(stats.data?.openReports ?? 0) > 0}
          />
        </div>

        <Tabs defaultValue="reports" className="mt-10">
          <TabsList>
            <TabsTrigger value="reports" data-testid="tab-reports">
              Reports
              {openReports.length > 0 && (
                <Badge variant="destructive" className="ml-2 px-1.5 py-0 text-[10px]">
                  {openReports.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="channels" data-testid="tab-channels">
              All channels
            </TabsTrigger>
            <TabsTrigger value="banned" data-testid="tab-banned">
              Banned
              {bannedUsers.length > 0 && (
                <Badge variant="secondary" className="ml-2 px-1.5 py-0 text-[10px]">
                  {bannedUsers.length}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ------------------------------- reports ------------------------------ */}
          <TabsContent value="reports" className="mt-6 space-y-3">
            {reports.isLoading ? (
              <RowSkeleton />
            ) : openReports.length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 className="h-6 w-6" />}
                title="Nothing waiting on you"
                body="No open reports. When a member reports someone, it lands here with the message attached."
              />
            ) : (
              openReports.map((report) => (
                <article
                  key={report.id}
                  className="rounded-xl border border-card-border bg-card p-5 sheen"
                  data-testid={`report-${report.id}`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="flex min-w-0 gap-3">
                      <UserBadge name={report.targetName} hue={report.targetHue} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-bold">{report.targetName}</p>
                          <span className="text-xs text-muted-foreground">
                            @{report.targetUsername}
                          </span>
                          {report.reportCount > 1 && (
                            <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">
                              {report.reportCount} reports
                            </Badge>
                          )}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          Reported by {report.reporterName}
                          {report.channelName && ` in ${report.channelName}`} ·{' '}
                          {relativeTime(report.createdAt)}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => dismiss.mutate(report.id)}
                        data-testid={`button-dismiss-${report.id}`}
                      >
                        Dismiss
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => {
                          setBanTarget({ id: report.targetUserId, name: report.targetName });
                          setBanReason(report.reason);
                        }}
                        data-testid={`button-ban-${report.targetUserId}`}
                      >
                        <Ban className="h-4 w-4" />
                        Ban member
                      </Button>
                    </div>
                  </div>

                  <p className="mt-4 rounded-md bg-muted/50 px-3 py-2 text-sm leading-relaxed">
                    {report.reason}
                  </p>
                  {report.messageBody && (
                    <blockquote className="mt-2 border-l-2 border-destructive px-3 py-1.5 text-sm italic text-muted-foreground">
                      “{report.messageBody}”
                    </blockquote>
                  )}
                </article>
              ))
            )}

            {closedReports.length > 0 && (
              <div className="pt-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Resolved ({closedReports.length})
                </p>
                <ul className="mt-3 space-y-2">
                  {closedReports.map((report) => (
                    <li
                      key={report.id}
                      className="flex flex-wrap items-center gap-3 rounded-lg border border-border px-4 py-3"
                    >
                      <UserBadge name={report.targetName} hue={report.targetHue} size="xs" />
                      <span className="text-sm font-medium">{report.targetName}</span>
                      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
                        {report.reason}
                      </span>
                      <Badge variant="outline" className="text-muted-foreground">
                        {report.status}
                      </Badge>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </TabsContent>

          {/* ------------------------------ channels ------------------------------ */}
          <TabsContent value="channels" className="mt-6">
            {channels.isLoading ? (
              <RowSkeleton />
            ) : (channels.data ?? []).length === 0 ? (
              <EmptyState
                icon={<Hash className="h-6 w-6" />}
                title="No channels yet"
                body="Once members start creating rooms they all appear here."
              />
            ) : (
              <ul className="space-y-2">
                {(channels.data ?? []).map((channel) => (
                  <li
                    key={channel.id}
                    className="flex flex-wrap items-center gap-4 rounded-xl border border-card-border bg-card p-4 sheen"
                    data-testid={`admin-channel-${channel.id}`}
                  >
                    <CoverArt seed={channel.hue} className="h-12 w-12 shrink-0 rounded-lg" />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/channels/${channel.id}`}
                          className="truncate text-sm font-bold hover:text-primary"
                        >
                          {channel.name}
                        </Link>
                        <Badge variant="outline" className="text-muted-foreground">
                          {channel.topic}
                        </Badge>
                      </div>
                      <p className="mt-0.5 truncate text-xs text-muted-foreground">
                        {channel.ownerName} · {plural(channel.memberCount, 'member')} ·{' '}
                        {plural(channel.messageCount, 'message')} · {relativeTime(channel.lastActivity)}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteTarget(channel)}
                      aria-label={`Delete ${channel.name}`}
                      data-testid={`button-admin-delete-${channel.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>

          {/* ------------------------------- banned ------------------------------- */}
          <TabsContent value="banned" className="mt-6">
            {users.isLoading ? (
              <RowSkeleton />
            ) : bannedUsers.length === 0 ? (
              <EmptyState
                icon={<UserCheck className="h-6 w-6" />}
                title="Nobody is banned"
                body="Bans show up here and can be lifted with one click."
              />
            ) : (
              <ul className="space-y-2">
                {bannedUsers.map((member) => (
                  <li
                    key={member.id}
                    className="flex flex-wrap items-center gap-4 rounded-xl border border-card-border bg-card p-4 sheen"
                    data-testid={`banned-user-${member.id}`}
                  >
                    <UserBadge name={member.displayName} hue={member.hue} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold">{member.displayName}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        @{member.username} · {member.banReason}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => unban.mutate(member.id)}
                      disabled={unban.isPending}
                      className="shrink-0"
                      data-testid={`button-unban-${member.id}`}
                    >
                      {unban.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <UserCheck className="h-4 w-4" />
                      )}
                      Lift ban
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </TabsContent>
        </Tabs>
      </div>

      {/* ------------------------------ ban dialog ------------------------------ */}
      <AlertDialog open={Boolean(banTarget)} onOpenChange={(open) => !open && setBanTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ban {banTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They will be signed out and blocked from posting. Their messages stay in place. You can
              lift this at any time from the Banned tab.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <label htmlFor="ban-reason" className="text-sm font-medium">
              Reason on record
            </label>
            <Input
              id="ban-reason"
              value={banReason}
              onChange={(event) => setBanReason(event.target.value)}
              placeholder="Repeated promo spam after warnings"
              data-testid="input-ban-reason"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={(event) => {
                event.preventDefault();
                if (banTarget) ban.mutate({ id: banTarget.id, reason: banReason });
              }}
              data-testid="button-confirm-ban"
            >
              {ban.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Ban member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {deleteTarget && (
        <DeleteChannelDialog
          channel={deleteTarget}
          open
          onOpenChange={(open) => !open && setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  emphasis = false,
}: {
  label: string;
  value: number | undefined;
  icon: React.ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div className="rounded-xl border border-card-border bg-card p-4 sheen">
      <p className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <span className={emphasis ? 'text-destructive' : 'text-muted-foreground'}>{icon}</span>
        {label}
      </p>
      {value === undefined ? (
        <Skeleton className="mt-2 h-7 w-12" />
      ) : (
        <p
          className={`mt-1 text-2xl font-extrabold tabular-nums tracking-tight ${
            emphasis ? 'text-destructive' : ''
          }`}
          data-testid={`stat-${label.toLowerCase().replace(/\s+/g, '-')}`}
        >
          {value}
        </p>
      )}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-border p-12 text-center">
      <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground">
        {icon}
      </span>
      <p className="mt-4 text-sm font-bold">{title}</p>
      <p className="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-4 rounded-xl border border-card-border bg-card p-4">
          <Skeleton className="h-12 w-12 rounded-lg" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3 w-56" />
          </div>
        </div>
      ))}
    </div>
  );
}
