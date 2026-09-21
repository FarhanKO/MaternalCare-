/**
 * The terms of use and the privacy notice — one document, in one place.
 *
 * It used to exist twice, and both times as a promise: the registration
 * form had "I agree to the Terms and Privacy Policy" with both words linked
 * to "#", and the profile panel had "Privacy & data — who can see your
 * records" as a button that did nothing. Now both open this, the footer
 * links to it, and the version somebody agreed to is recorded on their
 * account when they register.
 *
 * Everything below describes what the application actually does — the
 * seven-day deletion window, scrypt, the guardian link, the export — not
 * what a template says an application ought to. When the behaviour changes,
 * this changes with it, and the version with it.
 */

/** Bumped whenever the wording changes in a way a person should know about. */
export const TERMS_VERSION = '2026-09';

export type TermsPart = 'terms' | 'privacy';

export interface TermsSection {
  id: string;
  part: TermsPart;
  title: string;
  /** one paragraph per entry */
  body: string[];
}

export const TERMS_SECTIONS: TermsSection[] = [
  /* ------------------------------------------------------- terms of use */
  {
    id: 'what-this-is',
    part: 'terms',
    title: 'What MaternalCare+ is, and is not',
    body: [
      'MaternalCare+ is a companion for pregnancy, birth and the early years: a place '
      + 'to record readings, symptoms and routines, to keep documents together, to '
      + 'reach the clinicians looking after you and to talk to other mothers.',
      'It is not an emergency service and it is not a diagnosis. The guidance it '
      + 'shows — a risk band, a suggested cause, a food to try — is built from what '
      + 'you have logged and from general clinical guidance, and it is there to help '
      + 'you decide what to raise with a clinician, not to replace one. If you feel '
      + 'unwell, contact your care team or your local emergency number. The SOS '
      + 'button tells the people you have chosen where you are; it does not call an '
      + 'ambulance for you.',
    ],
  },
  {
    id: 'your-account',
    part: 'terms',
    title: 'Your account',
    body: [
      'One account is one person. Keep your password to yourself: it is the only '
      + 'thing standing between a lost phone and your record. You can see every '
      + 'device that is signed in from your profile, and end any of them.',
      'A session ends on its own after a week without use — twelve hours for a '
      + 'clinician — and after fourteen days regardless. Changing your password ends '
      + 'every session but the one you changed it from.',
      'Sign-in attempts are limited. After ten wrong passwords on an account, or '
      + 'thirty from one address, sign-in pauses for a quarter of an hour.',
    ],
  },
  {
    id: 'clinicians',
    part: 'terms',
    title: 'Clinicians',
    body: [
      'A clinician joins by registering with a licence number and a qualification, '
      + 'and is responsible for both being true. A clinician sees only the mothers '
      + 'who have booked with them or been placed in their care, and only while that '
      + 'care relationship lasts — either side can end it, with a reason, from the app.',
      'Clinicians moderate the community. A post or comment that is reported goes to '
      + 'a queue that a clinician resolves, and the outcome is recorded.',
    ],
  },
  {
    id: 'community',
    part: 'terms',
    title: 'The community',
    body: [
      'Posts and comments are visible to every signed-in mother, with your name on '
      + 'them. Write for people who are tired, frightened or grieving, because some '
      + 'of the people reading are. No medical advice presented as certain, no '
      + 'selling, no photographs of other people\'s children without their say-so.',
      'Anyone can report a post or a comment. A report a clinician upholds hides '
      + 'the post or comment from the board, with the reason recorded; a report '
      + 'that is dismissed leaves it where it was. Nothing is deleted either way.',
    ],
  },
  {
    id: 'ending',
    part: 'terms',
    title: 'Ending your account',
    body: [
      'You can delete your account from your profile at any time; it asks for your '
      + 'password and nothing else. The account closes immediately and every device '
      + 'is signed out. Your records are kept for seven more days, only so that a '
      + 'question about your care raised in that week can still be answered, and then '
      + 'destroyed — profile, readings, logs, symptoms, documents, photographs, '
      + 'appointments, messages, posts and comments, from the database and from disk. '
      + 'Nothing about that can be reversed.',
      'Before deleting, you can download everything the application holds about you '
      + 'as a single file.',
    ],
  },
  {
    id: 'changes',
    part: 'terms',
    title: 'Changes to these terms',
    body: [
      'This document carries a version. The version you agreed to when you '
      + 'registered is recorded on your account and shown in your profile, next to '
      + 'the current one, so you can always tell whether something has changed since.',
    ],
  },

  /* -------------------------------------------------------------- privacy */
  {
    id: 'what-we-hold',
    part: 'privacy',
    title: 'What we hold about you',
    body: [
      'What you give us: your name, email, phone number, date of birth, blood '
      + 'group, your pregnancy dates and the answers from onboarding. What you log: '
      + 'blood pressure, weight, glucose, temperature, heart rate, mood, water, '
      + 'sleep, kicks, symptoms, and for a child their feeds, nappies, growth, '
      + 'milestones and vaccinations. What you upload: prescriptions, results and '
      + 'photographs. What you write: messages to your clinicians, community posts '
      + 'and comments. What you set up: reminders, appointments, and the people you '
      + 'have chosen as emergency contacts.',
      'When you press SOS, your location at that moment is recorded with the alert '
      + 'and shown to the contacts and clinicians it reaches. It is not tracked at '
      + 'any other time.',
    ],
  },
  {
    id: 'who-can-see',
    part: 'privacy',
    title: 'Who can see your records',
    body: [
      'You. The clinicians you have booked with or been placed under, for as long '
      + 'as that lasts — they see your readings, logs, documents and the messages '
      + 'between you, and can build the same health report you can. A guardian you '
      + 'invite sees a summary — week, due date, latest readings, and an alert if you '
      + 'raise one — through a link you hand them, which you can revoke. Other '
      + 'mothers see your community posts and comments, and nothing else.',
      'Nobody else. There is no advertising, no analytics tracker and no data '
      + 'broker. The application does not sell, share or license your records.',
    ],
  },
  {
    id: 'how-it-is-protected',
    part: 'privacy',
    title: 'How it is protected',
    body: [
      'In a deployment every connection is encrypted; a request over plain http is '
      + 'refused. Passwords are never stored — only a slow hash (scrypt) that the '
      + 'application checks against, and that nothing prints or logs. The token that '
      + 'keeps you signed in is stored hashed as well, so a copy of the database is '
      + 'not a set of logins. Pages of your record are marked so that browsers and '
      + 'proxies do not cache them.',
      'Health records cannot be made risk-free. What we can promise is that the '
      + 'protections above are real, are checked, and are described here honestly.',
    ],
  },
  {
    id: 'optional-services',
    part: 'privacy',
    title: 'Optional services',
    body: [
      'The symptom logger can take dictation. When you use the microphone, the '
      + 'recording is sent to a speech-to-text provider configured by whoever runs '
      + 'this deployment, turned into text, and discarded; nothing is stored on '
      + 'either side. If no provider is configured, your browser\'s own recognition '
      + 'is used and nothing leaves your device. You will always be asked before the '
      + 'microphone is used.',
      'The risk assessment runs on the same infrastructure as the rest of the '
      + 'application. No third party receives your readings to produce it.',
    ],
  },
  {
    id: 'how-long',
    part: 'privacy',
    title: 'How long we keep it',
    body: [
      'For as long as your account exists. After you delete it: seven days, then '
      + 'nothing. The one thing kept is the reason you gave for leaving, separated '
      + 'from your name, email and phone, as anonymous feedback.',
    ],
  },
  {
    id: 'your-rights',
    part: 'privacy',
    title: 'Your rights',
    body: [
      'You can see everything the application holds about you by downloading it '
      + 'as a single file from your profile. You can correct your details from the '
      + 'same place. You can delete the account, and everything with it, whenever you '
      + 'choose. Questions about any of this: hello@maternalcare.app.',
    ],
  },
];

export const sectionsFor = (part: TermsPart) => TERMS_SECTIONS.filter((s) => s.part === part);
