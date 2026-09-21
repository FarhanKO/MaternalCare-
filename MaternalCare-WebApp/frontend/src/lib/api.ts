/**
 * API client — talks to the Express MVC backend (routes/api.js).
 * The React app is a View layer; all persistence and domain rules live in
 * the server's Model layer.
 */
import type { Symptom } from '@/data/symptoms';
import type { Reminder } from '@/data/reminders';
import type { Patient } from '@/data/doctor';
import {
  RequestRefused, type Appointment, type AppointmentChange, type CareDocument,
  type CareEnding, type CareEndingSummary, type CareReason, type CareTeamMember,
  type DocumentKind, type Doctor, type DoctorThread, type Message, type MotherThread,
  type MessageKind, type PayMethod, type Plan, type RankedDoctor, type SlotOffer,
  type UpcomingVisit,
} from '@/data/care';
import type { Guardian, SosAlert } from '@/data/sos';
import type {
  AuthUser, CarePlan, ChildLogState, ChildState, DailyLogState, FetalSizePoint,
  Milestone, Pregnancy, ReportGroup, ReportReason,
  RiskView, ServerPost, ServerProfile, SignedInDevice, Vaccination, VaccinationStats, VitalAlert,
  VitalReading, WeightGain,
} from '@/data/records';
import {
  isNative, platform, serverUrl, sessionToken, setSessionToken,
} from '@/lib/native';

/*
 * Where the API is.
 *
 * In development the client is on :5173 and the API on :3000, so it needs the
 * whole address. In a build they are one origin — the Express process serves
 * this bundle — so a relative '/api' is correct and, unlike a baked-in host,
 * cannot be wrong for whatever domain it ends up deployed on.
 *
 * VITE_API_URL still overrides both, for a split deployment.
 *
 * Inside the app there is no "same origin" to fall back on — the page came
 * from the phone — so the address is whatever lib/native holds: the compiled
 * default, or what was typed on the sign-in screen. Asked each time rather
 * than read once, because it can change while the app is open.
 */
const WEB_BASE = import.meta.env.VITE_API_URL
  ?? (import.meta.env.DEV ? 'http://localhost:3000/api' : '/api');

const base = () => (isNative ? serverUrl() ?? '' : WEB_BASE);

/** Absolute URL for a document's bytes — the API host is a different origin in dev. */
export const fileUrl = (path: string) => `${base().replace(/\/api$/, '')}${path}`;

/** The app has no server address yet — the sign-in screen asks for one. */
export class NoServer extends Error {
  constructor() {
    super('Enter the address of your MaternalCare+ server to continue');
    this.name = 'NoServer';
  }
}

/**
 * One fetch for every call, so the two ways of being signed in live in one
 * place. A browser sends the session cookie (`credentials: 'include'` — the
 * API is a different origin from the dev server, and without it the browser
 * neither sends the cookie nor stores the one the login response sets).
 * The app sends its bearer token instead, names itself in X-Client, and
 * sends no cookie at all — the server would not read one from it anyway.
 */
export async function send(path: string, init: RequestInit = {}): Promise<Response> {
  if (isNative && !serverUrl()) throw new NoServer();
  const headers = new Headers(init.headers);
  if (isNative) {
    headers.set('X-Client', platform);
    const token = sessionToken();
    if (token) headers.set('Authorization', `Bearer ${token}`);
  }
  return fetch(`${base()}${path}`, {
    ...init,
    headers,
    credentials: isNative ? 'omit' : 'include',
  });
}

/** Raised on any 401 — the session is missing or has expired. */
export class NotSignedIn extends Error {
  constructor() {
    super('Please sign in');
    this.name = 'NotSignedIn';
  }
}

/**
 * The server could not be reached at all — it is not running, the machine is
 * offline, or something between here and there dropped the connection.
 *
 * fetch() rejects with a bare "TypeError: Failed to fetch" for every one of
 * those. That is the browser narrating its own internals, and it tells the
 * person reading it nothing they can act on. This carries a sentence that does.
 */
export class ServerUnreachable extends Error {
  constructor() {
    super('Cannot reach the MaternalCare+ server. Check that it is running, then try again.');
    this.name = 'ServerUnreachable';
  }
}

/** An error the server blamed on one named answer. */
export class FieldError extends Error {
  field?: string;

  constructor(message: string, field?: string) {
    super(message);
    this.name = 'FieldError';
    this.field = field;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await send(path, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers as Record<string, string> | undefined) },
    });
  } catch (err) {
    if (err instanceof NoServer) throw err;
    /*
     * fetch rejects only when the request never completed — nothing
     * listening, no network, connection dropped mid-flight. Every HTTP
     * status resolves, 500 included. So reaching here always means "could
     * not reach it", never "it answered and said no".
     */
    throw new ServerUnreachable();
  }

  /*
   * An expired or missing session is not an error the calling screen can do
   * anything about — it needs the sign-in page. Thrown as its own type so a
   * component can tell "you are signed out" from "that failed".
   */
  if (res.status === 401) {
    /*
     * In the app the token is what was refused. It is not coming back — the
     * session expired, or was ended from another device — so forget it here
     * too, rather than presenting a dead token on every launch until she
     * signs in again. Only for NO_SESSION: a wrong current password on the
     * change-password form is also a 401, and must not sign her out.
     */
    if (isNative && sessionToken()) {
      const code = await res.clone().json().then((b) => b?.code).catch(() => null);
      if (code === 'NO_SESSION') void setSessionToken(null);
    }
    throw new NotSignedIn();
  }
  if (!res.ok) {
    // the server explains itself ("That is not a dialable number"); showing
    // "PATCH /sos/emergency-number failed (400)" instead helps nobody
    let message = `${init?.method ?? 'GET'} ${path} failed (${res.status})`;
    let field: string | undefined;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
      // a validation failure names the answer that was wrong, so a form can
      // point at that input rather than blaming the whole page
      if (typeof body?.field === 'string') field = body.field;
    } catch {
      /* not JSON — keep the generic message */
    }
    throw new FieldError(message, field);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

interface Envelope<T> { data: T }

export type LifeStage = 'pregnant' | 'new-mother' | 'parent' | 'planning' | 'general';

/** Practice analytics, every figure counted from the clinician's caseload. */
export interface DoctorAnalytics {
  clinicWeek: { d: string; booked: number; seen: number }[];
  trimesters: { first: number; second: number; third: number; total: number };
  /** `of` is the denominator, so "100%" of one dose cannot pass for "100%" of forty */
  vaccineCoverage: { name: string; done: number; of: number }[];
}

/**
 * The community sidebar's cohort figures, counted server-side.
 *
 * `week` is null when she has no pregnancy on file, in which case the cohort
 * is the whole board rather than a guessed week. `answeredPct` is null when
 * there are no posts to take a percentage of.
 */
export interface CommunityWeekGroup {
  week: number | null;
  spread: number;
  mothers: number;
  clinicians: number;
  posts: number;
  answeredPosts: number;
  answeredPct: number | null;
}

export const api = {
  /* ----------------------------------------------------------- auth */

  /** Who is signed in, or null. Never 401s — the app asks this on load. */
  getSession: () =>
    request<Envelope<{ user: AuthUser | null }>>('/auth/session').then((r) => r.data.user),

  /*
   * In the app the server answers sign-in with the session token in the body
   * (it sets no cookie for the app — controllers/api/authApiController.js),
   * and it is kept from here. A browser response has no `token` and there
   * is nothing to keep; the cookie was already set on the way in.
   */
  login: (email: string, password: string) =>
    request<Envelope<{ user: AuthUser; token?: string }>>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }).then(async (r) => {
      if (r.data.token) await setSessionToken(r.data.token);
      return r.data.user;
    }),

  logout: () =>
    request<void>('/auth/logout', { method: 'POST' })
      // whatever the server said, the token is not to be presented again
      .finally(() => setSessionToken(null)),

  /** A password change starts a fresh session here — for the app, a fresh token. */
  changePassword: (currentPassword: string, newPassword: string) =>
    request<Envelope<{ changed: boolean; token?: string }>>('/auth/password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }).then(async (r) => {
      if (r.data.token) await setSessionToken(r.data.token);
      return { changed: r.data.changed };
    }),

  /* ------------------------------------------------- browser push */

  /** The VAPID public key a device subscribes with. */
  getPushKey: () =>
    request<Envelope<{ publicKey: string }>>('/push/key').then((r) => r.data),

  /** Whether this device's endpoint is on record, and how many devices are. */
  getPushStatus: (endpoint?: string) =>
    request<Envelope<{ thisDevice: boolean; devices: number }>>(
      `/push/status${endpoint ? `?endpoint=${encodeURIComponent(endpoint)}` : ''}`,
    ).then((r) => r.data),

  savePushSubscription: (subscription: PushSubscriptionJSON) =>
    request<Envelope<{ id: string; devices: number }>>('/push/subscriptions', {
      method: 'POST',
      body: JSON.stringify({ subscription }),
    }).then((r) => r.data),

  removePushSubscription: (endpoint: string) =>
    request<Envelope<{ devices: number }>>('/push/subscriptions', {
      method: 'DELETE',
      body: JSON.stringify({ endpoint }),
    }).then((r) => r.data),

  /** A notification now, to every device, so she can see it arrive. */
  sendTestPush: () =>
    request<Envelope<{ devices: number; delivered: number }>>('/push/test', { method: 'POST' })
      .then((r) => r.data),

  /**
   * Every device this account is signed in on, this one marked — with the
   * limits that apply to this account ("12 hours" idle for a clinician,
   * "7 days" for a mother), so the screen can state them rather than guess.
   */
  getSignedInDevices: () =>
    request<Envelope<SignedInDevice[]> & { meta: { idle: string; absoluteDays: number } }>('/auth/sessions')
      .then((r) => ({ devices: r.data, idle: r.meta.idle, absoluteDays: r.meta.absoluteDays })),

  /** End one other session — a phone she no longer has, say. */
  signOutDevice: (id: string) =>
    request<void>(`/auth/sessions/${encodeURIComponent(id)}`, { method: 'DELETE' }),

  /** End every session but this one. */
  signOutEverywhereElse: () =>
    request<Envelope<{ ended: number }>>('/auth/sessions', { method: 'DELETE' }).then((r) => r.data.ended),

  /** Names and emails for the sign-in screen. Never the passwords. */
  getDemoAccounts: () =>
    request<Envelope<{ name: string; email: string; stage: string; conditions: string }[]>>(
      '/auth/demo-accounts',
    ).then((r) => r.data),

  /* the signed-in user */
  getMe: () => request<Envelope<{ user: { name: string; stage: LifeStage } }>>('/me').then((r) => r.data.user),

  /**
   * Her pregnancy, derived server-side from her LMP. The same endpoint has
   * always carried this; the client used to throw it away, which is why the
   * dashboard was quoting a week number written into the markup by hand.
   */
  getPregnancy: () =>
    request<Envelope<{ pregnancy: Pregnancy | null }>>('/me').then((r) => r.data.pregnancy),

  /** Typical fetal length and weight by week — reference, not her measurement. */
  getGrowthReference: () =>
    request<Envelope<{ growthReference: FetalSizePoint[] }>>('/me')
      .then((r) => r.data.growthReference ?? []),

  /**
   * Her reading language, stored on the account so it follows her to another
   * device — and so the server knows which language to compose her care plan
   * and risk assessment in.
   */
  getLanguage: () =>
    request<Envelope<{ language: 'en' | 'bn' }>>('/me/language').then((r) => r.data.language),

  setLanguage: (language: 'en' | 'bn') =>
    request<Envelope<{ language: 'en' | 'bn' }>>('/me/language', {
      method: 'PATCH',
      body: JSON.stringify({ language }),
    }).then((r) => r.data.language),

  /** Whether this server can transcribe audio itself. */
  voiceCapability: () =>
    request<Envelope<{ available: boolean }>>('/voice/capability').then((r) => r.data.available),

  /**
   * Send a recording to be turned into words. The audio is not stored — the
   * server holds it for the length of the request and drops it.
   */
  transcribeVoice: (audioDataUrl: string) =>
    request<Envelope<{ text: string; model: string }>>('/voice/transcribe', {
      method: 'POST',
      body: JSON.stringify({ audio: audioDataUrl }),
    }).then((r) => r.data),

  /**
   * Everything the onboarding questionnaire collected. Every field is
   * optional, so a partly-finished run saves what it has.
   */
  saveOnboarding: (answers: {
    dob?: string; bloodGroup?: string; age?: number;
    heightCm?: number; weightKg?: number; conditions?: string[]; allergies?: string;
    lmp?: string; childName?: string; childDob?: string; childGender?: string;
    childFeeding?: string; childDelivery?: string; childBirthWeightKg?: number;
    /** a measurement taken today — the second point that makes a growth curve */
    childWeightKg?: number; childHeightCm?: number;
    /** the stage-specific answers, keyed by question id */
    intake?: Record<string, string | string[]>;
    /** "any symptoms lately?" — become entries in the symptom logger */
    symptoms?: string[];
  }) =>
    request<Envelope<{ saved: string[] }>>('/onboarding', {
      method: 'PUT',
      body: JSON.stringify(answers),
    }).then((r) => r.data),

  /** Her current answers, in the questionnaire's field ids, to pre-fill it. */
  getOnboarding: () =>
    request<Envelope<Record<string, string | number | string[] | undefined>>>('/onboarding')
      .then((r) => r.data),

  setStage: (stage: LifeStage) =>
    request<Envelope<{ stage: LifeStage }>>('/me', {
      method: 'PATCH',
      body: JSON.stringify({ stage }),
    }).then((r) => r.data),

  registerMother: (body: {
    name: string; email: string; phone?: string; password: string; stage: LifeStage;
    /** the version of the terms that was on the screen when she agreed */
    acceptedTerms: string;
  }) =>
    request<Envelope<{ user: AuthUser; token?: string }>>('/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }).then(async (r) => {
      // signed in on the spot, so the app keeps its token exactly as login does
      if (r.data.token) await setSessionToken(r.data.token);
      return r.data.user;
    }),

  /* ------------------------------------------------- the account itself */

  /**
   * Everything we hold, as a JSON file — the bytes and the filename the
   * server chose. Goes through fetch rather than a plain link because the
   * export needs the session and a filename from the server; handing the
   * file over is the caller's job (lib/files), since that differs between a
   * browser and the app.
   */
  exportMyData: async (): Promise<{ blob: Blob; filename: string }> => {
    const res = await send('/account/export');
    if (!res.ok) throw new Error('Your data could not be prepared for download');
    const filename = (res.headers.get('content-disposition') || '')
      .match(/filename="([^"]+)"/)?.[1] ?? 'maternalcare-data.json';
    return { blob: await res.blob(), filename };
  },

  /**
   * Close the account. Requires the password, and cannot be undone.
   *
   * Returns when the records are destroyed, so the confirmation can say the
   * date rather than repeating the promise.
   */
  deleteMyAccount: (body: { password: string; reason: string; feedback?: string }) =>
    request<Envelope<{ deletedAt: string; purgeAfter: string; graceDays: number }>>(
      '/account',
      { method: 'DELETE', body: JSON.stringify(body) },
    ).then((r) => r.data),

  /* symptoms */
  getSymptoms: () => request<Envelope<Symptom[]>>('/symptoms').then((r) => r.data),

  saveSymptoms: (symptoms: Symptom[]) =>
    request<Envelope<Symptom[]>>('/symptoms', {
      method: 'PUT',
      body: JSON.stringify({ symptoms }),
    }).then((r) => r.data),

  /** Ends the entry so the next visit asks "still there?" for each symptom. */
  endSymptomEntry: () =>
    request<Envelope<Symptom[]>>('/symptoms/end-entry', { method: 'POST' }).then((r) => r.data),

  /* the child's symptom journal — a separate list, not mixed into hers */
  getChildSymptoms: () =>
    request<Envelope<Symptom[]>>('/child/symptoms').then((r) => r.data),

  saveChildSymptoms: (symptoms: Symptom[]) =>
    request<Envelope<Symptom[]>>('/child/symptoms', {
      method: 'PUT',
      body: JSON.stringify({ symptoms }),
    }).then((r) => r.data),

  endChildSymptomEntry: () =>
    request<Envelope<Symptom[]>>('/child/symptoms/end-entry', { method: 'POST' }).then((r) => r.data),

  /**
   * The community sidebar's cohort figures.
   *
   * `answeredPct` is null when the board has no posts yet — there is no
   * percentage of nothing, and showing 0% would read as a failure rather than
   * as an empty board.
   */
  getCommunityWeekGroup: () =>
    request<Envelope<CommunityWeekGroup>>('/community/week-group').then((r) => r.data),

  /**
   * The clinician's practice analytics.
   *
   * There is no births or outcomes table in this application, so no outcome
   * figures are returned — the chart that used to show them was removed
   * rather than estimated.
   */
  getDoctorAnalytics: () =>
    request<Envelope<DoctorAnalytics>>('/analytics').then((r) => r.data),

  /* clinician: the caseload, each patient a real account */
  getPatients: () => request<Envelope<Patient[]>>('/patients').then((r) => r.data),

  /** Schedule care onto a specific patient's account. */
  assignToPatient: (patientId: string, item: Omit<Reminder, 'id'> & { assignedBy: string }) =>
    request<Envelope<Reminder>>(`/patients/${patientId}/reminders`, {
      method: 'POST',
      body: JSON.stringify(item),
    }).then((r) => r.data),

  /* reminders */
  getReminders: () => request<Envelope<Reminder[]>>('/reminders').then((r) => r.data),

  createReminder: (reminder: Omit<Reminder, 'id'> & { assignedBy?: string }) =>
    request<Envelope<Reminder>>('/reminders', {
      method: 'POST',
      body: JSON.stringify(reminder),
    }).then((r) => r.data),

  deleteReminder: (id: string) =>
    request<void>(`/reminders/${id}`, { method: 'DELETE' }),

  /**
   * Her personalised nutrition, movement and lifestyle plan.
   *
   * Built server-side from her stage, her risk assessment, her conditions and
   * her own log, so the client renders it rather than deciding any of it.
   */
  getGuidance: () => request<Envelope<CarePlan>>('/guidance').then((r) => r.data),

  /** The same plan, for a clinician reading a patient's record. */
  getPatientGuidance: (patientId: string) =>
    request<Envelope<CarePlan>>(`/patients/${patientId}/guidance`).then((r) => r.data),

  /* -------------------------------------------- risk assessment (F13) */

  /**
   * Both readings of her risk: the transparent rule engine, and the
   * scikit-learn classifier behind the FastAPI service. `model` is null when
   * that service is not running — the rules always answer.
   */
  getRisk: () =>
    request<Envelope<RiskView> & { meta: { service: { up: boolean; trainedOnRows: number | null } } }>(
      '/risk',
    ).then((r) => ({ ...r.data, service: r.meta.service })),

  getPatientRisk: (patientId: string) =>
    request<Envelope<RiskView>>(`/patients/${patientId}/risk`).then((r) => r.data),

  /** How the model was trained and how well it scores. */
  getRiskModelCard: () =>
    request<Envelope<Record<string, unknown>>>('/risk/model').then((r) => r.data),

  /** "What if my numbers were these" — both engines, on hypothetical readings. */
  simulateRisk: (body: {
    age?: number; systolic: number; diastolic: number;
    sugar: number; tempC: number; heartBpm?: number;
  }) =>
    request<Envelope<RiskView>>('/risk/simulate', {
      method: 'POST',
      body: JSON.stringify(body),
    }).then((r) => r.data),

  /* ------------------------------------------------ finding a doctor */

  getDoctors: () => request<Envelope<RankedDoctor[]>>('/doctors').then((r) => r.data),

  /** Clinicians ranked for this mother's stage; `bookable` counts who can take her. */
  getRecommendedDoctors: (stage?: string) =>
    request<Envelope<RankedDoctor[]> & { meta: { stage: string; bookable: number } }>(
      `/doctors/recommended${stage ? `?stage=${stage}` : ''}`,
    ).then((r) => ({ doctors: r.data, bookable: r.meta.bookable })),

  /**
   * A clinician signing themselves up. Resolves to the row a mother will see
   * them as; rejects with a `field` naming whichever answer came back wrong,
   * so the form can point at it instead of saying "check your details".
   */
  registerDoctor: (body: {
    name: string; specialty: string; qualification: string; years: number;
    email: string; phone: string; licenseNo: string; password: string;
    acceptedTerms: string;
  }) =>
    request<Envelope<RankedDoctor>>('/doctors/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }).then((r) => r.data),

  getMyDoctor: () => request<Envelope<Doctor>>('/me/doctor').then((r) => r.data),

  /** The clinician correcting her own entry; whichever fields are sent. */
  updateMyDoctor: (body: {
    name?: string; specialty?: string; qualification?: string; years?: number; phone?: string;
    capacity?: number; available?: boolean;
  }) =>
    request<Envelope<Doctor>>('/me/doctor', { method: 'PATCH', body: JSON.stringify(body) })
      .then((r) => r.data),

  /** The clinicians she has appointments with. Empty until she books one. */
  getMyCareTeam: () =>
    request<Envelope<{ id: string; name: string; role: string; hospital?: string }[]>>(
      '/me/care-team',
    ).then((r) => r.data),

  getSlots: (doctorId: string, date: string) =>
    request<Envelope<{ date: string; times: string[] }>>(`/doctors/${doctorId}/slots?date=${date}`)
      .then((r) => r.data),

  /* --------------------------- rescheduling, cancelling, ending (F11) */

  /**
   * Move an appointment. Rejects with SLOT_TAKEN when somebody else took the
   * time while she was choosing, which the dialog treats as "pick again"
   * rather than as a failure.
   */
  rescheduleAppointment: (
    id: string,
    body: {
      date: string; time: string; reason?: string;
      side?: 'mother' | 'doctor'; doctorId?: string;
    },
  ) =>
    request<Envelope<Appointment>>(`/appointments/${id}/reschedule`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }).then((r) => r.data),

  /** Everywhere an appointment has been moved from. */
  getAppointmentChanges: (id: string) =>
    request<Envelope<AppointmentChange[]>>(`/appointments/${id}/changes`).then((r) => r.data),

  /** Why one side may cancel — the same list the model validates against. */
  getCancelReasons: (side: 'mother' | 'doctor' = 'mother') =>
    request<Envelope<CareReason[]>>(`/cancel-reasons?side=${side}`).then((r) => r.data),

  /** Cancel a visit, with a reason. */
  cancelAppointment: (
    id: string,
    body: { reason: string; note?: string; side?: 'mother' | 'doctor'; doctorId?: string },
  ) =>
    request<Envelope<Appointment>>(`/appointments/${id}`, {
      method: 'DELETE',
      body: JSON.stringify(body),
    }).then((r) => r.data),

  /* ------------------------------ ending the care relationship */

  /** The reasons one side may give, and whether a written note is required. */
  getEndingReasons: (side: 'mother' | 'doctor' = 'mother') =>
    request<Envelope<{ side: string; noteRequired: boolean; options: CareReason[] }>>(
      `/care-endings/reasons?side=${side}`,
    ).then((r) => r.data),

  /** She ends it with one of her clinicians. */
  endCare: (doctorId: string, body: { reason: string; note?: string }) =>
    request<Envelope<CareEnding>>(`/care-endings/${doctorId}`, {
      method: 'POST',
      body: JSON.stringify(body),
    }).then((r) => r.data),

  /** Her own record of endings, both directions. */
  getMyCareEndings: () =>
    request<Envelope<CareEnding[]>>('/care-endings').then((r) => r.data),

  /** A clinician ends it with a patient. A written note is required here. */
  endCareWithPatient: (
    doctorId: string,
    patientId: string,
    body: { reason: string; note: string },
  ) =>
    request<Envelope<CareEnding>>(`/doctors/${doctorId}/care-endings/${patientId}`, {
      method: 'POST',
      body: JSON.stringify(body),
    }).then((r) => r.data),

  /** Why patients have left this clinician, with the reasons counted. */
  getDoctorCareEndings: (doctorId: string) =>
    request<Envelope<CareEndingSummary>>(`/doctors/${doctorId}/care-endings`).then((r) => r.data),

  getAppointments: () =>
    request<Envelope<Appointment[]>>('/appointments').then((r) => r.data),

  /**
   * Ask a doctor for a slot. Throws {@link RequestRefused} when the server can
   * explain the refusal, so the UI can offer the alternatives it sent back
   * instead of showing a dead end.
   */
  async requestAppointment(body: { doctorId: string; date: string; time: string; reason?: string }) {
    const res = await send('/appointments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (res.status === 409) {
      throw new RequestRefused(json.error ?? 'That request could not be sent', json.code ?? 'NOT_BOOKABLE',
        (json.alternatives ?? []) as SlotOffer[]);
    }
    if (!res.ok) throw new Error(json.error ?? `Request failed (${res.status})`);
    return json.data as Appointment;
  },

  /**
   * Buy a slot outright. Refuses the same way {@link requestAppointment} does,
   * so the booking page can offer the alternatives rather than a dead end.
   *
   * No card details are sent — `method` is the rail the mother chose, and the
   * fee is decided by the server from the clinician.
   */
  async payAndBook(body: {
    doctorId: string; date: string; time: string; reason?: string;
    method: PayMethod; plan?: Plan;
  }) {
    const res = await send('/appointments/paid', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const json = await res.json().catch(() => ({}));
    if (res.status === 409) {
      throw new RequestRefused(json.error ?? 'That slot could not be booked', json.code ?? 'NOT_BOOKABLE',
        (json.alternatives ?? []) as SlotOffer[]);
    }
    if (!res.ok) throw new Error(json.error ?? `Booking failed (${res.status})`);
    return json.data as Appointment;
  },

  /** Visits starting within the hour — drives the "ready your link" nudge. */
  getDoctorUpcoming: (doctorId: string, within = 60) =>
    request<Envelope<UpcomingVisit[]>>(`/doctors/${doctorId}/upcoming?within=${within}`)
      .then((r) => r.data),

  /* clinician side of the same conversation */
  getDoctorRequests: (doctorId: string) =>
    request<Envelope<Appointment[]>>(`/doctors/${doctorId}/appointments`).then((r) => r.data),

  respondToRequest: (id: string, status: 'accepted' | 'declined', note?: string) =>
    request<Envelope<Appointment>>(`/appointments/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, note }),
    }).then((r) => r.data),

  /* ------------------------------------------------------- profile */

  getProfile: () => request<Envelope<ServerProfile>>('/profile').then((r) => r.data),

  /** Send only what changed; the server leaves the rest alone. */
  updateProfile: (patch: Partial<{
    name: string; bio: string; avatar: string | null;
    bloodGroup: string; age: number; stage: string;
  }>) => request<Envelope<ServerProfile>>('/profile', {
    method: 'PATCH',
    body: JSON.stringify(patch),
  }).then((r) => r.data),

  /** Weight gain against the range recommended for her starting BMI. */
  getWeightGain: () => request<Envelope<WeightGain | null>>('/weight-gain').then((r) => r.data),

  /**
   * Addresses another device on this network can reach the API on. Only the
   * server knows these — the browser sees whichever origin it happened to use.
   */
  getNetwork: () =>
    request<Envelope<{ port: number; origins: string[]; interfaces: { name: string; address: string }[] }>>(
      '/network',
    ).then((r) => r.data),

  /* --------------------------------------------------- vitals */

  /** Every stored reading, oldest first, plus the latest and any alerts. */
  getVitals: () =>
    request<Envelope<VitalReading[]> & { meta: { latest: VitalReading | null; alerts: VitalAlert[] } }>(
      '/vitals',
    ).then((r) => ({ readings: r.data, latest: r.meta.latest, alerts: r.meta.alerts })),

  /** Log a reading. Send only the measurements actually taken. */
  addVital: (reading: {
    date?: string; systolic?: number; diastolic?: number;
    sugar?: number; weightKg?: number; tempC?: number; fetalBpm?: number;
  }) =>
    request<Envelope<VitalReading>>('/vitals', {
      method: 'POST',
      body: JSON.stringify(reading),
    }).then((r) => r.data),

  /* ------------------------------ mood, kicks, hydration by day */

  getDailyLog: () => request<Envelope<DailyLogState>>('/daily-log').then((r) => r.data),

  saveDailyLog: (patch: {
    mood?: string; kicks?: number; waterLitres?: number; sleepHours?: number;
  }) =>
    request<Envelope<DailyLogState>>('/daily-log', {
      method: 'PUT',
      body: JSON.stringify(patch),
    }).then((r) => r.data),

  /* ----------------------------------------------------- community */

  getPosts: (opts: { limit?: number; offset?: number; topic?: string } = {}) => {
    const q = new URLSearchParams();
    if (opts.limit) q.set('limit', String(opts.limit));
    if (opts.offset) q.set('offset', String(opts.offset));
    if (opts.topic && opts.topic !== 'All') q.set('topic', opts.topic);
    return request<Envelope<ServerPost[]> & {
      meta: { total: number; reasons: ReportReason[] }
    }>(
      `/community/posts?${q}`,
    ).then((r) => ({ posts: r.data, total: r.meta.total, reasons: r.meta.reasons }));
  },

  createPost: (body: { title: string; body?: string; topic?: string; image?: string }) =>
    request<Envelope<ServerPost>>('/community/posts', {
      method: 'POST',
      body: JSON.stringify(body),
    }).then((r) => r.data),

  commentOnPost: (postId: string, body: string) =>
    request<Envelope<ServerPost>>(`/community/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ body }),
    }).then((r) => r.data),

  heartPost: (postId: string, delta: 1 | -1) =>
    request<Envelope<ServerPost>>(`/community/posts/${postId}/heart`, {
      method: 'POST',
      body: JSON.stringify({ delta }),
    }).then((r) => r.data),

  /**
   * Report a post or a comment. Rejects with a 409-backed FieldError when this
   * member has already reported the same thing, which the board treats as a
   * state rather than a failure.
   */
  reportContent: (
    target: 'posts' | 'comments',
    id: string,
    body: { reason: string; detail?: string },
  ) =>
    request<Envelope<{ id: string; state: string; reason: string }>>(
      `/community/${target}/${id}/report`,
      { method: 'POST', body: JSON.stringify(body) },
    ).then((r) => r.data),

  /* ------------------------------------------------------ moderation */

  /** The clinician's queue, grouped by the item reported. */
  getReports: (state: 'open' | 'upheld' | 'dismissed' | 'all' = 'open') =>
    request<Envelope<ReportGroup[]> & { meta: { open: number; urgent: number } }>(
      `/moderation/reports?state=${state}`,
    ).then((r) => ({ groups: r.data, open: r.meta.open, urgent: r.meta.urgent })),

  getReportCount: () =>
    request<Envelope<{ open: number }>>('/moderation/count').then((r) => r.data.open),

  /** Uphold or dismiss every open report against one item. */
  resolveReport: (
    target: 'post' | 'comment',
    id: string,
    body: { action: 'uphold' | 'dismiss'; note?: string; doctorId?: string },
  ) =>
    request<Envelope<{ target: string; id: string; action: string; reportsClosed: number }>>(
      `/moderation/${target}s/${id}/resolve`,
      { method: 'POST', body: JSON.stringify(body) },
    ).then((r) => r.data),

  /* --------------------------------------------------------- child */

  getChild: () => request<Envelope<ChildState | null>>('/child').then((r) => r.data),

  /**
   * The child's own daily check-in — feeds, wet nappies, sleep, temperature.
   *
   * Separate from the mother's log because they are two different people, and
   * a parent of a young child is asked both.
   */
  getChildLog: () => request<Envelope<ChildLogState>>('/child/log').then((r) => r.data),

  /** Writes one field at a time; the model keeps the rest of the day intact. */
  saveChildLog: (patch: Record<string, number | string>) =>
    request<Envelope<{ today: ChildLogState['today']; flags: ChildLogState['flags'] }>>(
      '/child/log',
      { method: 'PATCH', body: JSON.stringify(patch) },
    ).then((r) => r.data),

  toggleMilestone: (id: string) =>
    request<Envelope<Milestone[]>>(`/child/milestones/${id}`, { method: 'PATCH' })
      .then((r) => r.data),

  getVaccinations: () =>
    request<Envelope<Vaccination[]> & { meta: VaccinationStats }>('/vaccinations')
      .then((r) => ({ rows: r.data, stats: r.meta })),

  /** File a card as evidence for one dose. Returns the refreshed list. */
  uploadVaccinationCard: (id: string, body: {
    dataUrl: string; originalName?: string; title?: string; takenOn?: string;
  }) =>
    request<Envelope<Vaccination[]> & { meta: VaccinationStats }>(`/vaccinations/${id}/card`, {
      method: 'POST',
      body: JSON.stringify(body),
    }).then((r) => ({ rows: r.data, stats: r.meta })),

  markVaccinationDone: (id: string) =>
    request<Envelope<Vaccination[]> & { meta: VaccinationStats }>(`/vaccinations/${id}/done`, {
      method: 'PATCH',
    }).then((r) => ({ rows: r.data, stats: r.meta })),

  /** Take back a dose ticked by mistake. Deletes the completion, not the dose. */
  undoVaccinationDone: (id: string) =>
    request<Envelope<Vaccination[]> & { meta: VaccinationStats }>(`/vaccinations/${id}/done`, {
      method: 'DELETE',
    }).then((r) => ({ rows: r.data, stats: r.meta })),

  /* --------------------------------------------------- emergency SOS */

  getSosState: () =>
    request<Envelope<{
      active: SosAlert | null; contacts: Guardian[]; history: SosAlert[]; emergencyNumber: string;
    }>>('/sos').then((r) => r.data),

  setEmergencyNumber: (number: string) =>
    request<Envelope<{ emergencyNumber: string }>>('/sos/emergency-number', {
      method: 'PATCH',
      body: JSON.stringify({ number }),
    }).then((r) => r.data.emergencyNumber),

  raiseSos: (body: { lat?: number; lng?: number; accuracy?: number; locationNote?: string }) =>
    request<Envelope<SosAlert>>('/sos', {
      method: 'POST',
      body: JSON.stringify(body),
    }).then((r) => r.data),

  closeSos: (id: string, status: 'safe' | 'cancelled') =>
    request<Envelope<SosAlert>>(`/sos/${id}/close`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    }).then((r) => r.data),

  getGuardians: () => request<Envelope<Guardian[]>>('/guardians').then((r) => r.data),

  addGuardian: (body: { name: string; relation?: string; phone?: string }) =>
    request<Envelope<Guardian>>('/guardians', {
      method: 'POST',
      body: JSON.stringify(body),
    }).then((r) => r.data),

  removeGuardian: (id: string) => request<void>(`/guardians/${id}`, { method: 'DELETE' }),

  /**
   * The health report, as PDF bytes.
   *
   * Fetched rather than linked so the button can show that something is
   * happening — the server draws charts and embeds every filed document, which
   * takes long enough that a silent link feels broken.
   *
   * `patientId` switches it from "my record" to "this patient's", which is the
   * only difference between the mother's copy and the clinician's.
   */
  async getReport(patientId?: string): Promise<{ blob: Blob; filename: string }> {
    const path = patientId ? `/patients/${patientId}/report.pdf` : '/report.pdf';
    const res = await send(path);
    if (!res.ok) {
      let message = 'Could not build the report';
      try { message = (await res.json())?.error ?? message; } catch { /* not JSON */ }
      throw new Error(message);
    }
    const disposition = res.headers.get('Content-Disposition') ?? '';
    const match = /filename="([^"]+)"/.exec(disposition);
    return { blob: await res.blob(), filename: match?.[1] ?? 'maternalcare-report.pdf' };
  },

  /** Open alerts across the clinician's caseload. */
  getDoctorSos: (doctorId: string) =>
    request<Envelope<SosAlert[]>>(`/doctors/${doctorId}/sos`).then((r) => r.data),

  /* --------------------------------------- prescriptions & reports */

  getDocuments: (kind?: DocumentKind) =>
    request<Envelope<CareDocument[]> & { meta: Record<DocumentKind, number> }>(
      `/documents${kind ? `?kind=${kind}` : ''}`,
    ).then((r) => ({ documents: r.data, counts: r.meta })),

  /** `dataUrl` is the base64 payload produced by FileUpload. */
  uploadDocument: (body: {
    kind: DocumentKind; title: string; note?: string;
    dataUrl: string; originalName?: string; takenOn?: string;
  }) => request<Envelope<CareDocument>>('/documents', {
    method: 'POST',
    body: JSON.stringify(body),
  }).then((r) => r.data),

  deleteDocument: (id: string) => request<void>(`/documents/${id}`, { method: 'DELETE' }),

  /** A clinician reading a patient's filed prescriptions and reports. */
  getPatientDocuments: (patientId: string) =>
    request<Envelope<CareDocument[]> & { meta: Record<DocumentKind, number> }>(
      `/patients/${patientId}/documents`,
    ).then((r) => ({ documents: r.data, counts: r.meta })),

  /**
   * A clinician filing a scan or result onto a patient's record. `uploadedBy`
   * is what tells the two of them apart on the timeline.
   */
  uploadPatientDocument: (patientId: string, body: {
    kind: DocumentKind; title: string; note?: string;
    dataUrl: string; originalName?: string; takenOn?: string; uploadedBy: string;
  }) => request<Envelope<CareDocument>>(`/patients/${patientId}/documents`, {
    method: 'POST',
    body: JSON.stringify(body),
  }).then((r) => r.data),

  /* ------------------------------------------------------- messaging */

  /** Doctors this mother is entitled to write to. */
  getCareTeam: () => request<Envelope<CareTeamMember[]>>('/care-team').then((r) => r.data),

  getThreads: () =>
    request<Envelope<MotherThread[]> & { meta: { unread: number } }>('/messages')
      .then((r) => ({ threads: r.data, unread: r.meta.unread })),

  /** Fetching a thread also marks the other side's lines as read. */
  getThread: (doctorId: string) =>
    request<Envelope<Message[]>>(`/messages/${doctorId}`).then((r) => r.data),

  /**
   * Send a line. `kind` decides what it is; an image rides as a data URL.
   *
   * The link rule is refused server-side with 422 and its own code, so the
   * chat can show a dialog explaining who arranges calls rather than a bare
   * error string.
   */
  async sendMessage(
    doctorId: string,
    body: string,
    opts: { kind?: MessageKind; image?: string } = {},
  ) {
    const res = await send('/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ doctorId, body, ...opts }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      const err = new Error(json.error ?? `Send failed (${res.status})`) as Error & {
        code?: string; hint?: string;
      };
      err.code = json.code;
      err.hint = json.hint;
      throw err;
    }
    return json.data as Message;
  },

  /* clinician side of the same conversation */
  getDoctorThreads: (doctorId: string) =>
    request<Envelope<DoctorThread[]> & { meta: { unread: number } }>(`/doctors/${doctorId}/threads`)
      .then((r) => ({ threads: r.data, unread: r.meta.unread })),

  getDoctorThread: (doctorId: string, patientId: string) =>
    request<Envelope<Message[]>>(`/doctors/${doctorId}/threads/${patientId}`).then((r) => r.data),

  sendAsDoctor: (doctorId: string, patientId: string, body: string) =>
    request<Envelope<Message>>(`/doctors/${doctorId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ patientId, body }),
    }).then((r) => r.data),
};

export type ApiStatus = 'loading' | 'online' | 'offline';
