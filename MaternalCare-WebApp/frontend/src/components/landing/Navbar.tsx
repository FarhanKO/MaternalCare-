import { motion, AnimatePresence, useScroll, useMotionValueEvent } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Activity, ChevronDown, Download, LogOut, Menu, X } from 'lucide-react';
import { LiquidButton } from '@/components/ui/LiquidButton';
import { ANDROID_APPS, appDownloadUrl, type AndroidApp } from '@/data/apps';
import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/cn';
import { spring } from '@/lib/motion';
import { isNative } from '@/lib/native';

interface NavLink {
  label: string;
  href: string;
  route?: boolean;
}

/*
 * The marketing links. In the app there is no marketing site behind them —
 * "/" is her portal — so the app's bar carries only the account.
 */
const links: NavLink[] = isNative ? [] : [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#journey' },
  { label: 'Our story', href: '/about', route: true },
  { label: 'For clinicians', href: '#cta' },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [hovered, setHovered] = useState<number | null>(null);
  const { scrollY } = useScroll();
  const navigate = useNavigate();
  const location = useLocation();
  /*
   * The same bar sits on the marketing pages and on both portals. Signed
   * out it sells the product; signed in it must not — a mother on her own
   * dashboard was being offered "Sign in" and "Get started", and on a phone
   * the menu had no way out at all. So the right-hand end follows the
   * account: her portal and a sign-out, or the two calls to action.
   */
  const { user, signOut } = useAuth();
  const portal = user?.role === 'clinician' ? '/doctor' : '/mother';
  const onPortal = location.pathname === portal;
  const leave = async () => {
    setOpen(false);
    await signOut();
    navigate('/signin');
  };

  useMotionValueEvent(scrollY, 'change', (y) => setScrolled(y > 24));

  const activeIndex = links.findIndex((l) => l.route && l.href === location.pathname);
  const showIndex = hovered ?? (activeIndex >= 0 ? activeIndex : null);

  // Links work from any page: hash links jump home (if needed) and smooth-scroll.
  const go = (l: NavLink) => {
    setOpen(false);
    if (l.route) {
      navigate(l.href);
      window.scrollTo({ top: 0 });
      return;
    }
    if (location.pathname === '/') {
      document.querySelector(l.href)?.scrollIntoView({ behavior: 'smooth' });
    } else {
      navigate('/');
      setTimeout(() => document.querySelector(l.href)?.scrollIntoView({ behavior: 'smooth' }), 160);
    }
  };

  const goHome = () => {
    if (location.pathname === '/') window.scrollTo({ top: 0, behavior: 'smooth' });
    else navigate('/');
  };

  /*
   * "Get the app": a small menu offering the two APKs, each link downloading
   * straight away. Not in the app — she already has it. Closes on a pick, a
   * click anywhere else, or Escape.
   */
  const [appsOpen, setAppsOpen] = useState(false);
  const appsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!appsOpen) return;
    const away = (e: PointerEvent) => {
      if (!appsRef.current?.contains(e.target as Node)) setAppsOpen(false);
    };
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setAppsOpen(false);
    document.addEventListener('pointerdown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [appsOpen]);

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ ...spring, delay: 0.1 }}
      className="fixed inset-x-0 top-0 z-50 flex justify-center px-4 pt-4"
    >
      <nav
        className={cn(
          'flex w-full max-w-6xl items-center gap-6 rounded-2xl px-4 py-2.5 transition-all duration-500',
          scrolled
            ? 'glass-strong shadow-float'
            : 'border border-white/40 bg-white/45 shadow-soft backdrop-blur-md',
        )}
      >
        {/* brand */}
        <button onClick={goHome} className="flex items-center gap-2.5 pl-1">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 shadow-glow">
            <Activity className="h-[18px] w-[18px] text-white" strokeWidth={2.4} />
          </span>
          <span className="text-[17px] font-bold tracking-tight text-ink">
            Maternal<span className="text-gradient">Care+</span>
          </span>
        </button>

        {/* desktop links — sliding pill indicator follows hover / active */}
        <div className="relative ml-auto hidden items-center gap-1 lg:flex" onMouseLeave={() => setHovered(null)}>
          {links.map((l, i) => (
            <button
              key={l.href}
              onMouseEnter={() => setHovered(i)}
              onClick={() => go(l)}
              className={cn(
                'relative whitespace-nowrap rounded-xl px-3.5 py-2 text-sm font-medium transition-colors duration-200',
                showIndex === i ? 'text-ink' : 'text-ink-soft hover:text-ink',
              )}
            >
              {showIndex === i && (
                <motion.span
                  layoutId="navPill"
                  transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                  className="absolute inset-0 -z-10 rounded-xl bg-white/75 shadow-soft ring-1 ring-white/60"
                />
              )}
              <span className="relative z-10">{l.label}</span>
            </button>
          ))}
        </div>

        <div className="ml-auto hidden items-center gap-2 lg:ml-2 lg:flex">
          {!isNative && (
            <div ref={appsRef} className="relative">
              <button
                onClick={() => setAppsOpen((v) => !v)}
                aria-expanded={appsOpen}
                aria-haspopup="menu"
                className={cn(
                  'inline-flex h-9 items-center gap-1.5 rounded-xl px-3 text-[13px] font-semibold transition-colors',
                  appsOpen ? 'bg-white/75 text-ink' : 'text-ink-soft hover:bg-white/60 hover:text-ink',
                )}
              >
                <Download className="h-4 w-4" />
                Get the app
                <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', appsOpen && 'rotate-180')} />
              </button>
              <AnimatePresence>
                {appsOpen && (
                  <motion.div
                    role="menu"
                    initial={{ opacity: 0, y: -6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.98 }}
                    transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                    className="absolute right-0 top-full mt-2 w-64 origin-top-right rounded-2xl glass-strong p-1.5 shadow-float"
                  >
                    <div className="px-2.5 pb-1 pt-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                      Android apps
                    </div>
                    {ANDROID_APPS.map((a) => (
                      <AppDownload key={a.file} app={a} onPick={() => setAppsOpen(false)} />
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
          {user ? (
            <>
              {!onPortal && (
                <LiquidButton variant="ghost" size="sm" onClick={() => navigate(portal)}>
                  {user.role === 'clinician' ? 'Clinic' : 'My dashboard'}
                </LiquidButton>
              )}
              <LiquidButton variant="ghost" size="sm" onClick={leave} aria-label="Sign out">
                <LogOut className="h-4 w-4" /> Sign out
              </LiquidButton>
            </>
          ) : (
            <>
              <LiquidButton variant="ghost" size="sm" onClick={() => navigate('/signin')}>
                Sign in
              </LiquidButton>
              <LiquidButton size="sm" onClick={() => navigate('/register')}>
                Get started
              </LiquidButton>
            </>
          )}
        </div>

        {/* mobile toggle */}
        <button
          onClick={() => setOpen((v) => !v)}
          className="ml-auto grid h-10 w-10 place-items-center rounded-xl glass-strong text-ink lg:hidden"
          aria-label="Menu"
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </nav>

      {/* mobile sheet */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -12, filter: 'blur(8px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, y: -12, filter: 'blur(8px)' }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-x-4 top-[76px] rounded-3xl glass-strong p-4 shadow-glass lg:hidden"
          >
            <div className="flex flex-col gap-1">
              {links.map((l) => (
                <button
                  key={l.href}
                  onClick={() => go(l)}
                  className={cn(
                    'rounded-xl px-4 py-3 text-left text-sm font-medium transition-colors',
                    l.route && l.href === location.pathname
                      ? 'bg-white/70 text-ink'
                      : 'text-ink-soft hover:bg-white/70 hover:text-ink',
                  )}
                >
                  {l.label}
                </button>
              ))}
              {!isNative && (
                <div className="mt-1 border-t border-white/60 pt-2">
                  <div className="px-4 pb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
                    Get the app
                  </div>
                  {ANDROID_APPS.map((a) => (
                    <AppDownload key={a.file} app={a} onPick={() => setOpen(false)} />
                  ))}
                </div>
              )}
              <div className="mt-2 flex gap-2">
                {user ? (
                  <>
                    {!onPortal && (
                      <LiquidButton variant="glass" size="sm" className="flex-1" onClick={() => { setOpen(false); navigate(portal); }}>
                        {user.role === 'clinician' ? 'Clinic' : 'My dashboard'}
                      </LiquidButton>
                    )}
                    <LiquidButton variant="glass" size="sm" className="flex-1" onClick={leave}>
                      <LogOut className="h-4 w-4" /> Sign out
                    </LiquidButton>
                  </>
                ) : (
                  <>
                    <LiquidButton variant="glass" size="sm" className="flex-1" onClick={() => { setOpen(false); navigate('/signin'); }}>
                      Sign in
                    </LiquidButton>
                    <LiquidButton size="sm" className="flex-1" onClick={() => { setOpen(false); navigate('/register'); }}>
                      Get started
                    </LiquidButton>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
}

/** One row of the "Get the app" menu: a plain link that downloads the APK. */
function AppDownload({ app, onPick }: { app: AndroidApp; onPick: () => void }) {
  return (
    <a
      role="menuitem"
      href={appDownloadUrl(app)}
      download={app.file}
      onClick={onPick}
      className="flex items-center gap-3 rounded-xl px-2.5 py-2 transition-colors hover:bg-white/80"
    >
      <span className="grid h-8 w-8 flex-none place-items-center rounded-xl bg-gradient-to-br from-brand-500 to-brand-700">
        <app.icon className="h-4 w-4 text-white" strokeWidth={2.2} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-bold leading-tight text-ink">{app.label}</span>
        <span className="block truncate text-[11px] font-medium text-ink-soft">{app.note}</span>
      </span>
      <Download className="h-4 w-4 flex-none text-brand-500" />
    </a>
  );
}
