import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { ChannelWithMeta } from '@shared/schema';
import { TOPICS } from '@shared/schema';
import { useAuth } from '@/lib/auth';
import { ChannelCard } from '@/pages/app-home';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Search } from 'lucide-react';

export default function Discover() {
  const { user } = useAuth();
  const [query, setQuery] = useState('');
  const [topic, setTopic] = useState<string | null>(null);

  const { data: channels, isLoading } = useQuery<ChannelWithMeta[]>({
    queryKey: ['/api/channels/discover'],
  });
  const { data: mine } = useQuery<ChannelWithMeta[]>({ queryKey: ['/api/channels'] });
  const memberIds = new Set((mine ?? []).map((c) => c.id));

  const activeTopics = useMemo(() => {
    const present = new Set((channels ?? []).map((c) => c.topic));
    return TOPICS.filter((t) => present.has(t));
  }, [channels]);

  const results = (channels ?? []).filter((channel) => {
    const matchesTopic = !topic || channel.topic === topic;
    const needle = query.trim().toLowerCase();
    const matchesQuery =
      needle.length === 0 ||
      channel.name.toLowerCase().includes(needle) ||
      channel.description.toLowerCase().includes(needle) ||
      channel.ownerName.toLowerCase().includes(needle);
    return matchesTopic && matchesQuery;
  });

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <h1 className="text-2xl font-extrabold tracking-tight">Discover rooms</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
          Every room on PodClub is invite-only, so this is the directory rather than the door. Find
          something you like and ask the host for a link.
        </p>

        <div className="mt-8 space-y-4">
          <div className="relative max-w-md">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search rooms, topics or hosts"
              className="pl-9"
              data-testid="input-search-rooms"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <FilterChip active={topic === null} onClick={() => setTopic(null)} label="All topics" />
            {activeTopics.map((option) => (
              <FilterChip
                key={option}
                active={topic === option}
                onClick={() => setTopic(topic === option ? null : option)}
                label={option}
              />
            ))}
          </div>
        </div>

        {isLoading ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="overflow-hidden rounded-xl border border-card-border bg-card">
                <Skeleton className="aspect-[16/10] rounded-none" />
                <div className="space-y-3 p-5">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            ))}
          </div>
        ) : results.length === 0 ? (
          <div className="mt-8 rounded-xl border border-dashed border-border p-12 text-center">
            <p className="text-sm font-medium">No rooms match that</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Try a different topic, or start the room yourself.
            </p>
          </div>
        ) : (
          <>
            <p className="mt-8 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {results.length} {results.length === 1 ? 'room' : 'rooms'}
            </p>
            <div className="mt-4 grid gap-4 pb-6 sm:grid-cols-2 lg:grid-cols-3">
              {results.map((channel) => (
                <ChannelCard
                  key={channel.id}
                  channel={channel}
                  footer={
                    <p className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span className="truncate">
                        {channel.ownerId === user?.id ? 'You host this' : `Hosted by ${channel.ownerName}`}
                      </span>
                      {memberIds.has(channel.id) ? (
                        <Badge variant="secondary" className="shrink-0">
                          Joined
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="shrink-0 text-muted-foreground">
                          Invite only
                        </Badge>
                      )}
                    </p>
                  }
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FilterChip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-testid={`chip-${label.toLowerCase().replace(/\s+/g, '-')}`}
      className={cn(
        'rounded-full border px-3.5 py-1.5 text-xs font-medium hover-elevate',
        active
          ? 'border-primary-border bg-primary text-primary-foreground'
          : 'border-border bg-card text-muted-foreground'
      )}
    >
      {label}
    </button>
  );
}
