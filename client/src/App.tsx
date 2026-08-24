import { Switch, Route, Router, Redirect } from 'wouter';
import { useHashLocation } from 'wouter/use-hash-location';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './lib/queryClient';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider, useAuth } from '@/lib/auth';
import { AppShell } from '@/components/app-shell';
import { LogoMark } from '@/components/brand';
import NotFound from '@/pages/not-found';
import Landing from '@/pages/landing';
import AuthPage from '@/pages/auth';
import AppHome from '@/pages/app-home';
import Discover from '@/pages/discover';
import ChannelPage from '@/pages/channel';
import InvitePage from '@/pages/invite';
import AdminPage from '@/pages/admin';

function Booting() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <LogoMark className="h-9 w-9 animate-pulse text-primary" />
      <span className="sr-only">Loading PodClub</span>
    </div>
  );
}

/** Wraps in-app pages: requires a session, then renders inside the shell. */
function Private({
  children,
  adminOnly = false,
}: {
  children: React.ReactNode;
  adminOnly?: boolean;
}) {
  const { user, isLoading, isAdmin } = useAuth();

  if (isLoading) return <Booting />;
  if (!user) return <Redirect to="/auth" />;
  if (adminOnly && !isAdmin) return <Redirect to="/app" />;

  return <AppShell>{children}</AppShell>;
}

function AppRouter() {
  const { user, isLoading } = useAuth();

  return (
    <Switch>
      <Route path="/">{isLoading ? <Booting /> : user ? <Redirect to="/app" /> : <Landing />}</Route>

      <Route path="/auth">
        {isLoading ? <Booting /> : user ? <Redirect to="/app" /> : <AuthPage />}
      </Route>

      <Route path="/invite/:code" component={InvitePage} />

      <Route path="/app">
        <Private>
          <AppHome />
        </Private>
      </Route>

      <Route path="/discover">
        <Private>
          <Discover />
        </Private>
      </Route>

      <Route path="/channels/:id">
        <Private>
          <ChannelPage />
        </Private>
      </Route>

      <Route path="/admin">
        <Private adminOnly>
          <AdminPage />
        </Private>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <Toaster />
          <Router hook={useHashLocation}>
            <AppRouter />
          </Router>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}
