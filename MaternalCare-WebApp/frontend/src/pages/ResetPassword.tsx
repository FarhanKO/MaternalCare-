import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Lock } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { FloatingInput } from '@/components/ui/FloatingInput';
import { LiquidButton } from '@/components/ui/LiquidButton';
import { api } from '@/lib/api';

/**
 * Step 2 of a reset: the page the emailed link opens. The token is checked
 * first, so an expired link says so before she types a new password.
 */
export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const navigate = useNavigate();
  // no token in the link at all → invalid straight away, no request
  const [valid, setValid] = useState<boolean | null>(token ? null : false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!token) return;
    api.checkResetToken(token).then(() => setValid(true)).catch(() => setValid(false));
  }, [token]);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const form = new FormData(e.currentTarget);
    const password = String(form.get('password') || '');
    const again = String(form.get('again') || '');
    if (password !== again) { setError('The two passwords do not match'); return; }
    setSubmitting(true);
    try {
      await api.resetPassword(token, password);
      navigate('/signin?reset=1', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work — try again');
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <GlassCard className="w-full max-w-md p-7 sm:p-9">
        <Link to="/signin" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </Link>
        <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-ink">Choose a new password</h1>

        {valid === null && <p className="mt-4 text-sm text-ink-soft">Checking your link…</p>}

        {valid === false && (
          <div className="mt-6 space-y-4">
            <div className="flex items-start gap-2 rounded-2xl bg-rose-500/10 px-3.5 py-2.5 ring-1 ring-rose-500/25">
              <AlertCircle className="mt-0.5 h-4 w-4 flex-none text-rose-600" />
              <span className="text-[12.5px] font-semibold text-ink-soft">
                This reset link has expired or was already used.
              </span>
            </div>
            <Link to="/forgot-password" className="text-sm font-semibold text-brand-600 hover:text-brand-700">
              Send me a new link
            </Link>
          </div>
        )}

        {valid && (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <p className="text-sm text-ink-soft">
              At least 8 characters, with a letter and a number or symbol. You will be signed out everywhere else.
            </p>
            <FloatingInput id="password" name="password" label="New password" type="password"
              autoComplete="new-password" icon={<Lock className="h-[18px] w-[18px]" />} required />
            <FloatingInput id="again" name="again" label="New password again" type="password"
              autoComplete="new-password" icon={<Lock className="h-[18px] w-[18px]" />} required />
            {error && (
              <div className="flex items-start gap-2 rounded-2xl bg-rose-500/10 px-3.5 py-2.5 ring-1 ring-rose-500/25">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-none text-rose-600" />
                <span className="text-[12.5px] font-semibold text-ink-soft">{error}</span>
              </div>
            )}
            <LiquidButton type="submit" size="lg" className="w-full">
              {submitting ? 'Saving…' : 'Save new password'}
            </LiquidButton>
          </form>
        )}
      </GlassCard>
    </div>
  );
}
