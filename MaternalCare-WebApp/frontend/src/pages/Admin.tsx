import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, BadgeCheck, LogOut, ShieldAlert, XCircle } from 'lucide-react';
import { GlassCard } from '@/components/ui/GlassCard';
import { LiquidButton } from '@/components/ui/LiquidButton';
import { cn } from '@/lib/cn';
import { api, type AdminDoctor } from '@/lib/api';
import { useAuth } from '@/lib/auth';

type State = 'pending' | 'verified' | 'rejected' | 'all';

const TABS: { key: State; label: string }[] = [
  { key: 'pending', label: 'Waiting' },
  { key: 'verified', label: 'Verified' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'all', label: 'All' },
];

/**
 * The admin's one job here: check each new clinician's licence with the
 * medical council (BMDC in Bangladesh), then verify or reject. Until then
 * they are not listed, not bookable and cannot moderate.
 */
export function Admin() {
  const { user, signOut } = useAuth();
  const [state, setState] = useState<State>('pending');
  const [doctors, setDoctors] = useState<AdminDoctor[] | null>(null);
  const [pending, setPending] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(() => {
    api.adminDoctors(state)
      .then((r) => { setDoctors(r.doctors); setPending(r.pending); setError(null); })
      .catch((err) => setError(err instanceof Error ? err.message : 'Could not load the list'));
  }, [state]);

  useEffect(() => { load(); }, [load]);

  const act = async (id: string, fn: () => Promise<unknown>) => {
    setBusy(id);
    setError(null);
    try {
      await fn();
      setRejecting(null);
      setNote('');
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That did not work');
    } finally {
      setBusy(null);
    }
  };

  return (
    <main className="mx-auto max-w-4xl px-4 pb-24 pt-10 sm:pt-14">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-600">Admin</span>
          <h1 className="mt-1 text-3xl font-extrabold tracking-tight text-ink">Clinician licences</h1>
          <p className="mt-1 text-sm text-ink-soft">
            {pending} waiting · check each licence number with the medical council before verifying.
          </p>
        </div>
        <button onClick={() => void signOut()} className="inline-flex items-center gap-1.5 text-sm font-semibold text-ink-muted hover:text-ink">
          <LogOut className="h-4 w-4" /> Sign out {user?.name ? `(${user.name})` : ''}
        </button>
      </div>

      <div className="mt-6 flex flex-wrap gap-2" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={state === t.key} onClick={() => setState(t.key)}
            className={cn('rounded-full px-4 py-1.5 text-sm font-semibold ring-1 transition',
              state === t.key ? 'bg-brand-600 text-white ring-brand-600' : 'bg-white/60 text-ink-soft ring-ink/10 hover:text-ink')}>
            {t.label}{t.key === 'pending' && pending ? ` (${pending})` : ''}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-2xl bg-rose-500/10 px-3.5 py-2.5 ring-1 ring-rose-500/25">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-none text-rose-600" />
          <span className="text-[13px] font-semibold text-ink-soft">{error}</span>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {doctors === null && <p className="text-sm text-ink-muted">Loading…</p>}
        {doctors?.length === 0 && (
          <GlassCard className="p-6 text-sm text-ink-muted">Nobody here.</GlassCard>
        )}
        {doctors?.map((d) => (
          <GlassCard key={d.id} className="p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-base font-bold text-ink">{d.name}</span>
                  {d.verification === 'verified' && <BadgeCheck className="h-4 w-4 text-emerald-600" aria-label="Verified" />}
                  {d.verification === 'rejected' && <XCircle className="h-4 w-4 text-rose-600" aria-label="Rejected" />}
                  {d.verification === 'pending' && <ShieldAlert className="h-4 w-4 text-amber-600" aria-label="Waiting" />}
                </div>
                <div className="mt-0.5 text-[13px] text-ink-soft">
                  {d.specialty} · {d.qualification} · {d.years} {d.years === 1 ? 'year' : 'years'}
                </div>
                <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-[12.5px]">
                  <dt className="font-semibold text-ink-muted">Licence</dt><dd className="font-mono text-ink">{d.licenseNo ?? '—'}</dd>
                  <dt className="font-semibold text-ink-muted">Email</dt><dd className="text-ink">{d.email ?? '—'}</dd>
                  <dt className="font-semibold text-ink-muted">Phone</dt><dd className="text-ink">{d.phone ?? '—'}</dd>
                  {d.rejectionNote && (<><dt className="font-semibold text-ink-muted">Reason</dt><dd className="text-ink">{d.rejectionNote}</dd></>)}
                </dl>
              </div>
              <div className="flex flex-none gap-2">
                {d.verification !== 'verified' && (
                  <LiquidButton size="sm" onClick={() => act(d.id, () => api.verifyDoctor(d.id))}>
                    {busy === d.id ? 'Saving…' : 'Verify'}
                  </LiquidButton>
                )}
                {d.verification !== 'rejected' && rejecting !== d.id && (
                  <LiquidButton size="sm" variant="glass" onClick={() => { setRejecting(d.id); setNote(''); }}>
                    Reject
                  </LiquidButton>
                )}
              </div>
            </div>
            {rejecting === d.id && (
              <div className="mt-4 space-y-2">
                <label htmlFor={`note-${d.id}`} className="text-[13px] font-semibold text-ink">Why? The clinician will see this.</label>
                <textarea id={`note-${d.id}`} value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={500}
                  className="w-full rounded-2xl border border-ink/10 bg-white/70 px-3 py-2 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-brand-500/40"
                  placeholder="e.g. Licence number not found on the BMDC register" />
                <div className="flex gap-2">
                  <LiquidButton size="sm" onClick={() => act(d.id, () => api.rejectDoctor(d.id, note))}>
                    {busy === d.id ? 'Saving…' : 'Confirm rejection'}
                  </LiquidButton>
                  <LiquidButton size="sm" variant="glass" onClick={() => setRejecting(null)}>Cancel</LiquidButton>
                </div>
              </div>
            )}
          </GlassCard>
        ))}
      </div>
    </main>
  );
}
