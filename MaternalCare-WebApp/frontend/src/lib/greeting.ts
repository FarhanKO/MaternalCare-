/**
 * Time-of-day greeting, on the viewer's own clock.
 *
 * This lived twice — once in Mother.tsx and once in Doctor.tsx, identical and
 * free to drift apart. One copy now, because a mother and her clinician
 * looking at the same minute should be told the same thing about it.
 *
 * The boundaries are not the ones a 24-hour clock would suggest. Evening used
 * to begin at 17:00, so the dashboard said "Good evening" at five past five in
 * the afternoon. In Bengali usage বিকাল (afternoon) runs until roughly sunset
 * and সন্ধ্যা (evening) begins there, which in Dhaka is closer to six — so
 * afternoon now holds until 18:00. The app is used in Bangladesh; the bands
 * should read the way the day is actually spoken about there.
 */

export type DayPart = 'morning' | 'noon' | 'afternoon' | 'evening' | 'night';

/** Which part of the day a local hour falls in. One place decides. */
export function dayPartFor(d: Date): DayPart {
  const h = d.getHours();
  if (h >= 5 && h < 12) return 'morning';
  if (h === 12) return 'noon';
  if (h >= 13 && h < 18) return 'afternoon';
  if (h >= 18 && h < 22) return 'evening';
  return 'night';
}

const GREETING: Record<DayPart, string> = {
  morning: 'Good morning',
  noon: 'Good noon',
  afternoon: 'Good afternoon',
  evening: 'Good evening',
  night: 'Good night',
};

/**
 * The closing line under the greeting.
 *
 * Keyed off the same day part, so the two can no longer disagree — at noon the
 * greeting said "Good noon" while the line beside it was the afternoon one,
 * because each function drew its own boundaries.
 */
const DAY_NOTE: Record<DayPart, string> = {
  morning: 'Everything looks calm today.',
  noon: 'A good moment to drink some water.',
  afternoon: 'A good moment to drink some water.',
  evening: 'Winding down — how has today felt?',
  night: 'Rest well — sleep on your side tonight.',
};

export const greetingFor = (d: Date) => GREETING[dayPartFor(d)];
export const dayNoteFor = (d: Date) => DAY_NOTE[dayPartFor(d)];
