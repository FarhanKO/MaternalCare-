import { useCallback, useEffect, useState } from 'react';
import { api, type ApiStatus } from '@/lib/api';
import type { Symptom } from '@/data/symptoms';
import type { Reminder } from '@/data/reminders';

/**
 * Loads the dashboard's persisted state from the Express API and keeps it in
 * sync.
 *
 * Symptoms start empty and stay empty until she logs something. They used to
 * start as "Back ache, 5 days" and "Heartburn" — written into the account of
 * anyone whose journal was empty, which is everyone on their first visit.
 * Those two then counted against her wellbeing score and appeared on her
 * clinician's screen as things she had reported. Nobody had reported them.
 */
export function useDashboardData() {
  const [status, setStatus] = useState<ApiStatus>('loading');
  const [symptoms, setSymptoms] = useState<Symptom[]>([]);
  const [childSymptoms, setChildSymptoms] = useState<Symptom[]>([]);
  /*
   * Empty until the server answers, and empty after that if she has set
   * nothing. This started as eight fixtures — a prenatal vitamin, an iron
   * tablet, a growth ultrasound with a named doctor and a room number, a
   * glucose screening, prenatal yoga — shown for a moment to every mother
   * before her real list loaded.
   */
  const [reminders, setReminders] = useState<Reminder[]>([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [s, cs, r] = await Promise.all([
          api.getSymptoms(),
          // empty array for an account with no child; not an error
          api.getChildSymptoms().catch(() => [] as Symptom[]),
          api.getReminders(),
        ]);
        if (cancelled) return;
        setSymptoms(s);
        setChildSymptoms(cs);
        /*
         * Her reminders, whatever they are — including none.
         *
         * An empty list used to trigger eight fixtures being WRITTEN to her
         * account through the API: pregnancy reminders, on every stage. A
         * woman planning a pregnancy was given a whooping cough date, which
         * is administered between weeks 27 and 36 of one, and a growth
         * ultrasound with "Dr. Lena Ortiz · Room 204". Twenty-four such rows
         * were sitting on three non-pregnant accounts.
         *
         * A schedule nobody set is worse than an empty one: the empty state
         * invites her to add something, and the fixtures invited her to keep
         * an appointment that does not exist.
         */
        setReminders(r);
        if (!cancelled) setStatus('online');
      } catch {
        // Backend not running — keep local seed data.
        if (!cancelled) setStatus('offline');
      }
    })();

    return () => { cancelled = true; };
  }, []);

  /** Persist the symptom journal (called when the logger saves). */
  const saveSymptoms = useCallback(async (list: Symptom[]) => {
    setSymptoms(list); // optimistic
    try {
      const saved = await api.saveSymptoms(list);
      setSymptoms(saved);
    } catch {
      setStatus('offline');
    }
  }, []);

  /** The same for the child's list, which the server keeps apart from hers. */
  const saveChildSymptoms = useCallback(async (list: Symptom[]) => {
    setChildSymptoms(list); // optimistic
    try {
      setChildSymptoms(await api.saveChildSymptoms(list));
    } catch {
      setStatus('offline');
    }
  }, []);

  /** Ends the entry so the next visit asks whether each symptom is still there. */
  const endSymptomEntry = useCallback(async () => {
    setSymptoms((prev) => prev.map((s) => ({ ...s, confirmedToday: false })));
    setChildSymptoms((prev) => prev.map((s) => ({ ...s, confirmedToday: false })));
    try {
      await api.endSymptomEntry();
      await api.endChildSymptomEntry().catch(() => undefined);
    } catch {
      setStatus('offline');
    }
  }, []);

  /** Add or remove reminders, mirroring the change to the server. */
  const changeReminders = useCallback(async (next: Reminder[], previous: Reminder[]) => {
    setReminders(next); // optimistic
    try {
      const added = next.filter((n) => !previous.some((p) => p.id === n.id));
      const removed = previous.filter((p) => !next.some((n) => n.id === p.id));
      for (const rem of removed) await api.deleteReminder(rem.id);
      for (const add of added) {
        const { id: _id, ...body } = add;
        await api.createReminder(body);
      }
      setReminders(await api.getReminders());
    } catch {
      setStatus('offline');
    }
  }, []);

  return {
    status, symptoms, childSymptoms, reminders,
    saveSymptoms, saveChildSymptoms, endSymptomEntry, changeReminders,
  };
}
