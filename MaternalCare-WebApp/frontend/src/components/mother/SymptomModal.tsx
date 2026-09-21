import { AnimatePresence, motion } from 'framer-motion';
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlertTriangle, ArrowRight, Baby, Check, ChevronLeft, Lightbulb, Mic, Plus, Stethoscope,
  Trash2, X,
} from 'lucide-react';
import { LiquidButton } from '@/components/ui/LiquidButton';
import { AITextLoading } from '@/components/ui/AITextLoading';
import { BeamsBackground } from '@/components/ui/BeamsBackground';
import { cn } from '@/lib/cn';
import { useT } from '@/i18n';
import { api } from '@/lib/api';
import {
  COMMON_SYMPTOMS, INTENSITIES, INTENSITY_LABEL, parseTranscript, URGENT_LABELS,
  type Intensity, type Symptom,
} from '@/data/symptoms';
import {
  CHILD_COMMON_SYMPTOMS, childUrgent, parseChildTranscript,
} from '@/data/childSymptoms';
import {
  buildAdvice, buildChildAdvice, childDoctorReport, doctorReport, TONE_CLASS,
} from '@/lib/health';

const INTENSITY_CLASS: Record<Intensity, string> = {
  mild: 'bg-emerald-500/15 text-emerald-700 ring-emerald-500/25',
  mid: 'bg-brand-500/15 text-brand-700 ring-brand-500/25',
  high: 'bg-amber-500/15 text-amber-700 ring-amber-500/25',
  severe: 'bg-rose-500/15 text-rose-700 ring-rose-500/25',
};

const uid = () => `s-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const fmtTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

type Phase = 'review' | 'log' | 'thinking' | 'analysis';

interface Props {
  open: boolean;
  onClose: () => void;
  initial: Symptom[];
  onSave: (list: Symptom[]) => void;
  /**
   * The child, when there is one on the account. Their age decides how
   * urgently several symptoms are treated, so it is passed rather than
   * assumed: a fever means something different at three weeks and at three
   * years.
   */
  /**
   * Her life stage, which decides which causes are shown. Without it the
   * pregnancy explanations are used, which are wrong for three stages in four.
   */
  stage?: string;
  child?: { name: string; ageMonths: number } | null;
  initialChild?: Symptom[];
  onSaveChild?: (list: Symptom[]) => void;
}

export function SymptomModal({
  open, onClose, initial, onSave, stage, child = null, initialChild = [], onSaveChild,
}: Props) {
  const { lang } = useT();
  const [phase, setPhase] = useState<Phase>('log');
  const [list, setList] = useState<Symptom[]>(initial);
  const [review, setReview] = useState<Symptom[]>([]);
  const [draft, setDraft] = useState('');

  // the child's journal, kept apart from hers all the way down
  const [childList, setChildList] = useState<Symptom[]>(initialChild);
  const [childReview, setChildReview] = useState<Symptom[]>([]);
  const [childDraft, setChildDraft] = useState('');
  const hasChild = Boolean(child);
  /**
   * Which list the microphone is filling. Held in a ref as well as state
   * because the recogniser's callbacks are registered once and would
   * otherwise keep whichever value was current when the button was pressed.
   */
  const [voiceTarget, setVoiceTarget] = useState<'mother' | 'child'>('mother');
  const voiceTargetRef = useRef<'mother' | 'child'>('mother');
  const aimVoice = (t: 'mother' | 'child') => { voiceTargetRef.current = t; setVoiceTarget(t); };

  // voice
  const [listening, setListening] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [transcript, setTranscript] = useState('');
  const [voiceNote, setVoiceNote] = useState<string | null>(null);
  const recRef = useRef<any>(null);
  const mediaRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  /** null until asked: whether this server can transcribe audio itself */
  const [aiVoice, setAiVoice] = useState<boolean | null>(null);

  const SR = typeof window !== 'undefined'
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : undefined;
  const voiceSupported = Boolean(SR);

  /* open: carried-over symptoms get a "still there?" pass first */
  useEffect(() => {
    if (!open) return;
    const carried = initial.filter((s) => !s.confirmedToday);
    setReview(carried);
    setList(initial.filter((s) => s.confirmedToday));
    const carriedChild = initialChild.filter((s) => !s.confirmedToday);
    setChildReview(carriedChild);
    setChildList(initialChild.filter((s) => s.confirmedToday));
    setPhase(carried.length || carriedChild.length ? 'review' : 'log');
    setDraft(''); setChildDraft(''); setTranscript(''); setVoiceNote(null); setSeconds(0);
    aimVoice('mother');
  }, [open]);

  useEffect(() => {
    if (!listening) { setSeconds(0); return; }
    const id = setInterval(() => setSeconds((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [listening]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && open && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => () => { try { recRef.current?.stop(); } catch { /* noop */ } }, []);

  // ask once, when the sheet opens, whether the server can transcribe for us
  useEffect(() => {
    if (!open || aiVoice !== null) return;
    api.voiceCapability().then(setAiVoice).catch(() => setAiVoice(false));
  }, [open, aiVoice]);

  const addSymptoms = (incoming: Symptom[]) =>
    setList((prev) => {
      const have = new Set(prev.map((p) => p.name.toLowerCase()));
      return [...prev, ...incoming.filter((s) => !have.has(s.name.toLowerCase()))];
    });

  const addChildSymptoms = (incoming: Symptom[]) =>
    setChildList((prev) => {
      const have = new Set(prev.map((p) => p.name.toLowerCase()));
      return [...prev, ...incoming.filter((s) => !have.has(s.name.toLowerCase()))];
    });

  /**
   * Ask for the microphone before trying to listen.
   *
   * SpeechRecognition does not prompt reliably: on a first visit it can fail
   * straight to `not-allowed`, which the interface then reported as "blocked"
   * to someone who had never been asked. getUserMedia always either prompts,
   * grants, or refuses, so the three cases can be told apart and named. The
   * track is stopped immediately — this is a permission check, not a
   * recording, and leaving it open lights the microphone indicator.
   */
  const ensureMic = async (): Promise<'granted' | 'denied' | 'no-device' | 'unsupported'> => {
    if (!navigator.mediaDevices?.getUserMedia) return 'unsupported';
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      return 'granted';
    } catch (err: any) {
      if (err?.name === 'NotFoundError' || err?.name === 'DevicesNotFoundError') return 'no-device';
      return 'denied';
    }
  };

  const startVoice = () => {
    if (!voiceSupported) return;
    const rec = new SR();
    // her reading language, not always English — Bangla recognition is patchy
    // on many devices, which the error path below says rather than hides
    rec.lang = lang === 'bn' ? 'bn-BD' : 'en-US';
    rec.continuous = false; rec.interimResults = true;
    rec.onresult = (e: any) => {
      const text = Array.from(e.results).map((r: any) => r[0].transcript).join(' ');
      setTranscript(text);
      // one place decides which list this belongs to, for both voice routes
      if (e.results[e.results.length - 1].isFinal) applyTranscript(text);
    };
    rec.onerror = (e: any) => {
      setListening(false);
      setVoiceNote(e?.error === 'not-allowed'
        ? 'Microphone permission was blocked. Allow it in your browser to use voice.'
        : `Voice input stopped (${e?.error ?? 'unknown error'}). You can type instead.`);
    };
    rec.onend = () => setListening(false);
    recRef.current = rec;
    setTranscript(''); setVoiceNote(null); setListening(true);
    rec.start();
  };

  const stopVoice = () => {
    try { recRef.current?.stop(); } catch { /* noop */ }
    try { mediaRef.current?.stop(); } catch { /* noop */ }
    setListening(false);
  };

  /**
   * Turn whatever came back — from either route — into symptoms.
   *
   * Which list it lands in depends on which microphone was pressed. The two
   * vocabularies differ enough that reading a parent's "he won't feed"
   * against the mother's lexicon would match nothing at all.
   */
  const applyTranscript = (text: string) => {
    setTranscript(text);
    const forChild = voiceTargetRef.current === 'child';
    const { matches, unmatched } = forChild ? parseChildTranscript(text) : parseTranscript(text);
    const who = forChild ? `for ${child?.name || 'your child'}` : 'for you';
    if (matches.length) {
      (forChild ? addChildSymptoms : addSymptoms)(matches);
      setVoiceNote(`Found ${matches.length} symptom${matches.length > 1 ? 's' : ''} ${who}: ${matches.map((m) => m.name).join(', ')}.`);
    } else if (unmatched || text.trim()) {
      (forChild ? setChildDraft : setDraft)(text.trim());
      setVoiceNote(forChild
        ? `No known symptom matched — your words are in ${child?.name || 'your child'}'s box below, edit and add them.`
        : 'No known symptom matched — your words are in the box below, edit and add them.');
    } else {
      setVoiceNote('Nothing was picked up. Try again, closer to the microphone.');
    }
  };

  /**
   * Record, then have the server transcribe it.
   *
   * Used when a transcription service is configured. It is the better route
   * for this product: it works in any browser rather than only Chrome and
   * Edge, and it understands Bangla, which the built-in recogniser mostly
   * does not on the devices these mothers actually use.
   */
  const startRecording = async () => {
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setVoiceNote('Microphone permission was blocked. Allow it for this site in your browser, then try again.');
      return;
    }

    chunksRef.current = [];
    const mr = new MediaRecorder(stream);
    mediaRef.current = mr;

    mr.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
    mr.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      setListening(false);
      const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' });
      if (blob.size < 1200) { setVoiceNote('That was too short to hear. Hold the button and speak.'); return; }

      try {
        const dataUrl: string = await new Promise((resolve, reject) => {
          const fr = new FileReader();
          fr.onload = () => resolve(String(fr.result));
          fr.onerror = () => reject(new Error('Could not read the recording'));
          fr.readAsDataURL(blob);
        });
        const { text } = await api.transcribeVoice(dataUrl);
        applyTranscript(text);
      } catch (err) {
        setVoiceNote(err instanceof Error ? err.message : 'That could not be transcribed. You can type instead.');
      }
    };

    setTranscript(''); setVoiceNote(null); setListening(true);
    mr.start();
  };

  /**
   * One button, two routes.
   *
   * Permission is asked for explicitly first, so a first-time visitor gets the
   * browser's prompt instead of an immediate "blocked" — which is what used to
   * happen, and is why this looked broken when it was only unasked.
   */
  const beginVoice = async () => {
    setVoiceNote(null);

    const permission = await ensureMic();
    if (permission === 'unsupported') {
      setVoiceNote('This browser cannot use the microphone. You can type instead.');
      return;
    }
    if (permission === 'no-device') {
      setVoiceNote('No microphone was found on this device. You can type instead.');
      return;
    }
    if (permission === 'denied') {
      setVoiceNote('Microphone permission is blocked for this site. Open the padlock in the address bar, allow the microphone, then reload.');
      return;
    }

    if (aiVoice) { await startRecording(); return; }
    if (voiceSupported) { startVoice(); return; }
    setVoiceNote('Voice is not available in this browser, and this server has no transcription service. You can type instead.');
  };

  const addDraft = () => {
    const name = draft.trim();
    if (!name) return;
    addSymptoms([{ id: uid(), name: name.charAt(0).toUpperCase() + name.slice(1), intensity: 'mid', daysPresent: 1, confirmedToday: true }]);
    setDraft('');
  };

  const addChildDraft = () => {
    const name = childDraft.trim();
    if (!name) return;
    addChildSymptoms([{ id: uid(), name: name.charAt(0).toUpperCase() + name.slice(1), intensity: 'mid', daysPresent: 1, confirmedToday: true }]);
    setChildDraft('');
  };

  /* review answers */
  const stillThere = (s: Symptom) => {
    setList((p) => [...p, { ...s, daysPresent: s.daysPresent + 1, confirmedToday: true }]);
    setReview((p) => p.filter((r) => r.id !== s.id));
  };
  const resolved = (s: Symptom) => setReview((p) => p.filter((r) => r.id !== s.id));

  const childStillThere = (s: Symptom) => {
    setChildList((p) => [...p, { ...s, daysPresent: s.daysPresent + 1, confirmedToday: true }]);
    setChildReview((p) => p.filter((r) => r.id !== s.id));
  };
  const childResolved = (s: Symptom) => setChildReview((p) => p.filter((r) => r.id !== s.id));

  useEffect(() => {
    if (phase === 'review' && review.length === 0 && childReview.length === 0) setPhase('log');
  }, [review, childReview, phase]);

  const save = () => {
    onSave(list);
    // only when the account has a child; otherwise there is nothing to write
    if (hasChild) onSaveChild?.(childList);
    setPhase('thinking');
    setTimeout(() => setPhase('analysis'), 2600);
  };

  const advice = useMemo(() => buildAdvice(list, stage), [list, stage]);
  const report = useMemo(() => doctorReport(list), [list]);
  const childAdvice = useMemo(
    () => buildChildAdvice(childList, child?.ageMonths), [childList, child?.ageMonths],
  );
  const childReport = useMemo(
    () => childDoctorReport(childList, child?.ageMonths, child?.name),
    [childList, child?.ageMonths, child?.name],
  );

  const setIntensity = (id: string, intensity: Intensity) =>
    setList((prev) => prev.map((s) => (s.id === id ? { ...s, intensity } : s)));
  const remove = (id: string) => setList((prev) => prev.filter((s) => s.id !== id));
  const setChildIntensity = (id: string, intensity: Intensity) =>
    setChildList((prev) => prev.map((s) => (s.id === id ? { ...s, intensity } : s)));
  const removeChild = (id: string) => setChildList((prev) => prev.filter((s) => s.id !== id));

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          /* the wrapper owns the exit so the overlay always unmounts and never
             blocks clicks on the page behind it */
          exit={{ opacity: 0, pointerEvents: 'none', transition: { duration: 0.2 } }}
          transition={{ duration: 0.2 }}
        >
          {/* backdrop — blur ramps up with the fade so it never pops in */}
          <motion.div
            className="absolute inset-0 bg-ink/35"
            onClick={onClose}
            initial={{ opacity: 0, backdropFilter: 'blur(0px)', WebkitBackdropFilter: 'blur(0px)' }}
            animate={{ opacity: 1, backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)' }}
            transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          />

          <motion.div
            layout
            role="dialog" aria-modal="true" aria-label="Log symptoms"
            initial={{ opacity: 0, scale: 0.94, y: 18 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 10, transition: { duration: 0.18 } }}
            transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            className="glass-strong ring-gradient relative flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-4xl"
          >
            {/* header */}
            <div className="flex items-start justify-between gap-3 px-6 pt-6">
              <div>
                <h2 className="text-xl font-extrabold tracking-tight text-ink">
                  {phase === 'review' ? 'Still with you?' : phase === 'analysis' ? 'What this could be' : 'How are you feeling?'}
                </h2>
                <p className="mt-1 text-sm text-ink-muted">
                  {phase === 'review' ? 'Confirm what you logged before, so we can track how long it lasts.'
                    : phase === 'analysis' ? 'Possible causes and what helps right now.'
                    : hasChild
                      ? `Speak or type — yours above, ${child?.name || 'your child'}'s below.`
                      : 'Speak or type — we’ll turn it into a symptom list.'}
                </p>
              </div>
              <button onClick={onClose} aria-label="Close" className="grid h-9 w-9 flex-none place-items-center rounded-xl bg-white/70 text-ink-soft transition-colors hover:text-ink">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-5 flex-1 overflow-y-auto px-6 pb-2">
              {/* ---------- REVIEW ---------- */}
              {phase === 'review' && (
                <motion.div
                  key="review"
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                  className="space-y-2.5"
                >
                  <AnimatePresence initial={false} mode="popLayout">
                  {review.map((s) => (
                    <motion.div key={s.id} layout
                      initial={{ opacity: 0, y: 8, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, x: -28, scale: 0.94, transition: { duration: 0.22 } }}
                      transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                      className="rounded-2xl border border-white/60 bg-white/60 p-3.5">
                      <div className="flex items-center gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 text-sm font-bold text-ink">
                            {URGENT_LABELS.has(s.name) && <AlertTriangle className="h-3.5 w-3.5 flex-none text-rose-500" />}
                            {s.name}
                          </div>
                          <div className="text-[11px] font-semibold text-ink-muted">
                            Logged {s.daysPresent} day{s.daysPresent > 1 ? 's' : ''} · {INTENSITY_LABEL[s.intensity]}
                          </div>
                        </div>
                        <button onClick={() => resolved(s)} className="rounded-xl border border-white/70 bg-white/70 px-3 py-2 text-xs font-bold text-ink-soft transition hover:text-ink">
                          It’s gone
                        </button>
                        <button onClick={() => stillThere(s)} className="rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 px-3 py-2 text-xs font-bold text-white shadow-glow">
                          Still there
                        </button>
                      </div>
                    </motion.div>
                  ))}
                  </AnimatePresence>

                  {/* the child's carried-over symptoms, asked the same way */}
                  {childReview.length > 0 && (
                    <div className="pt-1">
                      <div className="flex items-center gap-1.5 pb-2 text-xs font-bold uppercase tracking-wider text-ink-faint">
                        <Baby className="h-3.5 w-3.5" /> {child?.name || 'Your child'}
                      </div>
                      <div className="space-y-2.5">
                        <AnimatePresence initial={false} mode="popLayout">
                          {childReview.map((s) => (
                            <motion.div key={s.id} layout
                              initial={{ opacity: 0, y: 8, scale: 0.97 }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, x: -28, scale: 0.94, transition: { duration: 0.22 } }}
                              transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                              className="rounded-2xl border border-white/60 bg-white/60 p-3.5">
                              <div className="flex items-center gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 text-sm font-bold text-ink">
                                    {childUrgent(s.name, child?.ageMonths) && <AlertTriangle className="h-3.5 w-3.5 flex-none text-rose-500" />}
                                    {s.name}
                                  </div>
                                  <div className="text-[11px] font-semibold text-ink-muted">
                                    Logged {s.daysPresent} day{s.daysPresent > 1 ? 's' : ''} · {INTENSITY_LABEL[s.intensity]}
                                  </div>
                                </div>
                                <button onClick={() => childResolved(s)} className="rounded-xl border border-white/70 bg-white/70 px-3 py-2 text-xs font-bold text-ink-soft transition hover:text-ink">
                                  It’s gone
                                </button>
                                <button onClick={() => childStillThere(s)} className="rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 px-3 py-2 text-xs font-bold text-white shadow-glow">
                                  Still there
                                </button>
                              </div>
                            </motion.div>
                          ))}
                        </AnimatePresence>
                      </div>
                    </div>
                  )}
                </motion.div>
              )}

              {/* ---------- LOG ---------- */}
              {phase === 'log' && (
                <motion.div
                  key="log"
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
                >
                  {/* AI voice */}
                  <div className="relative overflow-hidden rounded-3xl border border-white/60 bg-white/50 py-5">
                    <BeamsBackground intensity="medium" count={12} />
                    <div className="relative mx-auto flex w-full flex-col items-center gap-2">
                      <button
                        type="button"
                        onClick={listening ? stopVoice : () => { aimVoice('mother'); beginVoice(); }}
                        disabled={!voiceSupported}
                        className={cn(
                          'group flex h-16 w-16 items-center justify-center rounded-2xl transition-colors',
                          listening ? 'bg-none' : 'hover:bg-brand-500/10',
                          !voiceSupported && 'cursor-not-allowed opacity-40',
                        )}
                      >
                        {listening ? (
                          <div className="h-6 w-6 animate-spin cursor-pointer rounded-sm bg-gradient-to-br from-brand-500 to-brand-700" style={{ animationDuration: '3s' }} />
                        ) : (
                          <Mic className="h-6 w-6 text-ink/80" />
                        )}
                      </button>

                      <span className={cn('font-mono text-sm transition-opacity duration-300', listening ? 'text-ink/70' : 'text-ink/30')}>
                        {fmtTime(seconds)}
                      </span>

                      <div className="flex h-4 w-64 items-center justify-center gap-0.5">
                        {[...Array(48)].map((_, i) => (
                          <div
                            key={i}
                            className={cn('w-0.5 rounded-full transition-all duration-300',
                              listening ? 'animate-pulse bg-brand-600/60' : 'h-1 bg-ink/10')}
                            style={listening ? { height: `${20 + ((i * 37) % 80)}%`, animationDelay: `${i * 0.05}s` } : undefined}
                          />
                        ))}
                      </div>

                      <p className="h-4 text-xs font-semibold text-ink/70">
                        {listening
                          ? `Listening — ${voiceTarget === 'child' ? `about ${child?.name || 'your child'}` : 'about you'}…`
                          : voiceSupported ? 'Click to speak' : 'Voice not supported here'}
                      </p>
                    </div>

                    {(transcript || voiceNote) && (
                      <div className="relative mt-3 space-y-2 px-5">
                        {transcript && <div className="rounded-2xl bg-white/70 px-3.5 py-2.5 text-sm italic text-ink-soft">“{transcript}”</div>}
                        {voiceNote && <div className="rounded-2xl bg-brand-500/10 px-3.5 py-2 text-xs font-semibold text-brand-700 ring-1 ring-brand-500/20">{voiceNote}</div>}
                      </div>
                    )}
                    {!transcript && !voiceNote && voiceSupported && (
                      <p className="relative mt-2 px-5 text-center text-[11px] text-ink-faint">
                        {voiceTarget === 'child'
                          ? `Try: “${child?.name || 'She'} has a fever and won't feed.”`
                          : 'Try: “I have a bad headache and mild swelling in my ankles.”'}
                      </p>
                    )}
                  </div>

                  {/* quick add */}
                  <div className="mt-5">
                    <div className="text-xs font-bold uppercase tracking-wider text-ink-faint">Quick add</div>
                    <div className="mt-2.5 flex flex-wrap gap-2">
                      {COMMON_SYMPTOMS.map((s) => {
                        const active = list.some((l) => l.name === s);
                        return (
                          <button key={s}
                            onClick={() => (active ? setList((p) => p.filter((l) => l.name !== s)) : addSymptoms([{ id: uid(), name: s, intensity: 'mid', daysPresent: 1, confirmedToday: true }]))}
                            className={cn('rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                              active ? 'border-brand-500/40 bg-brand-500/15 text-brand-700' : 'border-white/60 bg-white/60 text-ink-soft hover:bg-white')}>
                            {active && <Check className="mr-1 inline h-3 w-3" />}{s}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* list */}
                  <div className="mt-5">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-bold uppercase tracking-wider text-ink-faint">Your list</div>
                      <span className="text-xs font-semibold text-ink-muted">{list.length} logged</span>
                    </div>

                    <div className="mt-2.5 space-y-2">
                      <AnimatePresence initial={false}>
                        {list.map((s) => (
                          <motion.div key={s.id} layout
                            initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, x: -20, scale: 0.95 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 26 }}
                            className="rounded-2xl border border-white/60 bg-white/60 px-3 py-2.5">
                            <div className="flex items-center gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 text-sm font-bold text-ink">
                                  {URGENT_LABELS.has(s.name) && <AlertTriangle className="h-3.5 w-3.5 flex-none text-rose-500" />}
                                  <span className="truncate">{s.name}</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide">
                                  {s.daysPresent > 1 && <span className="text-amber-600">day {s.daysPresent}</span>}
                                  {s.fromVoice && <span className="text-brand-600">from voice</span>}
                                </div>
                              </div>
                              <button onClick={() => remove(s.id)} aria-label={`Remove ${s.name}`}
                                className="grid h-7 w-7 flex-none place-items-center rounded-lg text-ink-faint transition-colors hover:bg-rose-500/10 hover:text-rose-600">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                            <div className="mt-2 flex gap-1">
                              {INTENSITIES.map((iv) => (
                                <button key={iv} onClick={() => setIntensity(s.id, iv)}
                                  className={cn('flex-1 rounded-lg px-2 py-1 text-[10px] font-bold ring-1 transition',
                                    s.intensity === iv ? INTENSITY_CLASS[iv] : 'bg-white/50 text-ink-faint ring-transparent hover:text-ink-soft')}>
                                  {INTENSITY_LABEL[iv]}
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        ))}
                      </AnimatePresence>

                      {list.length === 0 && (
                        <div className="rounded-2xl border border-dashed border-ink/15 px-3 py-6 text-center text-xs font-medium text-ink-faint">
                          Nothing logged yet — speak, quick-add, or write one below.
                        </div>
                      )}
                    </div>

                    <div className="mt-3 flex gap-2">
                      <input value={draft} onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && addDraft()}
                        placeholder="Write a symptom…"
                        className="h-11 flex-1 rounded-2xl border border-white/60 bg-white/70 px-4 text-sm font-medium text-ink outline-none transition placeholder:text-ink-faint focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20" />
                      <button onClick={addDraft} disabled={!draft.trim()} aria-label="Add symptom to list"
                        className="grid h-11 w-11 flex-none place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-glow transition disabled:opacity-40">
                        <Plus className="h-5 w-5" />
                      </button>
                    </div>
                  </div>

                  {/* ---------- the child's symptoms ---------- */}
                  {hasChild && (
                    <div className="mt-6 rounded-3xl border border-brand-500/20 bg-brand-500/[0.04] p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-brand-700">
                          <Baby className="h-3.5 w-3.5" /> {child?.name || 'Your child'}’s symptoms
                        </div>
                        <button
                          type="button"
                          onClick={listening ? stopVoice : () => { aimVoice('child'); beginVoice(); }}
                          disabled={!voiceSupported && !aiVoice}
                          aria-label={`Speak ${child?.name || 'your child'}'s symptoms`}
                          className={cn('flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition',
                            listening && voiceTarget === 'child'
                              ? 'bg-brand-600 text-white'
                              : 'bg-white/70 text-ink-soft hover:text-ink',
                            !voiceSupported && !aiVoice && 'cursor-not-allowed opacity-40')}>
                          <Mic className="h-3.5 w-3.5" />
                          {listening && voiceTarget === 'child' ? 'Listening…' : 'Speak'}
                        </button>
                      </div>

                      <p className="mt-1 text-[11px] leading-relaxed text-ink-muted">
                        Logged against {child?.name || 'your child'}, not you — so your own wellbeing
                        score and your doctor’s view stay about you.
                      </p>

                      {/* quick add */}
                      <div className="mt-3 flex flex-wrap gap-2">
                        {CHILD_COMMON_SYMPTOMS.map((c) => {
                          const active = childList.some((l) => l.name === c);
                          return (
                            <button key={c}
                              onClick={() => (active
                                ? setChildList((prev) => prev.filter((l) => l.name !== c))
                                : addChildSymptoms([{ id: uid(), name: c, intensity: 'mid', daysPresent: 1, confirmedToday: true }]))}
                              className={cn('rounded-full border px-3 py-1.5 text-xs font-semibold transition',
                                active ? 'border-brand-500/40 bg-brand-500/15 text-brand-700' : 'border-white/60 bg-white/70 text-ink-soft hover:bg-white')}>
                              {active && <Check className="mr-1 inline h-3 w-3" />}{c}
                            </button>
                          );
                        })}
                      </div>

                      {/* list */}
                      <div className="mt-3 space-y-2">
                        <AnimatePresence initial={false}>
                          {childList.map((s) => (
                            <motion.div key={s.id} layout
                              initial={{ opacity: 0, y: -8, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                              exit={{ opacity: 0, x: -20, scale: 0.95 }}
                              transition={{ type: 'spring', stiffness: 300, damping: 26 }}
                              className="rounded-2xl border border-white/60 bg-white/70 px-3 py-2.5">
                              <div className="flex items-center gap-2">
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 text-sm font-bold text-ink">
                                    {childUrgent(s.name, child?.ageMonths) && <AlertTriangle className="h-3.5 w-3.5 flex-none text-rose-500" />}
                                    <span className="truncate">{s.name}</span>
                                  </div>
                                  <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide">
                                    {s.daysPresent > 1 && <span className="text-amber-600">day {s.daysPresent}</span>}
                                    {s.fromVoice && <span className="text-brand-600">from voice</span>}
                                  </div>
                                </div>
                                <button onClick={() => removeChild(s.id)} aria-label={`Remove ${s.name}`}
                                  className="grid h-7 w-7 flex-none place-items-center rounded-lg text-ink-faint transition-colors hover:bg-rose-500/10 hover:text-rose-600">
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                              <div className="mt-2 flex gap-1">
                                {INTENSITIES.map((iv) => (
                                  <button key={iv} onClick={() => setChildIntensity(s.id, iv)}
                                    className={cn('flex-1 rounded-lg px-2 py-1 text-[10px] font-bold ring-1 transition',
                                      s.intensity === iv ? INTENSITY_CLASS[iv] : 'bg-white/60 text-ink-faint ring-transparent hover:text-ink-soft')}>
                                    {INTENSITY_LABEL[iv]}
                                  </button>
                                ))}
                              </div>
                            </motion.div>
                          ))}
                        </AnimatePresence>

                        {childList.length === 0 && (
                          <div className="rounded-2xl border border-dashed border-ink/15 px-3 py-5 text-center text-xs font-medium text-ink-faint">
                            Nothing logged for {child?.name || 'your child'} today.
                          </div>
                        )}
                      </div>

                      <div className="mt-3 flex gap-2">
                        <input value={childDraft} onChange={(e) => setChildDraft(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && addChildDraft()}
                          placeholder={`Write a symptom for ${child?.name || 'your child'}…`}
                          className="h-11 flex-1 rounded-2xl border border-white/60 bg-white/80 px-4 text-sm font-medium text-ink outline-none transition placeholder:text-ink-faint focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20" />
                        <button onClick={addChildDraft} disabled={!childDraft.trim()} aria-label="Add symptom for your child"
                          className="grid h-11 w-11 flex-none place-items-center rounded-2xl bg-gradient-to-br from-brand-500 to-brand-700 text-white shadow-glow transition disabled:opacity-40">
                          <Plus className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  )}

                  <p className="mt-4 text-[11px] leading-relaxed text-ink-faint">
                    This log helps you and your care team spot patterns — it is not a diagnosis.
                  </p>
                </motion.div>
              )}

              {/* ---------- THINKING ---------- */}
              {phase === 'thinking' && (
                <motion.div
                  key="thinking"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                  className="py-10"
                >
                  <AITextLoading texts={['Reading your symptoms…', 'Checking how long they’ve lasted…', 'Matching likely causes…', 'Preparing relief steps…']} />
                  <div className="mx-auto mt-2 flex max-w-xs flex-col gap-2">
                    {[0, 1, 2].map((i) => (
                      <motion.div key={i} className="h-2.5 rounded-full bg-ink/[0.06]"
                        initial={{ opacity: 0.3 }} animate={{ opacity: [0.3, 0.8, 0.3] }}
                        transition={{ duration: 1.6, repeat: Infinity, delay: i * 0.2 }} />
                    ))}
                  </div>
                </motion.div>
              )}

              {/* ---------- ANALYSIS ---------- */}
              {phase === 'analysis' && (
                <motion.div
                  key="analysis"
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                  className="space-y-3"
                >
                  {advice.length === 0 && childAdvice.length === 0 && (
                    <div className={cn('rounded-2xl px-4 py-3 text-sm font-semibold ring-1', TONE_CLASS.good)}>
                      Nothing logged — nothing to analyse. That’s good news.
                    </div>
                  )}

                  {advice.length > 0 && hasChild && (
                    <div className="text-xs font-bold uppercase tracking-wider text-ink-faint">You</div>
                  )}

                  {advice.map((a) => (
                    <motion.div key={a.name} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.35 }}
                      className="overflow-hidden rounded-2xl border border-white/60 bg-white/60">
                      <div className={cn('flex items-center gap-2 px-4 py-2.5 text-sm font-bold ring-1', TONE_CLASS[a.tone])}>
                        {a.urgent && <AlertTriangle className="h-4 w-4 flex-none" />}
                        {a.name}
                        <span className="ml-auto text-[10px] font-bold uppercase tracking-wide opacity-80">
                          day {a.daysPresent} · {a.stage}
                        </span>
                      </div>

                      <div className="px-4 py-3">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Possible causes</div>
                        <ul className="mt-1.5 space-y-1">
                          {a.causes.map((c) => (
                            <li key={c} className="flex gap-2 text-[12px] leading-relaxed text-ink-soft">
                              <span className="mt-1.5 h-1 w-1 flex-none rounded-full bg-ink-faint" />{c}
                            </li>
                          ))}
                        </ul>

                        <div className="mt-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-600">
                          <Lightbulb className="h-3.5 w-3.5" /> What helps right now
                        </div>
                        <ul className="mt-1.5 space-y-1">
                          {a.relief.map((r) => (
                            <li key={r} className="flex gap-2 text-[12px] leading-relaxed text-ink-soft">
                              <Check className="mt-0.5 h-3.5 w-3.5 flex-none text-brand-500" />{r}
                            </li>
                          ))}
                        </ul>

                        <div className={cn('mt-3 rounded-xl px-3 py-2 text-[11px] font-semibold leading-relaxed ring-1', TONE_CLASS[a.tone])}>
                          {a.stageNote}
                        </div>
                      </div>
                    </motion.div>
                  ))}

                  {/* the child's, read against their age */}
                  {childAdvice.length > 0 && (
                    <>
                      <div className="flex items-center gap-1.5 pt-2 text-xs font-bold uppercase tracking-wider text-ink-faint">
                        <Baby className="h-3.5 w-3.5" /> {child?.name || 'Your child'}
                        {child ? ` · ${child.ageMonths} month${child.ageMonths === 1 ? '' : 's'}` : ''}
                      </div>
                      {childAdvice.map((a) => (
                        <motion.div key={`c-${a.name}`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.35 }}
                          className="overflow-hidden rounded-2xl border border-white/60 bg-white/60">
                          <div className={cn('flex items-center gap-2 px-4 py-2.5 text-sm font-bold ring-1', TONE_CLASS[a.tone])}>
                            {a.urgent && <AlertTriangle className="h-4 w-4 flex-none" />}
                            {a.name}
                            <span className="ml-auto text-[10px] font-bold uppercase tracking-wide opacity-80">
                              day {a.daysPresent} · {a.stage}
                            </span>
                          </div>

                          <div className="px-4 py-3">
                            <div className="text-[11px] font-bold uppercase tracking-wider text-ink-faint">Possible causes</div>
                            <ul className="mt-1.5 space-y-1">
                              {a.causes.map((c) => (
                                <li key={c} className="flex gap-2 text-[12px] leading-relaxed text-ink-soft">
                                  <span className="mt-1.5 h-1 w-1 flex-none rounded-full bg-ink-faint" />{c}
                                </li>
                              ))}
                            </ul>

                            <div className="mt-3 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-brand-600">
                              <Lightbulb className="h-3.5 w-3.5" /> What helps right now
                            </div>
                            <ul className="mt-1.5 space-y-1">
                              {a.relief.map((r) => (
                                <li key={r} className="flex gap-2 text-[12px] leading-relaxed text-ink-soft">
                                  <Check className="mt-0.5 h-3.5 w-3.5 flex-none text-brand-500" />{r}
                                </li>
                              ))}
                            </ul>

                            <div className={cn('mt-3 rounded-xl px-3 py-2 text-[11px] font-semibold leading-relaxed ring-1', TONE_CLASS[a.tone])}>
                              {a.stageNote}
                            </div>
                          </div>
                        </motion.div>
                      ))}

                      <div className={cn('rounded-2xl px-4 py-3 ring-1', TONE_CLASS[childReport.tone])}>
                        <div className="flex items-center gap-2 text-sm font-bold">
                          <Stethoscope className="h-4 w-4" /> For {child?.name || 'your child'}’s clinic — {childReport.headline}
                        </div>
                        <ul className="mt-2 space-y-1">
                          {childReport.lines.map((l) => (
                            <li key={l} className="flex gap-2 text-[11px] font-medium leading-relaxed opacity-90">
                              <span className="mt-1.5 h-1 w-1 flex-none rounded-full bg-current" />{l}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </>
                  )}

                  {/* doctor report */}
                  {advice.length > 0 && (
                    <div className={cn('rounded-2xl px-4 py-3 ring-1', TONE_CLASS[report.tone])}>
                      <div className="flex items-center gap-2 text-sm font-bold">
                        <Stethoscope className="h-4 w-4" /> For your care team — {report.headline}
                      </div>
                      <ul className="mt-2 space-y-1">
                        {report.lines.map((l) => (
                          <li key={l} className="flex gap-2 text-[11px] font-medium leading-relaxed opacity-90">
                            <span className="mt-1.5 h-1 w-1 flex-none rounded-full bg-current" />{l}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <p className="pt-1 text-[11px] leading-relaxed text-ink-faint">
                    {childAdvice.length > 0 && advice.length === 0
                      ? `General guidance about ${child?.name || 'your child'} based on what you logged — not a diagnosis.`
                      : childAdvice.length > 0
                        ? 'General guidance for you and your child based on what you logged — not a diagnosis.'
                        /* "pregnancy guidance" was the closing line for every
                           stage, including a woman planning one */
                        : stage === 'pregnant'
                          ? 'General pregnancy guidance based on what you logged — not a diagnosis.'
                          : 'General guidance based on what you logged — not a diagnosis.'}
                    {' '}If something feels wrong, contact your doctor.
                  </p>
                </motion.div>
              )}
            </div>

            {/* footer */}
            <div className="flex items-center justify-between gap-2 border-t border-white/50 px-6 py-4">
              {phase === 'analysis' ? (
                <>
                  <LiquidButton variant="ghost" onClick={() => setPhase('log')} icon={<ChevronLeft className="h-4 w-4" />}>Edit list</LiquidButton>
                  <LiquidButton onClick={onClose} iconRight={<ArrowRight className="h-[18px] w-[18px]" />}>Done</LiquidButton>
                </>
              ) : phase === 'thinking' ? (
                <span className="w-full text-center text-xs font-semibold text-ink-faint">Analysing your entry…</span>
              ) : phase === 'review' ? (
                <>
                  <LiquidButton variant="ghost" onClick={onClose}>Cancel</LiquidButton>
                  <LiquidButton variant="glass" onClick={() => { setReview([]); setPhase('log'); }}>Skip review</LiquidButton>
                </>
              ) : (
                <>
                  <LiquidButton variant="ghost" onClick={onClose}>Cancel</LiquidButton>
                  <LiquidButton onClick={save} icon={<Check className="h-[18px] w-[18px]" />}>
                    Save {list.length + childList.length ? `(${list.length + childList.length})` : ''}
                  </LiquidButton>
                </>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
