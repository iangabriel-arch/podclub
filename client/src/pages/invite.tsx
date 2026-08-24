import { Link, useLocation, useParams } from 'wouter';
import { useMutation, useQuery } from '@tanstack/react-query';
import type { ChannelWithMeta } from '@shared/schema';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { useAuth } from '@/lib/auth';
import { plural, relativeTime } from '@/lib/format';
import { CoverArt, LogoMark, Wordmark } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { Loader2, MessageSquare, Users } from 'lucide-react';

export default function InvitePage() {
  const { code } = useParams<{ code: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const { data: channel, isLoading, isError, error } = useQuery<ChannelWithMeta>({
    queryKey: ['/api/invites', code],
  });

  const accept = useMutation({
    mutationFn: async () => {
      const res = await apiRequest('POST', `/api/invites/${code}/accept`);
      return (await res.json()) as ChannelWithMeta;
    },
    onSuccess: (joined) => {
      void queryClient.invalidateQueries({ queryKey: ['/api/channels'] });
      toast({ title: `You are in ${joined.name}` });
      navigate(`/channels/${joined.id}`);
    },
    onError: (err: Error) =>
      toast({ title: 'Could not join', description: err.message, variant: 'destructive' }),
  });

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex h-16 items-center justify-between border-b border-border px-6">
        <Link href={user ? '/app' : '/'}>
          <Wordmark />
        </Link>
        {user && (
          <Button variant="ghost" size="sm" asChild>
            <Link href="/app">Your rooms</Link>
          </Button>
        )}
      </header>

      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          {isLoading ? (
            <div className="overflow-hidden rounded-2xl border border-card-border bg-card">
              <Skeleton className="aspect-[16/9] rounded-none" />
              <div className="space-y-3 p-6">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-3 w-full" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          ) : isError || !channel ? (
            <div className="rounded-2xl border border-card-border bg-card p-10 text-center sheen">
              <LogoMark className="mx-auto h-8 w-8 text-muted-foreground" />
              <h1 className="mt-5 text-lg font-bold">This invite is not valid</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {(error as Error | null)?.message ??
                  'The link may have expired, or the room was deleted.'}
              </p>
              <Button className="mt-6" asChild>
                <Link href={user ? '/discover' : '/'}>{user ? 'Browse rooms' : 'Go to PodClub'}</Link>
              </Button>
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-card-border bg-card sheen">
              <CoverArt seed={channel.hue} topic={channel.topic} className="aspect-[16/9]">
                <div className="absolute inset-x-0 bottom-0 p-5">
                  <span className="rounded-full bg-black/35 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/90 backdrop-blur-sm">
                    {channel.topic}
                  </span>
                </div>
              </CoverArt>

              <div className="p-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                  You have been invited
                </p>
                <h1 className="mt-2 text-xl font-extrabold tracking-tight">{channel.name}</h1>
                <p className="mt-3 text-pretty text-sm leading-relaxed text-muted-foreground">
                  {channel.description || 'No description yet.'}
                </p>

                <div className="mt-5 flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" />
                    {plural(channel.memberCount, 'member')}
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5" />
                    {plural(channel.messageCount, 'message')}
                  </span>
                  <span>{relativeTime(channel.lastActivity)}</span>
                </div>

                <p className="mt-5 text-xs text-muted-foreground">Hosted by {channel.ownerName}</p>

                {user ? (
                  <Button
                    className="mt-6 w-full"
                    onClick={() => accept.mutate()}
                    disabled={accept.isPending}
                    data-testid="button-accept-invite"
                  >
                    {accept.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Join this room
                  </Button>
                ) : (
                  <div className="mt-6 space-y-2">
                    <Button className="w-full" asChild data-testid="button-invite-signin">
                      <Link href="/auth">Sign in to join</Link>
                    </Button>
                    <p className="text-center text-xs text-muted-foreground">
                      New here?{' '}
                      <Link
                        href="/auth?mode=register"
                        className="font-medium text-primary underline-offset-4 hover:underline"
                      >
                        Create an account
                      </Link>{' '}
                      and come back to this link.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
