import { cn } from '@/lib/utils';
import { hueFor, initials } from '@/lib/format';

/* ------------------------------- logo mark -------------------------------- */

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      className={cn('h-7 w-7', className)}
    >
      <g stroke="currentColor" strokeWidth="2.6" strokeLinecap="round">
        {/* the open ring — the club, holding space */}
        <path d="M24.6 8.9A11 11 0 1 0 24.6 23.1" />
        {/* the signal inside it */}
        <path d="M12.4 12.6v6.8M16.4 9.6v12.8M20.4 13.8v4.4" />
      </g>
    </svg>
  );
}

export function Wordmark({ className, markClass }: { className?: string; markClass?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <LogoMark className={cn('text-primary', markClass)} />
      <span className="font-display text-lg font-extrabold tracking-tight">PodClub</span>
    </span>
  );
}

/* ------------------------------- cover art -------------------------------- */

/**
 * Generative channel artwork. The hue is derived from the channel name so the
 * same room always looks the same, without shipping a single image file.
 */
export function CoverArt({
  seed,
  className,
  children,
}: {
  seed: string | number;
  className?: string;
  children?: React.ReactNode;
}) {
  const raw = typeof seed === 'number' ? seed : hueFor(seed);
  // Keep artwork inside a warm amber-to-bronze band so every room reads as part of
  // the same pressing rather than a random rainbow.
  const hue = 8 + (raw % 28);
  return (
    <div
      className={cn('cover-art relative overflow-hidden', className)}
      style={{ ['--art-h' as string]: hue }}
    >
      <div className="absolute inset-0 bg-[radial-gradient(120%_100%_at_50%_0%,transparent_35%,rgba(0,0,0,0.55)_100%)]" />
      {children}
    </div>
  );
}

/* --------------------------------- avatar --------------------------------- */

export function UserBadge({
  name,
  hue,
  size = 'md',
  className,
  ring = false,
}: {
  name: string;
  hue?: number;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
  ring?: boolean;
}) {
  const h = hue ?? hueFor(name);
  const sizes = {
    xs: 'h-6 w-6 text-[10px]',
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-14 w-14 text-base',
  } as const;
  return (
    <span
      className={cn(
        'inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white',
        sizes[size],
        ring && 'ring-2 ring-background',
        className
      )}
      style={{
        background: `linear-gradient(145deg, hsl(${h} 58% 52%), hsl(${(h + 46) % 360} 52% 34%))`,
      }}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

/* ------------------------------- equalizer -------------------------------- */

export function Equalizer({ className, bars = 4 }: { className?: string; bars?: number }) {
  const delays = ['0ms', '160ms', '320ms', '80ms', '240ms'];
  return (
    <span className={cn('inline-flex h-3.5 items-end gap-[2px]', className)} aria-hidden="true">
      {Array.from({ length: bars }).map((_, i) => (
        <span
          key={i}
          className="w-[2px] origin-bottom rounded-full bg-current animate-bar"
          style={{ height: '100%', animationDelay: delays[i % delays.length] }}
        />
      ))}
    </span>
  );
}
