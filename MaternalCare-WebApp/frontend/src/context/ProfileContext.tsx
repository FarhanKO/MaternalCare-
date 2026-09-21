import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api, type LifeStage } from '@/lib/api';
import { resolveFileUrl } from '@/lib/files';
import { useAuth } from '@/lib/auth';
import type { HistoryLine } from '@/data/records';

export interface Profile {
  name: string;
  /** URL of the stored photo, or null to fall back to initials */
  avatar: string | null;
  bio: string;
  /** drives which reading, news and questions the app shows */
  stage: LifeStage;
  /**
   * Clinical basics shown on the profile panel.
   *
   * `week`, `dueDate` and `trimester` are derived from her pregnancy, and are
   * null whenever she does not have one — a woman planning a pregnancy, or the
   * parent of a two-year-old, has no week number. Inventing one is how this
   * panel came to tell all four mothers they were 26 weeks gone.
   */
  details: {
    week: number | null;
    dueDate: string | null;
    trimester: number | null;
    bloodGroup: string;
    age: number | null;
    /** ongoing conditions, as she wrote them — '' when she named none */
    conditions: string;
    /** as she typed it at onboarding — '' when none */
    allergies: string;
    /** her questionnaire answers for her stage, each naming its question */
    history: HistoryLine[];
  };
}

interface ProfileValue extends Profile {
  initials: string;
  /** false until the server has answered, so nothing renders a half-filled record */
  loaded: boolean;
  setAvatar: (dataUrl: string | null) => void;
  setBio: (bio: string) => void;
  setName: (name: string) => void;
  setStage: (stage: LifeStage) => void;
  setDetail: <K extends keyof Profile['details']>(key: K, value: Profile['details'][K]) => void;
  /**
   * Read everything again from the server. The questionnaire calls this
   * after saving: the details here were loaded once at sign-in, and a due
   * date changed on /onboarding was not visible on the profile until the
   * next full reload.
   */
  reload: () => void;
}

/**
 * The shape before the server has answered.
 *
 * Deliberately empty. This used to hold a real patient's name, week 26, a due
 * date of April 2 and blood group B+, which meant every mother who signed in
 * saw Ayesha Rahman's record until the fetch landed — and permanently if it
 * failed, or if the provider never refetched. On a medical record, a
 * placeholder that looks like data is worse than a blank.
 */
const EMPTY: Profile = {
  name: '',
  avatar: null,
  bio: '',
  stage: 'pregnant',
  details: {
    week: null, dueDate: null, trimester: null, bloodGroup: '', age: null, conditions: '', allergies: '', history: [],
  },
};

const Ctx = createContext<ProfileValue | null>(null);

/**
 * The signed-in mother's identity, kept in step everywhere it appears —
 * header, profile panel, community posts, the doctor's record of her.
 *
 * Every edit is written through to the server. It used to live only here, so
 * a new photo or bio was lost on refresh and the clinician never saw the
 * name the mother had chosen.
 */
export function ProfileProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile>(EMPTY);
  const [loaded, setLoaded] = useState(false);
  // bumped by reload(); the effect below depends on it
  const [generation, setGeneration] = useState(0);

  /*
   * Keyed on who is signed in, not on mount.
   *
   * This provider sits above the router, so it mounts once for the whole
   * session. With an empty dependency list it fetched a single time — while
   * nobody was signed in, on the sign-in page — and then never again. Signing
   * in navigated to a dashboard still holding whatever that first call had
   * returned, which is how one mother's account came to render another
   * mother's pregnancy.
   */
  useEffect(() => {
    if (!user) {
      setProfile(EMPTY);
      setLoaded(false);
      return undefined;
    }

    let cancelled = false;
    setLoaded(false);
    // the session already knows her name and her stage, so no frame of the
    // page is ever addressed to the wrong woman while the record loads
    setProfile({
      ...EMPTY,
      name: user.name,
      stage: (user.stage as LifeStage) ?? EMPTY.stage,
    });

    Promise.all([
      api.getProfile(),
      // null for anyone who is not pregnant, which is most of them
      api.getPregnancy().catch(() => null),
    ])
      .then(async ([p, pregnancy]) => {
        // in the app the photo is fetched with the session first (lib/files)
        const avatar = p.avatar ? await resolveFileUrl(p.avatar).catch(() => null) : null;
        if (cancelled) return;
        setProfile({
          name: p.name,
          bio: p.bio,
          avatar,
          stage: (p.stage as LifeStage) ?? EMPTY.stage,
          details: {
            week: pregnancy?.week ?? null,
            dueDate: pregnancy?.eddPretty ?? null,
            trimester: pregnancy?.trimester ?? null,
            bloodGroup: p.bloodGroup ?? '',
            age: p.age ?? null,
            conditions: p.conditions ?? '',
            allergies: p.allergies ?? '',
            history: p.history ?? [],
          },
        });
        setLoaded(true);
      })
      .catch(() => { if (!cancelled) setLoaded(true); /* offline — keep what the session gave us */ });

    return () => { cancelled = true; };
  }, [user, generation]);

  /**
   * Apply locally first so the UI never lags a keystroke, then persist. On
   * failure the server's copy is pulled back so the screen cannot keep
   * showing an edit that was never saved.
   */
  const reload = useCallback(() => setGeneration((g) => g + 1), []);

  const push = useCallback(
    (local: Partial<Profile>, patch: Parameters<typeof api.updateProfile>[0]) => {
      setProfile((p) => ({ ...p, ...local }));
      api.updateProfile(patch)
        .then(async (saved) => {
          const avatar = saved.avatar ? await resolveFileUrl(saved.avatar).catch(() => null) : null;
          setProfile((p) => ({ ...p, name: saved.name, bio: saved.bio, avatar }));
        })
        .catch(() => {
          api.getProfile()
            .then(async (p) => {
              const avatar = p.avatar ? await resolveFileUrl(p.avatar).catch(() => null) : null;
              setProfile((prev) => ({ ...prev, name: p.name, bio: p.bio, avatar }));
            })
            .catch(() => { /* still offline; leave what is on screen */ });
        });
    },
    [],
  );

  const value = useMemo<ProfileValue>(() => ({
    ...profile,
    loaded,
    initials: profile.name
      ? profile.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
      : '',

    // the data URL goes to the server; what comes back is a URL to the stored file
    setAvatar: (avatar) => push({ avatar }, { avatar }),
    setBio: (bio) => push({ bio }, { bio }),
    setName: (name) => push({ name }, { name }),

    /*
     * Only the two facts that are actually hers to state. Week, due date and
     * trimester are computed from her LMP on the server; a control that let
     * her type over them moved a number on screen and nothing else.
     */
    reload,
    setDetail: (key, value) => {
      if (key === 'bloodGroup') {
        setProfile((p) => ({ ...p, details: { ...p.details, bloodGroup: String(value) } }));
        api.updateProfile({ bloodGroup: String(value) }).catch(() => {});
      }
      if (key === 'age') {
        setProfile((p) => ({ ...p, details: { ...p.details, age: Number(value) } }));
        api.updateProfile({ age: Number(value) }).catch(() => {});
      }
    },

    setStage: (stage) => {
      setProfile((p) => ({ ...p, stage }));
      api.setStage(stage).catch(() => { /* offline — applies this session */ });
    },
  }), [profile, loaded, push, reload]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useProfile() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useProfile must be used inside <ProfileProvider>');
  return ctx;
}

/** Shared avatar — shows the stored photo when set, initials otherwise. */
export function ProfileAvatar({ className, textClass }: { className?: string; textClass?: string }) {
  const { avatar, initials, name } = useProfile();
  if (avatar) {
    return <img src={avatar} alt={name} className={`${className} object-cover`} />;
  }
  return <span className={`${className} grid place-items-center ${textClass ?? ''}`}>{initials}</span>;
}
