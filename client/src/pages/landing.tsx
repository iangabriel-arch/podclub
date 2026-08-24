import { Link } from 'wouter';
import { useQuery } from '@tanstack/react-query';
import type { ChannelWithMeta } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { CoverArt, Equalizer, LogoMark, Wordmark } from '@/components/brand';
import { plural, relativeTime } from '@/lib/format';
import { MessageSquareQuote, Radio, ShieldCheck, Users } from 'lucide-react';

const PRINCIPLES = [
  {
    icon: Radio,
    title: 'Five rooms, not fifty',
    body: 'You can own five channels at a time. The cap is the point — it forces you to keep the rooms you actually show up for.',
  },
  {
    icon: Users,
    title: 'Invite-only by default',
    body: 'Every channel has one private link. Share it with the people whose taste you trust and nobody else gets in.',
  },
  {
    icon: MessageSquareQuote,
    title: 'Threads that hold a thought',
    body: 'Reply to any message directly. Edit a bad take, delete it outright. Conversations stay legible a week later.',
  },
  {
    icon: ShieldCheck,
    title: 'Moderation that answers',
    body: 'Report a member and a human admin sees it, with the message and the channel attached. Bans are reversible.',
  },
];

export default function Landing() {
  const { data: channels } = useQuery<ChannelWithMeta[]>({ queryKey: ['/api/channels/discover'] });
  const featured = (channels ?? []).slice(0, 3);

  return (
    <div className="min-h-screen bg-background">
      {/* ---------------------------------- nav --------------------------------- */}
      <header className="sticky top-0 z-40 glass border-b border-border">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Wordmark />
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild data-testid="link-signin">
              <Link href="/auth">Sign in</Link>
            </Button>
            <Button asChild data-testid="link-getstarted">
              <Link href="/auth?mode=register">Create account</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* --------------------------------- hero --------------------------------- */}
      <section className="relative overflow-hidden border-b border-border">
        {/* atmosphere: two soft light sources, no image needed */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.5]"
          style={{
            background:
              'radial-gradient(60% 55% at 18% 0%, hsl(346 92% 52% / 0.30) 0%, transparent 62%), radial-gradient(52% 50% at 88% 14%, hsl(268 82% 58% / 0.24) 0%, transparent 66%)',
          }}
        />
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              'linear-gradient(to right, currentColor 1px, transparent 1px), linear-gradient(to bottom, currentColor 1px, transparent 1px)',
            backgroundSize: '72px 72px',
            maskImage: 'radial-gradient(70% 60% at 50% 30%, black, transparent)',
          }}
        />

        <div className="relative mx-auto max-w-6xl px-6 pb-24 pt-20 md:pb-32 md:pt-28">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs font-medium text-muted-foreground animate-fade-in">
              <Equalizer className="text-primary" bars={3} />
              Now with 5 listening rooms per member
            </span>

            <h1 className="mt-6 text-balance font-display text-[2.75rem] font-extrabold leading-[1.04] tracking-[-0.03em] sm:text-6xl md:text-[4.25rem] animate-rise-in">
              The room where a record
              <br />
              <span className="text-primary">actually gets discussed.</span>
            </h1>

            <p
              className="mt-6 max-w-xl text-pretty text-lg leading-relaxed text-muted-foreground animate-rise-in"
              style={{ animationDelay: '80ms' }}
            >
              PodClub is a small, invite-only listening room for people who take music and podcasts
              seriously. Start a channel, bring the right five people, and talk about what you are
              hearing while you are still hearing it.
            </p>

            <div
              className="mt-9 flex flex-wrap items-center gap-3 animate-rise-in"
              style={{ animationDelay: '140ms' }}
            >
              <Button size="lg" asChild data-testid="button-hero-start">
                <Link href="/auth?mode=register">Start a channel</Link>
              </Button>
              <Button size="lg" variant="outline" asChild data-testid="button-hero-demo">
                <Link href="/auth">Explore a live room</Link>
              </Button>
            </div>

            <p
              className="mt-4 text-sm text-muted-foreground animate-fade-in"
              style={{ animationDelay: '220ms' }}
            >
              Free while we are small. No algorithm, no feed, no ads.
            </p>
          </div>
        </div>
      </section>

      {/* ------------------------------- live rooms ------------------------------ */}
      {featured.length > 0 && (
        <section className="border-b border-border">
          <div className="mx-auto max-w-6xl px-6 py-16 md:py-20">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Rooms open right now</h2>
                <p className="mt-2 text-muted-foreground">
                  A look at what members are listening to together this week.
                </p>
              </div>
              <Button variant="ghost" asChild>
                <Link href="/auth">Join to listen in →</Link>
              </Button>
            </div>

            <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {featured.map((channel, i) => (
                <article
                  key={channel.id}
                  className="group overflow-hidden rounded-xl border border-card-border bg-card sheen animate-rise-in"
                  style={{ animationDelay: `${i * 60}ms` }}
                  data-testid={`card-featured-${channel.id}`}
                >
                  <CoverArt seed={channel.hue} className="aspect-[16/9]">
                    <div className="absolute inset-x-0 bottom-0 flex items-end justify-between p-4">
                      <span className="rounded-full bg-black/35 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white/90 backdrop-blur-sm">
                        {channel.topic}
                      </span>
                      <LogoMark className="h-5 w-5 text-white/50" />
                    </div>
                  </CoverArt>
                  <div className="p-5">
                    <h3 className="truncate text-base font-bold" title={channel.name}>
                      {channel.name}
                    </h3>
                    <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
                      {channel.description || 'No description yet.'}
                    </p>
                    <p className="mt-4 text-xs text-muted-foreground">
                      {plural(channel.memberCount, 'member')} · {relativeTime(channel.lastActivity)}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ------------------------------ principles ------------------------------ */}
      <section className="border-b border-border">
        <div className="mx-auto max-w-6xl px-6 py-16 md:py-24">
          <h2 className="max-w-2xl text-balance text-2xl font-bold tracking-tight">
            Built small on purpose, so the conversation stays good.
          </h2>
          <div className="mt-10 grid gap-x-10 gap-y-10 sm:grid-cols-2">
            {PRINCIPLES.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex gap-4">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-card-border bg-card text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-base font-bold">{title}</h3>
                  <p className="mt-1.5 text-pretty text-sm leading-relaxed text-muted-foreground">
                    {body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------- cta --------------------------------- */}
      <section className="mx-auto max-w-6xl px-6 py-20 md:py-28">
        <div className="relative overflow-hidden rounded-2xl border border-card-border bg-card px-8 py-14 text-center sheen md:px-16">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(70% 100% at 50% 0%, hsl(346 92% 55% / 0.20) 0%, transparent 70%)',
            }}
          />
          <div className="relative">
            <LogoMark className="mx-auto h-9 w-9 text-primary" />
            <h2 className="mt-6 text-balance text-3xl font-extrabold tracking-tight md:text-4xl">
              Your five best rooms are waiting.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-pretty text-muted-foreground">
              Takes about thirty seconds to set up. Bring one friend and it already works.
            </p>
            <Button size="lg" className="mt-8" asChild data-testid="button-cta-register">
              <Link href="/auth?mode=register">Create your account</Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground sm:flex-row">
          <Wordmark className="text-foreground" />
          <p>Built in Nairobi. A place to listen together.</p>
        </div>
      </footer>
    </div>
  );
}
