import { Link } from 'react-router-dom';
import { GlassCard } from '@/components/ui/GlassCard';
import { useAuth, portalFor } from '@/lib/auth';

/** Any address the app does not know — it used to render a blank page. */
export function NotFound() {
  const { user } = useAuth();
  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <GlassCard className="w-full max-w-md p-8 text-center">
        <div className="text-sm font-bold uppercase tracking-[0.2em] text-brand-600">404</div>
        <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-ink">This page does not exist</h1>
        <p className="mt-2 text-sm text-ink-soft">The link may be old or mistyped.</p>
        <Link
          to={user ? portalFor(user.role) : '/'}
          className="mt-6 inline-block rounded-2xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
        >
          {user ? 'Back to your dashboard' : 'Go to the home page'}
        </Link>
      </GlassCard>
    </div>
  );
}
