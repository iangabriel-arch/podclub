import { useEffect, useState } from 'react';
import { Link, useLocation, useSearch } from 'wouter';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, registerSchema } from '@shared/schema';
import { useAuth } from '@/lib/auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { CoverArt, Equalizer, LogoMark, Wordmark } from '@/components/brand';
import { ArrowLeft, Loader2, ShieldCheck } from 'lucide-react';

const DEMO = [
  { username: 'gabriel', label: 'Gabriel Ian', note: 'Owns 1 channel, member of 4' },
  { username: 'wanjiku', label: 'Wanjiku Mwangi', note: 'Jazz host' },
  { username: 'admin', label: 'Amara Njoroge', note: 'Admin — moderation console' },
];

export default function AuthPage() {
  const search = useSearch();
  const [, navigate] = useLocation();
  const { login, register: registerUser } = useAuth();
  const { toast } = useToast();
  const [mode, setMode] = useState<'login' | 'register'>(
    new URLSearchParams(search).get('mode') === 'register' ? 'register' : 'login'
  );
  const [pending, setPending] = useState(false);

  const loginForm = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: '', password: '' },
  });

  const registerForm = useForm({
    resolver: zodResolver(registerSchema),
    defaultValues: { username: '', displayName: '', password: '' },
  });

  useEffect(() => {
    loginForm.clearErrors();
    registerForm.clearErrors();
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleLogin(values: { username: string; password: string }) {
    setPending(true);
    try {
      const user = await login(values.username, values.password);
      toast({ title: `Welcome back, ${user.displayName.split(' ')[0]}` });
      navigate(user.role === 'admin' ? '/admin' : '/app');
    } catch (error) {
      toast({
        title: 'Could not sign in',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setPending(false);
    }
  }

  async function handleRegister(values: { username: string; displayName: string; password: string }) {
    setPending(true);
    try {
      const user = await registerUser(values);
      toast({
        title: 'Account created',
        description: 'Start your first channel whenever you are ready.',
      });
      navigate(user.role === 'admin' ? '/admin' : '/app');
    } catch (error) {
      toast({
        title: 'Could not create account',
        description: (error as Error).message,
        variant: 'destructive',
      });
    } finally {
      setPending(false);
    }
  }

  function quickSignIn(username: string) {
    setMode('login');
    loginForm.setValue('username', username);
    loginForm.setValue('password', 'podclub');
    void handleLogin({ username, password: 'podclub' });
  }

  return (
    <div className="flex min-h-screen bg-background">
      {/* ------------------------------ visual side ------------------------------ */}
      <aside className="relative hidden w-[46%] shrink-0 overflow-hidden border-r border-border lg:block">
        <CoverArt seed={332} image="auth-room.webp" scrim="strong" className="absolute inset-0" />
        <div className="relative flex h-full flex-col justify-between p-12">
          <Wordmark className="text-white" />
          <div className="max-w-sm">
            <Equalizer className="text-white/70" bars={5} />
            <p className="mt-6 text-balance font-display text-3xl font-extrabold leading-tight tracking-tight text-white">
              “The best music conversation I have is with four people, not four thousand.”
            </p>
            <p className="mt-5 text-sm text-white/70">
              Every PodClub channel is capped and invite-only, so the room stays worth showing up to.
            </p>
          </div>
          <p className="text-xs text-white/50">Built in Nairobi · Listening rooms since 2026</p>
        </div>
      </aside>

      {/* ------------------------------- form side ------------------------------ */}
      <main className="flex flex-1 flex-col">
        <div className="flex h-16 items-center justify-between px-6">
          <Button variant="ghost" size="sm" asChild data-testid="link-back-home">
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Link>
          </Button>
          <Wordmark className="lg:hidden" />
        </div>

        <div className="flex flex-1 items-center justify-center px-6 pb-16">
          <div className="w-full max-w-sm">
            <LogoMark className="h-8 w-8 text-primary" />
            <h1 className="mt-5 text-2xl font-extrabold tracking-tight">
              {mode === 'login' ? 'Sign back in' : 'Create your account'}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              {mode === 'login'
                ? 'Your rooms are exactly where you left them.'
                : 'Pick a handle. You can start a channel right after.'}
            </p>

            {/* segmented control */}
            <div className="mt-7 grid grid-cols-2 gap-1 rounded-lg border border-border bg-muted/50 p-1">
              {(['login', 'register'] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  data-testid={`tab-${value}`}
                  className={`min-h-8 rounded-md text-sm font-medium transition-colors ${
                    mode === value
                      ? 'bg-card text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {value === 'login' ? 'Sign in' : 'Register'}
                </button>
              ))}
            </div>

            {mode === 'login' ? (
              <Form {...loginForm}>
                <form onSubmit={loginForm.handleSubmit(handleLogin)} className="mt-6 space-y-4">
                  <FormField
                    control={loginForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="gabriel"
                            autoComplete="username"
                            data-testid="input-login-username"
                            {...field}
                            onChange={(e) => field.onChange(e.target.value.toLowerCase())}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={loginForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="••••••••"
                            autoComplete="current-password"
                            data-testid="input-login-password"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={pending} data-testid="button-login">
                    {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Sign in
                  </Button>
                </form>
              </Form>
            ) : (
              <Form {...registerForm}>
                <form onSubmit={registerForm.handleSubmit(handleRegister)} className="mt-6 space-y-4">
                  <FormField
                    control={registerForm.control}
                    name="displayName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Display name</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="Gabriel Ian"
                            autoComplete="name"
                            data-testid="input-register-name"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={registerForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Username</FormLabel>
                        <FormControl>
                          <Input
                            placeholder="gabriel"
                            autoComplete="username"
                            data-testid="input-register-username"
                            {...field}
                            onChange={(e) => field.onChange(e.target.value.toLowerCase())}
                          />
                        </FormControl>
                        <FormDescription>Lowercase letters, numbers, underscore and dot.</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={registerForm.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Password</FormLabel>
                        <FormControl>
                          <Input
                            type="password"
                            placeholder="At least 6 characters"
                            autoComplete="new-password"
                            data-testid="input-register-password"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={pending} data-testid="button-register">
                    {pending && <Loader2 className="h-4 w-4 animate-spin" />}
                    Create account
                  </Button>
                </form>
              </Form>
            )}

            {/* ---------------------------- demo accounts --------------------------- */}
            <div className="mt-8 rounded-lg border border-card-border bg-card p-4">
              <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                <ShieldCheck className="h-3.5 w-3.5" />
                Demo accounts
              </p>
              <ul className="mt-3 space-y-1">
                {DEMO.map((account) => (
                  <li key={account.username}>
                    <button
                      type="button"
                      onClick={() => quickSignIn(account.username)}
                      disabled={pending}
                      data-testid={`button-demo-${account.username}`}
                      className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left hover-elevate disabled:opacity-50"
                    >
                      <span className="text-sm font-medium">{account.label}</span>
                      <span className="text-xs text-muted-foreground">{account.note}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-2 px-2 text-xs text-muted-foreground">
                Password for all demo accounts is <code className="font-mono">podclub</code>.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
