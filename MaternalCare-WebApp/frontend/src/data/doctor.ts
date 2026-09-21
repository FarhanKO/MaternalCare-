export type RiskLevel = 'low' | 'moderate' | 'high';

export interface Patient {
  id: string;
  name: string;
  age: number;
  week: number;
  risk: RiskLevel;
  bloodGroup: string;
  lastVisit: string;
  nextVisit: string;
  /** most recent blood pressure reading */
  bp: { sys: number; dia: number };
  /** flags raised by the mother's own logging */
  flags: string[];
  conditions: string[];
  /** as she told the questionnaire; null when none recorded */
  allergies: string | null;
  /** her questionnaire answers for her stage — obstetric history, mood, the child */
  history: { id: string; label: string; value: string; tone: 'neutral' | 'info' | 'warn' }[];
  /** wellbeing score carried over from her dashboard */
  score: number;
  /** systolic trend across recent visits — drawn as a sparkline */
  trend: number[];
}

export const RISK_META: Record<RiskLevel, { label: string; color: string; ring: string }> = {
  low: { label: 'Low', color: '#2fbf9b', ring: 'bg-emerald-500/12 text-emerald-700 ring-emerald-500/25' },
  moderate: { label: 'Moderate', color: '#f6b93b', ring: 'bg-amber-500/12 text-amber-700 ring-amber-500/25' },
  high: { label: 'High', color: '#e5484d', ring: 'bg-rose-500/12 text-rose-700 ring-rose-500/25' },
};

/*
 * The clinician screens used to import three fixtures from here: PATIENTS,
 * TODAY_SLOTS and ALERTS — six invented women with gestational weeks, risk
 * levels and blood pressures, a day of appointments, and four open alerts.
 * They were rendered to every clinician whose real data was empty, with
 * nothing on screen saying they were placeholders.
 *
 * The types remain, because the real data is shaped the same. The fixtures
 * are gone; Doctor.tsx derives all three from the caseload and the
 * appointments table.
 */
export interface Slot {
  id: string;
  time: string;
  patient: string;
  reason: string;
  kind: 'scan' | 'checkup' | 'result' | 'urgent';
  done?: boolean;
}

export const KIND_META: Record<Slot['kind'], { label: string; color: string }> = {
  scan: { label: 'Scan', color: '#3f66f0' },
  checkup: { label: 'Check-up', color: '#22b8c4' },
  result: { label: 'Results', color: '#8b7bf3' },
  urgent: { label: 'Urgent', color: '#e5484d' },
};

export interface Alert {
  id: string;
  patient: string;
  title: string;
  detail: string;
  severity: 'critical' | 'warning';
  ago: string;
}

/*
 * Four practice-analytics fixtures lived here and have been deleted:
 *
 *   CLINIC_WEEK      61 appointments seen against 69 booked across Mon–Sat.
 *                    The database held fourteen appointments in total.
 *   TRIMESTER_SPLIT  9 / 17 / 12 — thirty-eight pregnancies, against six.
 *   SCREENING        completion rates of 82%, 94%, 68%, 100% and 76% for an
 *                    anomaly scan, a glucose screening and three others the
 *                    application has never recorded anywhere.
 *   OUTCOMES         a hundred and twenty term and fourteen preterm births
 *                    over six months. There is no births table. There never
 *                    was one.
 *
 * The first three are now computed per clinician in models/analyticsModel.js
 * and served from GET /api/analytics. The fourth cannot be computed from
 * anything this application stores, so the chart was removed rather than
 * estimated — invented birth outcomes on a clinician's screen are worse than
 * an empty panel, not better.
 */
