import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { ScrollText } from 'lucide-react';
import { Navbar } from '@/components/landing/Navbar';
import { Footer } from '@/components/landing/Footer';
import { Badge } from '@/components/ui/Badge';
import { GlassCard } from '@/components/ui/GlassCard';
import { Reveal } from '@/components/ui/Reveal';
import { TermsContent, TermsTabs } from '@/components/ui/TermsContent';
import { sectionsFor, type TermsPart } from '@/data/terms';

/**
 * /terms — the same document the registration form and the profile panel
 * open in a modal, as a page that can be linked to, read before signing up,
 * and reached from the footer. "#privacy" opens on that tab; a section id
 * in the hash ("#who-can-see") scrolls to it.
 */
export default function Terms() {
  const { hash } = useLocation();
  const id = hash.replace(/^#/, '');
  const startPart: TermsPart = id === 'privacy' || sectionsFor('privacy').some((s) => s.id === id) ? 'privacy' : 'terms';
  const [part, setPart] = useState<TermsPart>(startPart);
  const focus = sectionsFor(part).some((s) => s.id === id) ? id : undefined;

  useEffect(() => { setPart(startPart); }, [startPart]);

  return (
    <div className="min-h-screen">
      <Navbar />
      <main>
        <section className="px-4 pt-24 sm:pt-28">
          <div className="mx-auto max-w-3xl text-center">
            <Reveal className="flex justify-center">
              <Badge icon={<ScrollText className="h-3.5 w-3.5" />}>Terms &amp; privacy</Badge>
            </Reveal>
            <Reveal delay={0.05}>
              <h1 className="mt-5 text-balance text-4xl font-extrabold leading-[1.06] tracking-tight text-ink sm:text-5xl">
                What we do with your record,{' '}
                <span className="font-serif italic font-medium text-brand-600">in plain words</span>
              </h1>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">
                Every sentence here describes something the application actually does.
                It is what you agree to when you register, and what your profile links to.
              </p>
            </Reveal>
            <Reveal delay={0.15} className="mt-7 flex justify-center">
              <TermsTabs part={part} onChange={setPart} />
            </Reveal>
          </div>
        </section>

        <section className="px-4 py-12 sm:py-16">
          <div className="mx-auto max-w-3xl">
            <Reveal>
              <GlassCard strong className="p-7 sm:p-10">
                <TermsContent part={part} focus={focus} />
              </GlassCard>
            </Reveal>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
