import { useEffect, useRef } from 'react';
import { FileText, ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/cn';
import { TERMS_VERSION, sectionsFor, type TermsPart } from '@/data/terms';

/**
 * The terms and the privacy notice, rendered.
 *
 * One component, so the registration form, the profile panel and the /terms
 * page cannot show three different documents. `part` picks the tab, `focus`
 * scrolls a section into view — the profile's "who can see your records"
 * opens straight on that heading rather than at the top of a long page.
 */
export function TermsTabs({ part, onChange, accent = 'blue' }: {
  part: TermsPart; onChange: (p: TermsPart) => void; accent?: 'blue' | 'peach';
}) {
  const active = accent === 'peach' ? 'bg-peach-500 text-white shadow-md' : 'bg-brand-500 text-white shadow-md';
  return (
    <div className="inline-flex rounded-2xl border border-white/60 bg-white/55 p-1">
      {([['terms', 'Terms of use', FileText], ['privacy', 'Privacy', ShieldCheck]] as const).map(([id, label, Icon]) => (
        <button
          key={id}
          onClick={() => onChange(id)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-[12.5px] font-bold transition',
            part === id ? active : 'text-ink-soft hover:text-ink',
          )}
        >
          <Icon className="h-3.5 w-3.5" /> {label}
        </button>
      ))}
    </div>
  );
}

export function TermsContent({ part, focus, compact = false }: {
  part: TermsPart;
  /** section id to scroll to once rendered */
  focus?: string | null;
  /** tighter type for the modal */
  compact?: boolean;
}) {
  const sections = sectionsFor(part);
  const focused = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (focus && focused.current) {
      focused.current.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  }, [focus, part]);

  return (
    <div className={cn('space-y-7', compact ? 'text-[13.5px]' : 'text-[15px]')}>
      {sections.map((s) => (
        <section
          key={s.id}
          id={s.id}
          ref={s.id === focus ? focused : undefined}
          className={cn('scroll-mt-6', s.id === focus && 'rounded-2xl bg-brand-500/[0.06] px-4 py-3 -mx-4')}
        >
          <h3 className={cn('font-extrabold tracking-tight text-ink', compact ? 'text-[15px]' : 'text-lg')}>
            {s.title}
          </h3>
          {s.body.map((p, i) => (
            <p key={i} className="mt-2 leading-relaxed text-ink-soft">{p}</p>
          ))}
        </section>
      ))}
      <p className="text-[11.5px] font-semibold text-ink-faint">
        Version {TERMS_VERSION}. Everything above describes what the application does today; when that changes, so does this.
      </p>
    </div>
  );
}
