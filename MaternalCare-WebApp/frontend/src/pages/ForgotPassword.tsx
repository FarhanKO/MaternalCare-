import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowLeft, Check, Mail } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { FloatingInput } from '@/components/ui/FloatingInput';
import { LiquidButton } from '@/components/ui/LiquidButton';
import { api } from '@/lib/api';

/**
 * Step 1 of a reset: she gives her email, we email a one-time link.
 *
 * The answer is the same whether or not the address has an account, so this
 * page cannot be used to find out who is a patient here.
 */
export function ForgotPassword() {
  const [sent, setSent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    const email = String(new FormData(e.currentTarget).get('email') || '').trim();
    if (!email) { setError('Enter the email you signed up with'); return; }
    setSubmitting(true);
    try {
      const r = await api.forgotPassword(email);
      setSent(r.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work — try again');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <GlassCard className="w-full max-w-md p-7 sm:p-9">
        <Link to="/signin" className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-ink">
          <ArrowLeft className="h-4 w-4" /> Back to sign in
        </Link>
        <h1 className="mt-5 text-3xl font-extrabold tracking-tight text-ink">Forgot your password?</h1>
        <p className="mt-2 text-sm text-ink-soft">
          Enter the email you signed up with and we will send you a link to choose a new one.
        </p>

        {sent ? (
          <div role="status" className="mt-6 flex items-start gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-800">
            <Check className="mt-0.5 h-4 w-4 flex-none" strokeWidth={3} />
            <span>{sent} Check your spam folder if it has not arrived in a few minutes.</span>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <FloatingInput id="email" name="email" label="Email address" type="email" autoComplete="email"
              icon={<Mail className="h-[18px] w-[18px]" />} required />
            {error && (
              <div className="flex items-start gap-2 rounded-2xl bg-rose-500/10 px-3.5 py-2.5 ring-1 ring-rose-500/25">
                <AlertCircle className="mt-0.5 h-4 w-4 flex-none text-rose-600" />
                <span className="text-[12.5px] font-semibold text-ink-soft">{error}</span>
              </div>
            )}
            <LiquidButton type="submit" size="lg" className="w-full">
              {submitting ? 'Sending…' : 'Send reset link'}
            </LiquidButton>
          </form>
        )}
      </GlassCard>
    </div>
  );
}
