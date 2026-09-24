# MaternalCare+ 🤍

**A maternal & child health platform — for the mother, her doctor, and the
people beside her.**

Pregnancy tracking, symptom journalling with voice input, appointments &
reminders, maternal vitals with automated alerts, WHO child-growth curves,
vaccination scheduling, AI risk classification, emergency SOS with a
guardian alarm app, a knowledge base + community, and a clinician portal —
as a website, an Android app, and a companion app for guardians, all on one
Express + PostgreSQL backend.

**[Live demo →](#)** *https://maternalcare-l9mp.onrender.com/*

<p align="center">
  <img src="https://github.com/user-attachments/assets/c401cfa5-9817-40ae-943a-2b5d98c54b55" width="560" alt="The mother's dashboard on the website">
</p>
<p align="center">
  <img src="https://github.com/user-attachments/assets/74f9ef19-5092-4826-9c6b-293798fe1abc" width="180" alt="The same dashboard in the Android app">
  <img src="https://github.com/user-attachments/assets/373f69d5-a9bb-4f3a-b072-e26fed8f7149" width="180" alt="The Android home-screen widget">
  <img src="https://github.com/user-attachments/assets/7ced500b-bb19-48bd-a2b9-fdb9fcab2cc1" width="180" alt="The Guardian companion app">
  <img src="https://github.com/user-attachments/assets/dcc2f9ad-18ba-4134-adab-ce4d2bbbc6b3" width="180" alt="An SOS waking a guardian's sleeping phone">
</p>
<p align="center"><sub>Website at 1440×900 · the two APKs on an Android 17 emulator · every screenshot in this repository is of the running software with the seeded demo data.</sub></p>

---

## Contents

- [The pieces](#the-pieces)
- [Architecture](#architecture)
- [What it does](#what-it-does)
- [Repository map](#repository-map)
- [Running the project](#running-the-project)
- [Signing in](#signing-in)
- [A tour in screenshots](#a-tour-in-screenshots)
- [The backend](#the-backend)
  - [API](#api)
  - [Security](#security)
  - [Push notifications](#push-notifications)
  - [Deploying](#deploying)
- [Documentation](#documentation)
- [Checking the code](#checking-the-code)
- [Tech stack](#tech-stack)

---

## The pieces

| Piece | Where | What it is | Its own README |
|---|---|---|---|
| **Backend API** | `app.js`, `models/`, `controllers/`, `routes/`, `middleware/`, `db/` | Express MVC. Owns every rule and every row: the Models (data access + domain logic) and thin JSON Controllers. Serves the built website, the guardian bundle and the APK downloads. PostgreSQL on Supabase. | this file, [below](#the-backend) |
| **Web client** | `frontend/` | React + TypeScript SPA: the public site, the **mother's portal** and the **clinician's portal**. The only View for those two roles. | [MaternalCare-WebApp/frontend/README.md](MaternalCare-WebApp/frontend/README.md) |
| **Android app** | `frontend/android/` | The same React bundle wrapped by Capacitor: server address on the sign-in screen, bearer-token sessions, Android alarms for reminders, share-sheet downloads, and a **home-screen widget**. | [MaternalCare-App/README.md](MaternalCare-App/README.md) |
| **Guardian app** | `guardian-app/` | A separate, small app for the people a mother nominates: her week, her readings, what to do about them — and a full-volume alarm through silent mode when she presses SOS. Pairs with a link; no account. | [Guardian-App/README.md](Guardian-App/README.md) |
| **Risk model service** | `ml-service/` | Optional FastAPI + scikit-learn classifier (random forest on the UCI Maternal Health Risk data). The app works without it and says so. | [MaternalCare-WebApp/ml-service/README.md](MaternalCare-WebApp/ml-service/README.md) |

## Architecture

**One Model layer, three Views.** Express holds the Models and Controllers
and exposes them as a JSON API. The React SPA is the View for mothers and
clinicians — in a browser *and* inside the Android app — and the guardian
app is a third View over the same Models, scoped by a link token. No View
holds domain logic; nothing is decided twice.

```
                        ┌──────────────────────────────────────────────────────────────┐
                        │  Express  (app.js)                                           │
   browser ──cookie───► │  middleware/  headers · tls · cors · csrf · session · rateLimit│
   (frontend, :5173     │  routes/api.js  ── every route guarded by default ──┐         │
    or built, :3000)    │  controllers/api/*   thin JSON controllers          │         │
                        │  models/*            data access + domain logic ◄───┘         │──── pg ───► PostgreSQL
   Android app ─bearer► │    pregnancy · vitals · risk (rules) · mlRisk · symptom ·     │             (Supabase)
   (X-Client: android)  │    child · vaccination · appointment · doctor · message ·     │
                        │    document · reminder · push · sos · guardian · post ·       │
   Guardian ─── token ► │    moderation · report (PDF) · guidance · intake · auth · …   │──── http ──► ml-service
   (/guardian/:token)   │  serves: frontend/dist · guardian-app/dist · public/downloads  │             FastAPI :8000
                        └──────────────────────────────────────────────────────────────┘             (optional)
```

An earlier server-rendered EJS View was removed — it predated
authentication and served patient records to anonymous requests.

## What it does


**Pregnancy & maternal health**
- F1 · Week tracker — the arc from conception to week 40, trimester, the baby's size that week, due date and days to go.
- F2 · Daily vitals — blood pressure, glucose, weight, temperature, fetal heart rate, kicks, sleep, mood, water, from one check-in sheet.
- F3 · Trend charts with automated alerts — readings outside the usual range are listed with the plain-English consequence; the clinician sees the same list.

**Child growth & development**
- F4 · Growth recorder, F5 · WHO percentile comparator (`models/data/whoGrowth.js`), F6 · milestone tracker — for the *new mother* and *parent* stages, with the child's own daily log (feeds, nappies, sleep, temperature).

**Vaccination & medication**
- F7 · Personalised vaccination scheduler for her and the baby; F9 · the paper card photographed against each dose.
- F8 · Reminders that reach the device — browser push on the website, Android alarms in the app — with a test button and honest "may be a few minutes late" copy.

**Appointments & healthcare services**
- F10 · Doctor directory with real open/busy/full status computed from each clinician's caseload; auto-assign for her stage.
- F11 · Booking — request, paid booking that confirms outright, reschedule without losing the queue place, cancel with a reason, end the care relationship from either side.
- F12 · Digital medical history — prescriptions and reports uploaded by her or her clinician, messages with photos, the whole record as one PDF.

**AI-powered decision support**
- F13 · Two risk readings side by side — a rule engine that explains itself and a trained random forest — shown disagreeing when they disagree. Bangla throughout. Voice entry for symptoms.
- F14 · A nutrition, movement and lifestyle plan where every line says which of her readings it came from.
- F15 · The downloadable PDF health report.

**Emergency & community**
- F16 · One-touch SOS: five-second countdown, location attached, guardians and doctor alerted; the **Guardian app** rings through silent mode and wakes a locked phone.
- F17 · Weekly articles; F18 · a community board with hearts, comments, and reporting into a clinician moderation queue.

**Doctor portal**
- F19 · Caseload, attention list raised from what patients logged, schedule, inbox, moderation, practice analytics, an SOS banner.
- F20 · Caregiver portal (the Guardian app); an administration portal is not built.

Non-functional: scrypt passwords, hardened sessions, CSP, origin-checked
writes, rate limits, terms acceptance, account export and seven-day
deletion — see [Security](#security).

## Repository map

```
MaternityCare+/
├── app.js                  entry point — security middleware, the API, the built clients
├── config/                 db pool (Supabase), per-request context, trusted origins, uploads, VAPID
├── middleware/             session · csrf · cors · headers · tls · rateLimit
├── models/                 MODEL — one file per concern (30 of them), models/data/whoGrowth.js,
│                           models/i18n/ for Bangla server text
├── controllers/api/        CONTROLLER — one thin JSON controller per model
├── routes/api.js           the route table; every route guarded by default
├── db/                     24 migrations, seeds, check/test/bench/audit scripts
├── ml-service/             the FastAPI risk classifier (optional)
├── frontend/               VIEW — React + TypeScript SPA ……………………… frontend/README.md
│   └── android/            the Capacitor Android project ………………… frontend/android/README.md
├── guardian-app/           the guardian companion app ……………………… guardian-app/README.md
├── public/downloads/       maternalcare.apk · guardian.apk (build artifacts, gitignored)
├── data/uploads/           prescriptions, chat photos, avatars (never committed)
├── design/                 design canvases and article/news thumbnails
├── docs/                   PROPOSAL-AUDIT.md, screenshots/, the SRS
├── render.yaml             one-click Render Blueprint
└── .env.example            every variable, documented
```

## Running the project

Requires **Node.js 22+** and a PostgreSQL connection string in `.env`
(copy `.env.example`; Supabase's *session pooler* URI, port 5432). Python
3.11+ is optional — only the risk model needs it. Android Studio is optional
— only the two APKs need it.

### 1. Database

```bash
npm install
npm run db:reset && npm run db:seed && npm run db:stages && npm run db:passwords
```

`db:reset` rebuilds the schema from `db/migrations`, `db:seed` fills it with
the invented caseload, `db:stages` adds the three life-stage accounts, and
`db:passwords` gives every account a password.

### 2. Backend

```bash
npm start
```

Runs at **http://localhost:3000** and prints its security posture in one
line. `localhost:3000` serves no pages in development — it is the API the
clients fetch from, and it must be running for any of them to load data.

### 3. Web client

```bash
npm --prefix frontend install && npm --prefix frontend run dev
```

Runs at **http://localhost:5173**. Full details in [frontend/README.md](https://github.com/FarhanKO/MaternalCare-/tree/main/Web#readme).

### 4. Guardian app

```bash
npm --prefix guardian-app install && npm --prefix guardian-app run dev
```

Runs at **http://localhost:5174**; open it with a pairing link from the
mother's SOS screen. Details in [guardian-app/README.md](https://github.com/FarhanKO/MaternalCare-/tree/main/Guardian%20App#readme).

### 5. Risk model — optional

```bash
python -m venv ml-service/.venv && node ml-service/run.js -m pip install -r requirements.txt
npm run ml:train && npm run ml:serve                 # → http://localhost:8000
```

The app works without it: the risk screen falls back to the rule engine and
says the model is not running. See [ml-service/README.md](https://github.com/FarhanKO/MaternalCare-/tree/main/Web/ml-service).

### 6. The Android apps — optional

```bash
npm --prefix frontend run apk          # → public/downloads/maternalcare.apk
npm --prefix guardian-app run apk      # → public/downloads/guardian.apk
```

## Signing in

Every account is stored with a **scrypt** hash (N=2^17, r=8, p=1 — OWASP's
recommended minimum). The plaintext below exists only in `db/seed-passwords.js`
and here; nothing in the application stores, logs or returns it.

| Account | Email | Stage / role | What it shows |
|---|---|---|---|
| Ayesha Rahman | `ayesha@example.com` | pregnant | Week 32. The fullest record — appointments, messages, documents, four guardians. |
| Amena Chowdhury | `amena@stage.demo` | planning | Pre-conception. No pregnancy, no countdown. |
| Nabila Karim | `nabila@stage.demo` | new mother | Ayaan at seven weeks, with his own daily log. |
| Orpa Das | `orpa@stage.demo` | parent | Rehnuma at two and a half, growth and milestones. |
| Dr. Lena Ortiz | `lena.ortiz@demo.maternalcare.app` | clinician | The portal, with Ayesha and Nusrat under her care. |

Passwords by role:

| Role | Password |
|---|---|
| mother | `demo-mother-2026` |
| clinician | `demo-clinician-2026` |
| admin | `demo-admin-2026` |

The other seeded mothers — Nusrat, Farhana, Priya, Maria, Shirin — use the
same mother password and their `firstname.lastname@example.com` address.
They exist to populate a clinician's caseload. The sign-in screen lists the
accounts in development and hides them in production.

> These are demo credentials for a database of invented people. If this is
> ever pointed at real records, every one of these accounts has to go first —
> a known password on a medical record is the whole problem.

Each dashboard is different, so signing in as each is the fastest way to see
what the app actually does. Sign out from the account menu, top right.


**The website**

<p align="center">
  <img src="https://github.com/user-attachments/assets/2b597b9e-525b-47e9-bab9-9ac1322c1180" width="176" alt="Landing">
  <img src="https://github.com/user-attachments/assets/d3cb1e60-37ad-4d4f-a286-bd9411a2f19f" width="176" alt="Vitals: trends, risk, care plan">
  <img src="https://github.com/user-attachments/assets/c7f3869c-df27-4495-859b-00ed4503b74d" width="176" alt="Vaccinations and reminders">
  <img src="https://github.com/user-attachments/assets/c4e874dd-d150-433d-a802-8416926bdd79" width="176" alt="Doctor: book, message, documents">
</p>
<p align="center">
  <img src="https://github.com/user-attachments/assets/a8688744-1792-439e-a008-2ff02acf535c" width="355" alt="Emergency SOS">
  <img src="https://github.com/user-attachments/assets/5228e09e-0245-491e-9e35-da6b26c3eb36" width="355" alt="The clinician's caseload">
</p>


**The Android app**

<p align="center">
  <img src="https://github.com/user-attachments/assets/0d8f8bf2-4e50-4aa1-a85e-c5c538d7339d" width="176" alt="Sign in with a server address">
  <img src="https://github.com/user-attachments/assets/32f292ca-8cee-4727-bb05-6d12ee4af5ef" width="176" alt="The widget card">
  <img src="https://github.com/user-attachments/assets/5c9ff646-1994-4fc6-bd60-1f55befd2930" width="176" alt="A reminder as an Android notification">
  <img src="https://github.com/user-attachments/assets/16954a84-3f58-4d3b-91d3-37aec8947c51" width="176" alt="Risk assessment in the app">
</p>


**The Guardian app**

<p align="center">
  <img src="https://github.com/user-attachments/assets/3c7de2aa-59e7-4c85-a91f-e5059dd1332b" width="176" alt="Pairing">
  <img src="https://github.com/user-attachments/assets/247db076-8fb1-4c25-b1ac-5175bc27dd9c" width="176" alt="Her week and readings">
  <img src="https://github.com/user-attachments/assets/9c20aefb-4f2a-4a7b-9aae-db0664d405aa" width="176" alt="How to help, and what this phone will do">
  <img src="https://github.com/user-attachments/assets/e8b4d62f-0b54-4b19-a7d2-d23479b3f5de" width="176" alt="The SOS takeover">
</p>

---

## The backend

Express 4, no view engine. `app.js` wires the security middleware, mounts
`routes/api.js` at `/api`, serves `frontend/dist` (the website),
`guardian-app/dist` at `/guardian-app/` and `public/` (the APK downloads),
and starts the once-a-minute reminder push and the once-a-day purge of
deleted accounts. `config/db.js` is a `pg` pool with the type parsers set so
dates and numerics come back as the app expects; `config/context.js` holds
the signed-in user per request in an `AsyncLocalStorage`, so Models never
take a `req`.

The Models, one file per concern: `userModel` `authModel` `accountModel`
`intakeModel` `pregnancyModel` `vitalModel` `dailyLogModel` `riskModel`
`mlRiskModel` `guidanceModel` `symptomModel` `childModel` `childLogModel`
`vaccinationModel` `appointmentModel` `doctorModel` `patientModel`
`careEndingModel` `messageModel` `documentModel` `reminderModel`
`pushModel` `sosModel` `guardianModel` `postModel` `contentModel`
`moderationModel` `reportModel` `analyticsModel` `voiceModel`. The schema
is 24 migrations in `db/migrations/` (users, sessions, pregnancies,
children, growth_records, milestones, vitals, daily_logs, child_logs,
symptoms, vaccinations, reminders, reminder_pushes, push_subscriptions,
appointments, appointment_changes, care_terminations, doctors, messages,
documents, sos_alerts, sos_notifications, emergency_contacts, posts,
post_comments, post_hearts, content_reports, articles, account_deletions);
`db/README.md` and `db/SETUP.md` have the notes.

### API

Every route under `/api` needs a signed-in account, **by default** — the
guard is applied once in `routes/api.js` and the exceptions are listed there
(`/auth/*`, `/guardian/*` which carries its own token, `/community/images/*`,
`/doctors/register`). Clinician-only routes add `requireRole('clinician')`.
The full table is the route file itself; the shape:

| Area | Endpoints |
|---|---|
| Session & account | `GET /me` · `PATCH /me` · `/me/language` · `POST /auth/login` `logout` `register` `password` · `GET/DELETE /auth/sessions[/:id]` · `GET /account/export` · `DELETE /account` |
| Profile & onboarding | `GET/PATCH /profile` · `/profile/avatar/:file` · `GET/PUT /onboarding` · `GET /weight-gain` · `GET/PUT /daily-log` |
| Health record | `GET/POST /vitals` · `/symptoms` (list, replace, add, patch, delete, end-entry) · `GET /risk` · `POST /risk/simulate` · `GET /risk/model` · `GET /guidance` · `GET /report.pdf` · `POST /voice/transcribe` |
| Child | `GET /child` · `POST /child/growth` · `PATCH /child/milestones/:id` · `/child/log` · `/child/symptoms` · `GET /vaccinations` · `PATCH/DELETE /vaccinations/:id/done` · `POST /vaccinations/:id/card` |
| Reminders & push | `GET/POST/DELETE /reminders` · `GET /push/key` `status` · `POST/DELETE /push/subscriptions` · `POST /push/test` |
| Care | `GET /doctors` `recommended` `/doctors/:id/slots` `plans` · `GET/POST /appointments` · `POST /appointments/paid` · `PATCH /appointments/:id[/reschedule]` · `DELETE /appointments/:id` · `GET /me/care-team` · `/care-endings…` · `GET/POST /messages…` · `GET/POST/DELETE /documents…` |
| SOS & guardians | `GET/POST /sos` · `POST /sos/:id/close` · `PATCH /sos/emergency-number` · `GET/POST/DELETE /guardians[/:id]` · `GET /guardian/:token` `vitals` `alert` · `POST /guardian/:token/ack` · `GET /network` |
| Community | `GET/POST /community/posts` · `POST …/:id/comments` `heart` · `POST /community/:target/:id/report` · `GET /community/week-group` |
| Clinician | `GET /patients[/:id]` `reminders` `symptoms` `guidance` `risk` `documents` `report.pdf` · `POST /patients/:id/reminders` `documents` · `GET /analytics` · `GET/PATCH /me/doctor` · `GET /doctors/:id/appointments` `threads` `upcoming` `sos` `care-endings` · `POST /doctors/:id/messages` · `/moderation/reports` `count` · `POST /moderation/:target/:id/resolve` |

Quick check that the process and the database are up (answers for nobody,
no session needed — it is also Render's health check):

```bash
curl http://localhost:3000/api/auth/session
```

### Security

What the server does for every request, and where each piece lives. Each one
is checked by a script against the running server rather than assumed; the
model suite (`npm run db:test`) covers the session rules.

| Concern | What happens | Where |
|---|---|---|
| **Headers** | Helmet, plus a Content-Security-Policy written for this client: scripts and styles from this origin only (no `unsafe-inline` — framer-motion's one inline `<style>` gets a per-request **nonce**), fonts from Google, no other site may frame the app, a Permissions-Policy that leaves only microphone and geolocation on. API responses are `Cache-Control: no-store`. | `middleware/headers.js` |
| **TLS** | With `NODE_ENV=production`, plain-http GETs are redirected to https and every other method is refused; HSTS is sent for a year. Terminate TLS at a proxy (`TRUST_PROXY`, default 1) or in this process (`TLS_KEY_FILE` / `TLS_CERT_FILE`). Development is left on http. | `middleware/tls.js`, `app.js` |
| **CORS** | One trusted-origin list: the two Vite dev ports (plus private-network addresses on them) in development; **only** `CLIENT_ORIGIN` in production, and nothing at all when it is unset — the built client is served from this origin. Guardian routes answer `*` without credentials; their link token is the credential. The Android app's WebView origin (`https://localhost`) is answered **without credentials**, and only for requests that carry the app's own headers — the origin alone earns nothing. | `config/origins.js`, `middleware/cors.js` |
| **CSRF** | Every POST/PUT/PATCH/DELETE must come from us: `Sec-Fetch-Site` same-origin, or a trusted origin. Cross-site and same-site-other-port writes are 403 — the second is what `SameSite=Lax` alone does not stop, and what a shared university host looks like. Scripts with neither header pass; there is no victim to forge. No token to mint or send back. The app's requests pass too, for the same reason: they are never answered on a cookie (next row). | `middleware/csrf.js` |
| **Sessions** | 256-bit random token in an `httpOnly`, `SameSite=Lax` cookie (`Secure` + `__Host-` prefix in production); the table stores its **SHA-256**, never the token. Fourteen days absolute, **idle limit** of 7 days (12 hours for clinicians). Every account can see where it is signed in and end any other session — profile panel → *Where you're signed in*. A password change ends every other session. **The Android app** cannot use the cookie — its WebView is a different site from the API — so it sends `X-Client: android`, is handed the *same* token in the sign-in body (and no cookie), keeps it in app-private storage, and presents it as `Authorization: Bearer`. A request marked as the app's is answered on that header alone; a cookie beside it is ignored. Its sessions are listed as *MaternalCare+ app on Android*. | `models/authModel.js`, `middleware/session.js`, `frontend/src/lib/native.ts` |
| **Throttling** | Wrong passwords are counted per address (30 / 15 min) and per account (10 / 15 min) on sign-in, password change and account deletion; registrations 20 / hour per address. Successful sign-ins do not count. | `middleware/rateLimit.js` |
| **Passwords** | scrypt, N=2¹⁷ — see *Signing in* above. | `models/authModel.js` |
| **Uploads** | Prescriptions, chat photos, vaccination cards and avatars are stored under `data/uploads` as `<uuid>.<ext>` with the extension taken from an allow-list of MIME types, and streamed back only by a name shaped like one a model wrote — so `..` and friends can never name a directory. Documents are served behind the session; community images by their unguessable name. | `config/uploads.js` |
| **Dependencies** | `npm audit` is clean; `qs` (Express's default query parser, two advisories) is not used — `req.query` is parsed by Node's own `querystring`, and the urlencoded body parser is gone. | `package.json`, `app.js` |

The boot banner prints the posture in one line, so a deployment can be read
off the console:

```
  headers: helmet + CSP  ·  TLS: enforced (trusting the proxy for X-Forwarded-Proto)
  CORS: same-origin only  ·  CSRF: origin-checked writes  ·  cookie: __Host-mc_session
  sessions: 14 days, idle 7 days (clinicians 12 hours)  ·  sign-in: rate-limited
```

**Terms & privacy.** One document, `frontend/src/data/terms.ts`, describing
what the application actually does. Registration refuses to proceed without
the version it showed (`users.terms_version` / `terms_accepted_at`); both
portals open the same document under **Privacy & data**; it is a page at
`/terms`. Deleting an account re-checks the password, closes it after seven
days (`db/purge-deleted.js`, run daily), and forgets every push subscription.

### Push notifications

Reminders reach browsers as push notifications with the tab closed.
`models/pushModel.js` checks every minute for reminders that have fallen
due, computes today's occurrence for daily and weekly ones, records each
occurrence as sent so nothing is sent twice, encrypts each message to the
device's own keys (`web-push`, VAPID) and posts it to the browser's push
service, which cannot read it. A device the service reports gone is
forgotten. Keys: `VAPID_*` in `.env.example` — make one pair once with
`npx web-push generate-vapid-keys` and keep it, because every subscription is
bound to the public key. (The Android app uses local alarms instead and
needs none of this.)

### Deploying

Set `NODE_ENV=production` behind a TLS-terminating proxy, build the client
(`npm --prefix frontend run build`) so this process serves it on one origin,
and leave `CLIENT_ORIGIN` unset unless the client is hosted elsewhere.
`.env.example` documents every variable.

**Render:** [render.yaml](MaternalCare-WebApp/render.yaml) is a Blueprint for exactly that —
push the repository to GitHub, *New → Blueprint*, pick the repo, and paste
`DATABASE_URL` and a VAPID key pair when asked. Two limits of the free plan,
both explained in the file: uploaded files live on a disk that is wiped on
every deploy (a persistent disk fixes it, from the Starter plan), and a
sleeping instance delays reminder pushes and the daily purge.

---


## Checking the code

```bash
npm run db:check                          # the database is reachable and shaped as the migrations say
npm run db:test                           # the model suite (against a fresh seed — see the summary it prints)
npm run api:audit                         # exercises every route with real payloads (writes are re-read, then undone)
npm --prefix frontend run lint            # ESLint: TypeScript, React Hooks, Fast Refresh
npm --prefix frontend run build           # type-checks (tsc -b) and bundles
npm --prefix guardian-app run build       # the same for the guardian app
npm run ml:test                           # the classifier's unit conversion and clamping
```

## Tech stack

Node.js 22 · Express 4 · PostgreSQL (Supabase, `pg`) · helmet · web-push · pdfkit ·
React 18 · TypeScript · Vite · Tailwind CSS · Framer Motion · Recharts · Lucide · react-router ·
Capacitor 6 (Android) · Python 3.11 · FastAPI · scikit-learn

Django, FastAPI-in-the-main-app and Flask are **not** used; the only Python is the optional classifier.
