# MaternalCare+ — WebApp

Part of [MaternalCare+](../README.md). This folder is the **View** of the
MVC architecture: a React + TypeScript single-page app that is the public
website, the mother's portal and the clinician's portal, all served by the
Express API in the repository root. The same bundle, built a second time,
is also the [Android app](android/README.md).

<p align="center">
  <img src="https://github.com/user-attachments/assets/cccaf4df-68e9-4a9b-bced-23ca316dd1d8" width="720" alt="The landing page">
</p>
<p align="center">
  <img src="https://github.com/user-attachments/assets/17450dc3-050a-4067-b1e6-aeb817815e55" width="355" alt="The mother's dashboard, week 32">
  <img src="https://github.com/user-attachments/assets/729b641a-b063-4b1a-88ca-f64ba3b866cd" width="355" alt="The clinician portal">
</p>
<p align="center"><sub>Screenshots from the dev server at 1440×900, signed in as the demo accounts in the <a href="../README.md#signing-in">root README</a>.</sub></p>

---

## Contents

- [How it is put together](#how-it-is-put-together)
- [Running it](#running-it)
- [The public site](#the-public-site)
- [Registration and onboarding](#registration-and-onboarding)
- [The mother's portal](#the-mothers-portal)
  - [Dashboard](#dashboard)
  - [Vitals](#vitals)
  - [Reminders](#reminders)
  - [Doctor](#doctor)
  - [Community](#community)
  - [SOS](#sos)
  - [The account panel](#the-account-panel)
  - [One portal, four life stages](#one-portal-four-life-stages)
- [The clinician's portal](#the-clinicians-portal)
- [Reminders that reach the device](#reminders-that-reach-the-device)
- [Language](#language)
- [How data flows](#how-data-flows)
- [Project layout](#project-layout)
- [Checking the code](#checking-the-code)

---

## How it is put together

| | |
|---|---|
| **Stack** | React 18 · TypeScript · Vite 5 · Tailwind CSS · Framer Motion · Recharts · Lucide · react-router 6 |
| **Routing** | `src/App.tsx`. Every page is code-split (`React.lazy`) so a route shows the branded loader while it streams in. `RequireAuth` wraps the three routes that hold medical records (`/mother`, `/doctor`, `/appoint`) and sends anyone else to sign-in. |
| **Server I/O** | `src/lib/api.ts` is the one `fetch` for every call. In development it talks to `http://localhost:3000/api`; in a build it uses a relative `/api` because Express serves the bundle from the same origin. `src/hooks/useDashboardData.ts` loads everything a portal needs in parallel. |
| **Sessions** | A cookie the browser keeps (`credentials: 'include'`). `src/lib/auth.tsx` checks `GET /api/auth/session` once on load and provides `useAuth()`. |
| **Design** | Glass cards on a soft gradient background (`components/ui/GlassCard`, `Background`), a floating **SectionDock** for tabs that becomes a bottom bar on phones, scroll reveals (`Reveal`), and one brand blue for mothers, orange for clinicians. |
| **Native** | `src/lib/native.ts` is inert in a browser; the [Android README](android/README.md) covers what it does in the app. |

## Running it

Start the backend first — the API needs a session, so the app sends you to
sign-in without one.

```bash
npm start                                   # the API, from the repository root → :3000
npm --prefix frontend install
npm --prefix frontend run dev               # → http://localhost:5173
```

`npm --prefix frontend run build` type-checks (`tsc -b`) and writes `dist/`,
which `npm start` then serves on one origin — that is the production shape,
and what [`render.yaml`](../render.yaml) deploys.

## The public site

Everything reachable without an account.

| Route | Page | What it is |
|---|---|---|
| `/` | Landing | Hero with an image carousel, trust bar, the four **care stages**, features, a product **showcase**, the **journey** timeline, a call to action. (In the app this route opens straight on the portal.) |
| `/about` | Our story | A scroll-driven narrative of why the product exists. |
| `/trends`, `/reminders`, `/community` | Feature pages | Public explainers for the three features the footer links to — written for someone who has not signed up yet. |
| `/consultants` | For clinicians | How clinicians practise here: caseload, fees, the portal. |
| `/health-plan`, `/contact` | Plans, contact | How organisations cover members; where to write. |
| `/terms` | Terms & privacy | One document, `src/data/terms.ts`, describing what the application actually does — the seven-day deletion, who sees what, scrypt, the guardian link. The same text is shown at registration and inside both portals. |
| `/signin`, `/register` | Sign in, register | Below. |

<p align="center">
  <img src="https://github.com/user-attachments/assets/39567723-713f-4c44-97b9-2df9c559abb8" width="230" alt="The full landing page">
  <img src="https://github.com/user-attachments/assets/d3e15619-4977-4ed1-a9b0-99b1df40b432" width="230" alt="Our story">
  <img src="https://github.com/user-attachments/assets/b0b32ce3-fc4e-45d7-aaa9-4fbf1e9529d1" width="230" alt="The Health trends feature page">
</p>
<p align="center">
  <img src="https://github.com/user-attachments/assets/b72194c8-0e97-46be-980a-cfac8ffbe332" width="355" alt="Sign in">
  <img src="https://github.com/user-attachments/assets/674a5e45-4eb7-4150-bcad-018576c3b19d" width="355" alt="Register">
</p>


The sign-in screen lists the **demo accounts** (`GET /api/auth/demo-accounts`
— names and emails, never passwords) in development; production hides the
list. The passwords are in the [root README](../README.md#signing-in).

## Registration and onboarding

`/register` creates either a **mother** or a **doctor** account
(`POST /api/auth/register` / `POST /api/doctors/register`). Both open the
terms and refuse to register without the version they showed, recorded as
`users.terms_version` / `terms_accepted_at`. Sign-in attempts are
rate-limited per address and per account.

A new mother then lands on **`/onboarding`**, a questionnaire that differs by
stage — a pregnant mother is asked for her last period, history and
symptoms; a new mother about the baby and feeding; a parent about growth and
milestones; a woman planning about cycles and folic acid. Every answer is
kept (`users.dob/height_cm/weight_kg/allergies/intake`, the pregnancy, the
child, and symptoms as real symptom entries), and the dashboard's corner
button ("Edit due date", "Update *baby*", "Add a measurement", "Update your
details") reopens the same questionnaire for that stage, pre-filled from
`GET /api/onboarding`.

<p align="center">
  <img src="https://github.com/user-attachments/assets/b0b4fd5f-14ed-4237-b907-487ab8c376dc" width="720" alt="The onboarding questionnaire">
</p>

## The mother's portal

`/mother`. Five tabs on the dock (`?tab=` in the URL, so a tab can be
linked), a notification bell, the **SOS** button and her avatar in the
header. A greeting that knows the time of day and whether anything needs
her ("Everything looks calm today").

### Dashboard

<p align="center">
  <img src="https://github.com/user-attachments/assets/602f5bbe-7188-4bd9-831a-5338f07b7fb5" width="720" alt="The dashboard, top to bottom">
</p>

- **Stage hero** — this week on a calendar strip, the pregnancy arc from
  conception to week 40 with her position and the trimester markers, the
  week, the baby's size ("Coconut · 42.4 cm · 1.7 kg"), due date, days to
  go, baby length and weight, weight gained. The corner button reopens the
  questionnaire.
- **Daily check-in** — a sheet for kicks, mood, water, weight, blood
  pressure, the baby's heartbeat and sleep. A row is sent only if it was
  touched or already had a value, so pressing Save never invents a blood
  pressure she did not measure. For a new mother or parent the child's own
  four questions (feeds, nappies, sleep, temperature) are here too.
- **Today's reading** — the article written for this week
  (`src/data/reading.ts`), opened in a modal.
- **Symptoms** — the journal, with voice entry: the browser's own
  `SpeechRecognition`, or the server's transcription endpoint when a key is
  configured (`POST /api/voice/transcribe`). Ending an entry makes the next
  visit ask "still there?". Lingering symptoms are surfaced to her care team.
- **The bell** — everything that needs her, ranked, built from what the
  dashboard already loaded: an out-of-range reading, a reminder falling due,
  a check-in not done, a live SOS.

### Vitals

<p align="center">
  <img src="https://github.com/user-attachments/assets/d6843646-3cf8-40af-9e2e-0e7bb374b7c9" width="720" alt="The vitals tab">
</p>

- **Readings outside the usual range** — sorted by how far out, each with
  the plain-English consequence ("Fasting glucose is above the safe limit —
  contact your doctor"). Her care team sees the same list.
- **Weight gain** against the range recommended for her starting BMI
  (`GET /api/weight-gain`).
- **Trend charts** — weight vs the recommended band, baby's typical length
  and weight by week, blood pressure (systolic/diastolic), fetal heart rate,
  baby kicks this week, sleep — all from `GET /api/vitals` and the daily log.
  Charts say "No heartbeats logged yet" rather than drawing sample data.
- **Baby development this week**, **mood recently**, **hydration today**.
- **Health report** — one PDF of everything on record (`GET /api/report.pdf`,
  built with pdfkit). The clinician gets the same document per patient.
- **Your risk assessment** — two independent readings of the same vitals,
  side by side: the **rule engine** (`models/riskModel.js`, thresholds
  written out, with *What made this score*) and the **trained model** (the
  FastAPI random forest in [`ml-service/`](../ml-service/README.md)). When
  the model is not running the card says so; when they disagree the app
  says so instead of picking a winner.
- **Your care plan** — nutrition, movement and lifestyle for where she is,
  with every line saying which of her own readings it came from
  (`GET /api/guidance`), plus daily targets for the week.

### Reminders

<p align="center">
  <img src="https://github.com/user-attachments/assets/7a081e19-ae5f-46c3-8597-73e8a40e9a94" width="720" alt="The reminders tab">
</p>

- **Vaccination record** — for her and for the baby, on one list: mark a
  dose done (and undo a mistake), file a photograph of the paper card
  against the row, see what is due and upcoming, and take **Suggested**
  doses from the schedule in `src/data/vaccines.ts`.
- **Reminders** by kind — doctor appointments, tests, medicines & exercises,
  vaccinations — with *Schedule new* per kind and a count of what is coming.
- **Get reminders on this device** — see [below](#reminders-that-reach-the-device).
- **Recent symptoms** with what to do about them and what to raise at the
  next visit.

### Doctor

<p align="center">
  <img src="https://github.com/user-attachments/assets/7c8c124b-129d-4413-ad32-a7da7d9fba18" width="720" alt="The doctor tab">
</p>

- **Appoint a doctor** — **Book now** opens `/appoint`, the booking desk:
  the directory (`GET /api/doctors`, with each clinician's real open/busy/full
  status computed from their caseload), slots, plans and fees, and a paid
  booking that confirms the slot outright (`POST /api/appointments/paid`).
  **Auto Assign** picks a recommended clinician for her stage.
- **Talk to your doctor** — message threads with each clinician looking
  after her, with photographs (`/api/messages`).
- **Prescriptions & reports** — photograph the slip or upload a PDF (up to
  5 MB); each is filed by its own date and shown to her doctor.
- **Your requests** — appointment requests and their state (nothing is
  booked until a doctor accepts), with **Move** (reschedule, keeping her
  place in the queue) and **Cancel** with a reason.
- Ending the care relationship, from either side, with a reason
  (`/api/care-endings`).

<p align="center">
  <img src="https://github.com/user-attachments/assets/58bb125e-8969-46ce-a444-2351bc96b83f" width="720" alt="The booking desk">
</p>

### Community

<p align="center">
  <img src="https://github.com/user-attachments/assets/1f619ba1-0be3-4055-92da-67aa863ac825" width="720" alt="The community tab">
</p>

A board for mothers and doctors: posts with photos, comments, hearts (real
ones, one per member), and a **report** button on every post and comment
that goes to the clinicians' moderation queue. The sidebar's **week group**
counts the mothers at the same week as her.

### SOS

<p align="center">
  <img src="https://github.com/user-attachments/assets/4050c7d5-4906-4467-9ba5-4317e359a425" width="720" alt="The SOS dialog">
</p>

**Press for help** starts a five-second countdown she can cancel; then her
location is attached and her guardians and her doctor are alerted at once
(`POST /api/sos`). Below: her **guardians** (add, remove, and *Send links* —
each person's private pairing link for the [Guardian app](../guardian-app/README.md)),
her **emergency number** (editable), and the **Android app** download for
guardians. Once an alert is live the button shows who has acknowledged, and
she can mark herself safe.

### The account panel

Her avatar opens it: name, photo, bio and her details; **Privacy & data**
(the terms, the account export as JSON, and deletion — the account is closed
after seven days, and a password is re-checked first); **Where you're signed
in**, listing every session with the option to end any other one;
**Language**; and sign out.

### One portal, four life stages

The same `/mother` route renders differently for each stage of the demo
accounts — no pregnancy countdown for a woman planning, the baby's own log
for a new mother, growth against the WHO curves and milestones for a parent.

<p align="center">
  <img src="https://github.com/user-attachments/assets/1be70c90-2e0b-46cf-af6e-5965fd3136bf" width="230" alt="Planning">
  <img src="https://github.com/user-attachments/assets/7667abf3-ed34-43d7-87f9-2fd6e90c98df" width="230" alt="New mother">
  <img src="https://github.com/user-attachments/assets/7e202e29-7ee5-4594-a067-677e4146b4f5" width="230" alt="Parent">
</p>

## The clinician's portal

`/doctor`, for accounts with the `clinician` role. Orange accent, six tabs.

| Tab | What it holds |
|---|---|
| **Overview** | Four KPIs (under your care, high risk, today's appointments, open alerts — each opens a detail modal), **Needs your attention** (raised automatically from what patients logged — symptoms lingering, high risk assessed, raised BP), clinic activity and the trimester mix. A red **SOS banner** appears across the top when one of her patients has a live alert. |
| **Patients** | The caseload with a risk filter. A patient opens to her record: vitals, symptoms, the two risk readings, the care plan, **Files** (her prescriptions and reports, plus ones the clinician adds), the PDF report, and **Assign** — a reminder placed straight on her list. |
| **Schedule** | Today's clinic: the confirmed slots, who is still to be seen. |
| **Inbox** | Requests to be seen — accept, decline, or reschedule — and the message threads with each patient, with a "ready your meeting link" nudge (Google Meet, Zoom or WhatsApp) for visits about to start. |
| **Moderation** | Posts and comments mothers have reported, with resolve actions (`/api/moderation`). |
| **Reports** | Practice analytics counted from her own caseload (`GET /api/analytics`). |

Her profile shows what registration asked — specialty, qualification,
years, phone, licence number — and lets her change all but the sign-in
email and licence, plus her **caseload capacity** and whether she is taking
new patients, which is what the directory's open/busy/full badge is computed
from.

<p align="center">
  <img src="https://github.com/user-attachments/assets/334603ae-25b8-4224-a731-883af6cfefd4" width="355" alt="Patients">
  <img src="https://github.com/user-attachments/assets/aaa87429-6e63-4b5e-ad9c-55fa54a9ca19" width="355" alt="Schedule">
</p>
<p align="center">
  <img src="https://github.com/user-attachments/assets/275e78a6-dabc-42fd-8905-a3af9f1a1fab" width="355" alt="Inbox">
  <img src="https://github.com/user-attachments/assets/b3b8453a-2e70-40ce-8e38-8383f409e4f8" width="355" alt="Moderation">
</p>
<p align="center">
  <img src="https://github.com/user-attachments/assets/6148e549-e5b4-4db1-bf31-403a3215ce8d" width="720" alt="Reports">
</p>


## Reminders that reach the device

Reminders are delivered as **browser push notifications** — Chrome, Edge,
Firefox, and iOS when the app is added to the home screen — with the tab
closed. **Reminders → *Get reminders on this device* → Turn on**, then
*Send a test* to see one arrive. `src/lib/push.ts` registers the service
worker (`public/sw.js`), subscribes with the server's VAPID key
(`GET /api/push/key`) and posts the subscription; the server
(`models/pushModel.js`) checks every minute for reminders that have fallen
due, records each occurrence so nothing is sent twice, encrypts each message
to the device's own keys and posts it to the browser's push service. In the
Android app reminders are local alarms instead — see the
[Android README](android/README.md#5-reminders-as-android-alarms--no-push-service).

## Language

English and **Bangla**, switched from the account panel and remembered on
the account (`PATCH /api/me/language`). The client strings live in
`src/i18n/en.ts` and `bn.ts` and are read through `useT()`; server-composed
text (risk factors, guidance) has its own translations in `models/i18n/`.
Tab labels are typed keys (`nav.dashboard`), so a missing translation is a
type error rather than a silent English fallback.

## How data flows

```
 page (src/pages)                       hook / lib                              Express
 ───────────────────                    ──────────────────────────               ─────────────────────────────
 Mother.tsx                             useDashboardData()  ──── GET /me, /vitals, /symptoms, /reminders,
   ├─ StageHero, DailyCheckIn,                              ──── /child, /vaccinations, /appointments,
   │  RiskPanel, CarePlan, …              api.ts (one fetch,      /messages, /documents, /guardians …
   │                                       cookie or bearer)
   ├─ writes: PUT /daily-log, POST /symptoms, POST /appointments, POST /sos …
   └─ setState from the response — the UI never guesses what the server did

 Doctor.tsx                             useDashboardData()  ──── GET /patients, /analytics, /doctors/:id/…
```

Every write is an origin-checked request the server refuses cross-site; the
client sends no CSRF token because there is none to send — the
[root README](../README.md#security) explains the model.

## Project layout

```
frontend/
├── index.html
├── vite.config.ts             '@' → src, port 5173, listens on the LAN for phone testing
├── tailwind.config.js · postcss.config.js · eslint.config.js · tsconfig.json
├── capacitor.config.ts        the Android build — see android/README.md
├── public/
│   ├── sw.js                  push service worker
│   ├── hero/ · media/ · icons/
├── src/
│   ├── main.tsx · App.tsx     providers, routes, the per-route loader copy
│   ├── pages/                 Landing, SignIn, Register, Onboarding, Mother, Doctor, Appoint,
│   │                          About, Consultants, HealthPlan, Contact, Trends, RemindersPage,
│   │                          CommunityPage, Terms
│   ├── components/
│   │   ├── landing/           Hero, HeroImageCarousel, TrustBar, CareStages, Features, Showcase,
│   │   │                      Journey, CTASection, Footer, Navbar, Background, FlowingLines
│   │   ├── mother/            StageHero, DailyCheckIn, SymptomModal, RiskPanel, CarePlan,
│   │   │                      WeightGainCard, OutOfRange, ChildVitals, VaccinationRecord,
│   │   │                      VaccineSuggestions, RemindersSection, PushNotificationsCard,
│   │   │                      FindDoctorSection, AppointmentModal, RescheduleDialog, DoctorChat,
│   │   │                      DocumentsSection, DocumentViewer, CommunitySection, ArticleModal,
│   │   │                      NotificationBell, SosModal, ProfileModal, DeleteAccountModal,
│   │   │                      WidgetSection, MotherTabs
│   │   ├── doctor/            SosBanner, KpiModal, PatientFiles, RequestInbox, MessageThreads,
│   │   │                      ModerationQueue, AssignModal, CareEndings, DoctorProfile
│   │   ├── native/AppShell    app-only: where it opens, the back button
│   │   ├── charts/            MiniAreaChart
│   │   └── ui/                GlassCard, SectionDock, Reveal, FloatingInput, GlassSelect,
│   │                          GlassDatePicker, FileUpload, FileImage, LiquidButton, ProgressRing,
│   │                          Loader, Badge, ReasonDialog, ReportButton, SignedInDevices,
│   │                          TermsModal, TermsContent, BeamsBackground, AITextLoading
│   ├── hooks/                 useDashboardData (all server I/O), usePregnancy, useVitalSeries
│   ├── lib/                   api, auth, native, files, push, localReminders, widget, alarm,
│   │                          checkin, health, greeting, notifications, motion, fileDate, cn
│   ├── context/ProfileContext
│   ├── i18n/                  en.ts, bn.ts, index.tsx (useT)
│   ├── data/                  reference data & types: care, records, symptoms, childSymptoms,
│   │                          vaccines, reminders, reading, onboarding, sos, doctor, landing,
│   │                          sweetMessages, terms
│   └── index.css
├── scripts/build-apk.mjs
└── android/                   the Capacitor project → android/README.md
```

## Checking the code

```bash
npm --prefix frontend run lint     # ESLint: TypeScript, React Hooks, Fast Refresh
npm --prefix frontend run build    # tsc -b, then a production bundle
```
