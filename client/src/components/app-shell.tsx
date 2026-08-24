import { useState } from 'react';
import { Link, useLocation } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import type { ChannelWithMeta } from '@shared/schema';
import { MAX_CHANNELS_PER_USER } from '@shared/schema';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { CoverArt, UserBadge, Wordmark } from '@/components/brand';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { CreateChannelDialog } from '@/components/channel-dialogs';
import { Compass, LogOut, Menu, Plus, ShieldCheck, X } from 'lucide-react';

export function AppShell({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, logout } = useAuth();
  const [location, navigate] = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const { data: channels, isLoading } = useQuery<ChannelWithMeta[]>({
    queryKey: ['/api/channels'],
    enabled: Boolean(user),
  });

  const owned = (channels ?? []).filter((c) => c.ownerId === user?.id);
  const atCap = owned.length >= MAX_CHANNELS_PER_USER;

  const nav = (
    <div className="flex h-full flex-col">
      <div className="flex h-16 items-center justify-between px-5">
        <Link href="/app" onClick={() => setMobileOpen(false)}>
          <Wordmark />
        </Link>
        <Button
          variant="ghost"
          size="icon"
          className="lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="px-3 pb-2">
        <Button
          className="w-full justify-start"
          onClick={() => setCreateOpen(true)}
          disabled={atCap}
          data-testid="button-open-create-channel"
        >
          <Plus className="h-4 w-4" />
          New channel
        </Button>
        <p className="mt-2 px-1 text-xs text-muted-foreground" data-testid="text-channel-quota">
          {owned.length} of {MAX_CHANNELS_PER_USER} channels used
          {atCap && ' — delete one to add another'}
        </p>
      </div>

      <nav className="px-3 py-2">
        <SidebarLink
          href="/discover"
          active={location === '/discover'}
          onNavigate={() => setMobileOpen(false)}
          icon={<Compass className="h-4 w-4" />}
          label="Discover rooms"
        />
        {isAdmin && (
          <SidebarLink
            href="/admin"
            active={location.startsWith('/admin')}
            onNavigate={() => setMobileOpen(false)}
            icon={<ShieldCheck className="h-4 w-4" />}
            label="Moderation"
          />
        )}
      </nav>

      <div className="mt-2 flex min-h-0 flex-1 flex-col">
        <p className="px-5 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Your rooms
        </p>
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
          {isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="flex items-center gap-3 px-2 py-2">
                  <Skeleton className="h-9 w-9 rounded-md" />
                  <div className="flex-1 space-y-1.5">
                    <Skeleton className="h-3 w-3/4" />
                    <Skeleton className="h-2.5 w-1/2" />
                  </div>
                </div>
              ))}
            </div>
          ) : (channels ?? []).length === 0 ? (
            <p className="px-2 py-3 text-sm leading-relaxed text-muted-foreground">
              No rooms yet. Create one, or accept an invite link from a friend.
            </p>
          ) : (
            <ul className="space-y-1">
              {(channels ?? []).map((channel) => {
                const active = location === `/channels/${channel.id}`;
                return (
                  <li key={channel.id}>
                    <Link
                      href={`/channels/${channel.id}`}
                      onClick={() => setMobileOpen(false)}
                      data-testid={`link-channel-${channel.id}`}
                      className={cn(
                        'flex items-center gap-3 rounded-md px-2 py-2 hover-elevate',
                        active && 'bg-sidebar-accent'
                      )}
                    >
                      <CoverArt seed={channel.hue} className="h-9 w-9 shrink-0 rounded-md" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{channel.name}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {channel.ownerId === user?.id ? 'You host' : `Hosted by ${channel.ownerName}`}
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* -------------------------------- account ------------------------------- */}
      <div className="border-t border-sidebar-border p-3">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left hover-elevate"
              data-testid="button-account-menu"
            >
              <UserBadge name={user?.displayName ?? ''} hue={user?.hue} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{user?.displayName}</span>
                <span className="block truncate text-xs text-muted-foreground">@{user?.username}</span>
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-56">
            <DropdownMenuLabel className="font-normal">
              <span className="block text-sm font-medium">{user?.displayName}</span>
              <span className="block text-xs text-muted-foreground">
                {isAdmin ? 'Administrator' : 'Member'}
              </span>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            {isAdmin && (
              <DropdownMenuItem onSelect={() => navigate('/admin')} data-testid="menu-admin">
                <ShieldCheck className="h-4 w-4" />
                Moderation console
              </DropdownMenuItem>
            )}
            <DropdownMenuItem
              onSelect={() => {
                logout();
                navigate('/');
              }}
              data-testid="menu-signout"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* desktop sidebar */}
      <aside className="hidden w-72 shrink-0 border-r border-sidebar-border bg-sidebar lg:block">
        {nav}
      </aside>

      {/* mobile sidebar */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/60 animate-fade-in"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="absolute inset-y-0 left-0 w-72 border-r border-sidebar-border bg-sidebar animate-rise-in">
            {nav}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4 lg:hidden">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation"
            data-testid="button-open-nav"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <Wordmark />
        </div>
        <div className="min-h-0 flex-1 overflow-hidden">{children}</div>
      </div>

      <CreateChannelDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}

function SidebarLink({
  href,
  active,
  icon,
  label,
  onNavigate,
}: {
  href: string;
  active: boolean;
  icon: React.ReactNode;
  label: string;
  onNavigate: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
      data-testid={`link-nav-${label.toLowerCase().replace(/\s+/g, '-')}`}
      className={cn(
        'flex items-center gap-3 rounded-md px-2 py-2 text-sm font-medium hover-elevate',
        active ? 'bg-sidebar-accent text-foreground' : 'text-muted-foreground'
      )}
    >
      {icon}
      {label}
    </Link>
  );
}
