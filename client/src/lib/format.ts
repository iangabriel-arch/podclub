export function hueFor(value: string) {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) % 360;
  }
  return hash;
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('');
}

export function relativeTime(ms: number | null | undefined) {
  if (!ms) return 'no activity yet';
  const diff = Date.now() - ms;
  const minute = 60_000;
  if (diff < minute) return 'just now';
  if (diff < 60 * minute) return `${Math.floor(diff / minute)}m ago`;
  if (diff < 24 * 60 * minute) return `${Math.floor(diff / (60 * minute))}h ago`;
  if (diff < 7 * 24 * 60 * minute) return `${Math.floor(diff / (24 * 60 * minute))}d ago`;
  return new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function clockTime(ms: number) {
  return new Date(ms).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function dayLabel(ms: number) {
  const date = new Date(ms);
  const today = new Date();
  const yesterday = new Date(Date.now() - 86_400_000);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(date, today)) return 'Today';
  if (same(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' });
}

export function plural(count: number, word: string, suffix = 's') {
  return `${count} ${word}${count === 1 ? '' : suffix}`;
}
