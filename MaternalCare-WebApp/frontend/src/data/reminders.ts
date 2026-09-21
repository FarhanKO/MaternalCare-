export type ReminderKind = 'medicine' | 'doctor' | 'test' | 'exercise' | 'vaccination';

export interface Reminder {
  id: string;
  kind: ReminderKind;
  title: string;
  note?: string;
  /** ISO timestamp of when it is due */
  at: string;
  /** how often it comes round again, when it does */
  repeat?: 'daily' | 'weekly' | 'once';
  /** set when a clinician put this on her schedule rather than she did */
  assignedBy?: string;
}

export const KIND_LABEL: Record<ReminderKind, string> = {
  medicine: 'Medicine',
  doctor: 'Doctor appointment',
  test: 'Test',
  exercise: 'Exercise',
  vaccination: 'Vaccination',
};

export const KIND_SHORT: Record<ReminderKind, string> = {
  medicine: 'Medicine',
  doctor: 'Doctor',
  test: 'Test',
  exercise: 'Exercise',
  vaccination: 'Vaccine',
};

export const KIND_COLOR: Record<ReminderKind, string> = {
  medicine: '#8b7bf3',
  doctor: '#3f66f0',
  test: '#22b8c4',
  exercise: '#2fbf9b',
  vaccination: '#f6b93b',
};

/** The order the groups read in — soonest-acting first. */
export const KIND_ORDER: ReminderKind[] = ['doctor', 'test', 'medicine', 'exercise', 'vaccination'];

/**
 * What the quick-add offers for each kind.
 *
 * These are suggestions she picks from, not entries written on her behalf —
 * nothing here reaches the database until she taps one.
 */
export const KIND_SUGGESTIONS: Record<ReminderKind, string[]> = {
  medicine: ['Prenatal vitamin', 'Iron tablet', 'Folic acid', 'Calcium'],
  doctor: ['Doctor check-up', 'Growth scan', 'Consultant review', 'Anti-D injection'],
  test: ['Glucose screening', 'Blood test', 'Urine sample', 'Ultrasound'],
  exercise: ['Prenatal yoga', 'Walk 20 minutes', 'Pelvic floor exercises', 'Swimming'],
  vaccination: ['Whooping cough (Tdap)', 'Flu vaccine', 'Anti-D injection', 'COVID booster'],
};

/*
 * seedReminders() used to live here.
 *
 * It returned eight reminders — a prenatal vitamin, an iron tablet, calcium,
 * a growth ultrasound noted "Dr. Lena Ortiz · Room 204", a glucose screening,
 * prenatal yoga, a walk and a whooping cough dose — and the dashboard hook did
 * two things with them. It showed them while the real list loaded, and if the
 * real list came back empty it WROTE all eight to her account through the API.
 *
 * Every one of them describes a pregnancy. Twenty-four such rows were found
 * on three accounts that had none: a woman planning a pregnancy had been given
 * a whooping cough date, which is administered between weeks 27 and 36 of one,
 * and the mother of a two-and-a-half-year-old had a growth ultrasound booked
 * in a room number that does not exist.
 *
 * A reminder is a promise that something is scheduled. Her schedule starts
 * empty and fills with what she or her clinician actually put in it.
 */

const pad2 = (n: number) => String(n).padStart(2, '0');

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear()
  && a.getMonth() === b.getMonth()
  && a.getDate() === b.getDate();

export function formatTime(d: Date) {
  const h = d.getHours();
  return `${h % 12 === 0 ? 12 : h % 12}:${pad2(d.getMinutes())} ${h < 12 ? 'AM' : 'PM'}`;
}

export function formatDay(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

/** How long until it is due, in the coarsest unit that still reads naturally. */
export function countdown(at: string, now = new Date()) {
  const ms = new Date(at).getTime() - now.getTime();
  if (ms < -60_000) return { text: 'overdue', overdue: true, ms };
  if (ms < 60_000) return { text: 'now', overdue: false, ms };

  const mins = Math.round(ms / 60_000);
  if (mins < 60) return { text: `in ${mins} min`, overdue: false, ms };

  const hours = Math.round(mins / 60);
  if (hours < 24) return { text: `in ${hours} hour${hours > 1 ? 's' : ''}`, overdue: false, ms };

  const days = Math.round(hours / 24);
  if (days < 7) return { text: `in ${days} day${days > 1 ? 's' : ''}`, overdue: false, ms };

  const weeks = Math.round(days / 7);
  return { text: `in ${weeks} week${weeks > 1 ? 's' : ''}`, overdue: false, ms };
}

const bySoonest = (a: Reminder, b: Reminder) =>
  new Date(a.at).getTime() - new Date(b.at).getTime();

/**
 * What is still ahead, soonest first.
 *
 * An hour of grace, so something that has only just passed stays visible
 * rather than vanishing from her list at the moment she looks for it.
 */
export function upcoming(list: Reminder[], now = new Date()) {
  const cutoff = now.getTime() - 60 * 60 * 1000;
  return list.filter((r) => new Date(r.at).getTime() >= cutoff).sort(bySoonest);
}

export { startOfDay };
