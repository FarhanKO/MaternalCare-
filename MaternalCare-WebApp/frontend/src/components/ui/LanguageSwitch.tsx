import { Languages } from 'lucide-react';
import { LANGUAGES, coverage, useT } from '@/i18n';
import { cn } from '@/lib/cn';

/**
 * English / Bangla. There was no switch anywhere: a browser set to Bangla got
 * Bangla mode with no way back, and nobody else could reach it. Bangla is
 * marked beta, with its real coverage, until the screens are translated.
 */
export function LanguageSwitch({ className }: { className?: string }) {
  const { lang, setLang } = useT();
  return (
    <div
      role="group"
      aria-label="Language"
      title={lang === 'bn' ? `বাংলা অনুবাদ চলছে (${coverage('bn')}% শেষ) — বাকিটা ইংরেজিতে` : undefined}
      className={cn('inline-flex h-9 items-center gap-0.5 rounded-xl bg-white/50 p-0.5 text-[12px] font-semibold', className)}
    >
      <Languages className="mx-1.5 h-3.5 w-3.5 text-ink-faint" aria-hidden />
      {LANGUAGES.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => setLang(l.code)}
          aria-pressed={lang === l.code}
          className={cn(
            'rounded-lg px-2 py-1 transition-colors',
            lang === l.code ? 'bg-white text-ink shadow-sm' : 'text-ink-soft hover:text-ink',
          )}
        >
          {l.code === 'en' ? 'EN' : l.label}
          {l.code === 'bn' && <span className="ml-1 text-[9px] font-bold uppercase text-amber-600">beta</span>}
        </button>
      ))}
    </div>
  );
}
