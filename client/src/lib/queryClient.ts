import { QueryClient, QueryFunction } from '@tanstack/react-query';

const API_BASE = '__PORT_5000__'.startsWith('__') ? '' : '__PORT_5000__';

/**
 * The signed-in user's id, mirrored here so every request carries it.
 * Set by the auth provider — see `client/src/lib/auth.tsx`.
 * To point the app at a different backend, change API_BASE and the auth header below.
 */
let activeUserId: number | null = null;

export function setActiveUserId(id: number | null) {
  activeUserId = id;
}

function authHeaders(): Record<string, string> {
  return activeUserId === null ? {} : { 'x-user-id': String(activeUserId) };
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    let message = res.statusText;
    const text = await res.text();
    if (text) {
      try {
        message = (JSON.parse(text) as { message?: string }).message ?? text;
      } catch {
        message = text;
      }
    }
    throw new Error(message);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined
): Promise<Response> {
  const res = await fetch(`${API_BASE}${url}`, {
    method,
    headers: {
      ...authHeaders(),
      ...(data ? { 'Content-Type': 'application/json' } : {}),
    },
    body: data ? JSON.stringify(data) : undefined,
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = 'returnNull' | 'throw';
export const getQueryFn: <T>(options: { on401: UnauthorizedBehavior }) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(`${API_BASE}${queryKey.join('/')}`, { headers: authHeaders() });

    if (unauthorizedBehavior === 'returnNull' && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: 'throw' }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: 15_000,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
