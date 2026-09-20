# MaternalCare+ 🤍

Maternal & child health monitoring platform — **MVC architecture**
CSE470 Software Engineering · Summer 2026 · Section 2

Pregnancy tracking, symptom journalling with voice input, appointments & reminders,
maternal vitals with automated alerts, WHO child-growth curves, vaccination scheduling,
AI risk classification, emergency SOS, knowledge base + community, and a doctor portal.

---

## Architecture

**One Model layer, one View layer.** Express holds the Models and Controllers and
exposes them as a JSON API; the React SPA is the View that consumes it. An
earlier server-rendered EJS View was removed — it predated authentication and
served patient records to anonymous requests.

```
MaternalCare-Webapp/
├── app.js                  # entry point — security middleware, the API, the built client
├── config/
│   ├── db.js               # PostgreSQL pool (Supabase) and the type parsers
│   ├── context.js          # per-request user, via AsyncLocalStorage
│   ├── origins.js          # which browser origins are trusted (CORS + CSRF)
│   └── uploads.js          # stored files on their way back out, safely
├── middleware/             # session, csrf, cors, headers, tls, rateLimit
├── models/                 # MODEL — data access + domain logic, one file per concern
│   ├── userModel.js  authModel.js  pregnancyModel.js  vitalModel.js  riskModel.js
│   ├── childModel.js  vaccinationModel.js  appointmentModel.js  doctorModel.js
│   ├── symptomModel.js  reminderModel.js  messageModel.js  documentModel.js  …
│   └── i18n/               # Bangla for the server-composed text
├── controllers/api/        # CONTROLLER — one thin JSON controller per model
├── routes/api.js           # the route table; every route is guarded by default
├── db/                     # migrations, seeds, and the scripts in package.json
├── ml-service/             # the FastAPI risk classifier (optional)
└── frontend/               # VIEW — React + TypeScript SPA (the Android app wraps this build)
    └── src/
        ├── pages/          # route-level screens
        ├── components/     # reusable UI
        ├── hooks/          # useDashboardData — all server I/O
        ├── lib/            # api client, auth, native bridge, health helpers
        ├── i18n/           # English and Bangla
        └── data/           # reference data & types

MaternalCare-App/           # the Android shell — builds from frontend/ above, address compiled in
MaternalCare-Guardian/      # the guardian's companion app (its own React + Capacitor project)
```

---

## Running the project

Requires **Node.js 22+** and a PostgreSQL connection string in `.env`
(see `.env.example`). Python 3.11+ is optional — only the risk model needs it.

### 1. Database

```bash
npm run db:reset && npm run db:seed && npm run db:stages && npm run db:passwords
```

`db:reset` rebuilds the schema from `db/migrations`, `db:seed` fills it,
`db:stages` adds the three life-stage accounts the main seed does not cover,
and `db:passwords` gives every account a password.

### 2. Backend — Express MVC API

```bash
npm start
```

Runs at **http://localhost:3000**.

### 3. Frontend — React dashboard

```bash
npm --prefix frontend install && npm --prefix frontend run dev
```

Runs at **http://localhost:5173**. Start the backend first — the API needs a
session, so the React app will send you to the sign-in page without one.

### 4. Risk model — optional

```bash
npm run ml:serve
```

Runs at **http://localhost:8000**. The app works without it: the risk screen
falls back to the rule engine and says the model is not running. See
[`ml-service/README.md`](ml-service/README.md).

### 5. Android app and Guardian app — separate projects

The Android app is the same React client wrapped by
[Capacitor](https://capacitorjs.com), and it lives next door in
**`../MaternalCare-App`** — the native shell, the widget and a build script,
no UI of its own. It builds from `frontend/` here (`build:native` →
`frontend/dist-native`), with the server address compiled in from its
`.env`, so the app connects on its own and the sign-in screen asks only for
email and password. Its `npm run apk` puts the result at
`public/downloads/maternalcare.apk` here, which the running server serves at
`/downloads/maternalcare.apk`. See that folder's README.

The guardian's companion app is **`../MaternalCare-Guardian`**, likewise its
own project; its build lands at `public/downloads/guardian.apk` and its web
version is served at `/guardian-app` when the folder sits beside this one
(`GUARDIAN_DIR` points elsewhere).

How the app signs in differs from the browser and is described under
*Security → Sessions* below.

**The home-screen widget.** The app carries an Android widget — her week and
days to go, a small message that changes through the day ("Don't forget to
drink water"), the next reminder, and the article written for this week.
Resizable: one row is just the message, two add the week and reminder, three
add the reading; tapping the message shows the next one, tapping anywhere
else opens the app. The mother's dashboard has a **Your home-screen widget**
card (app only) with a live preview, a switch per block, and *Add to home
screen*. The messages live in `frontend/src/data/sweetMessages.ts`; the app
hands the widget a snapshot (`frontend/src/lib/widget.ts`) and the native
side (`../MaternalCare-App/android/…/MaternalCareWidget.java`) works out the week and
picks the message at draw time, so it stays right without the app being
opened.

**What the app does differently from a browser** — all in
`frontend/src/lib/files.ts` and `lib/native.ts`, so screens never branch on
the platform: files the API serves behind the session (documents, chat
photos, vaccination cards, the avatar) are fetched with the session header
and shown from an object URL (`FileImage`); the health report and the
account export go to Android's share sheet instead of a download; a PDF in
the document viewer opens in the phone's own viewer; and the manifest
declares location, camera and microphone so the page's own prompts (SOS
location, photographing a prescription, voice symptom entry) become the
Android ones. The SOS screen asks for location when it opens, so the first
emergency never waits on a permission sheet.

**Reminders in the app** need no push service at all. A WebView cannot
receive browser push, and Firebase would only tell the phone about times it
already knows — so the app schedules each reminder as an Android alarm
itself (`frontend/src/lib/localReminders.ts`, Capacitor Local
Notifications): they fire with the app closed, survive a reboot, and work
offline. The same *Get reminders on this phone* card turns them on, sends a
test, and — from Android 12, where exact alarms are a setting she grants —
offers *Allow exact timing*; a tapped notification opens the reminders tab.
The schedule is rebuilt from her reminders whenever they change and whenever
the app opens.

---

## Signing in

Every account is stored with a **scrypt** hash (N=2^17, r=8, p=1 — OWASP's
recommended minimum). The plaintext below exists only in `db/seed-passwords.js`
and here; nothing in the application stores, logs or returns it.

| Account | Email | Stage / role | What it shows |
|---|---|---|---|
| Ayesha Rahman | `ayesha@example.com` | pregnant | Week 29. The fullest record — appointments, messages, documents, SOS contacts. |
| Amena Chowdhury | `amena@stage.demo` | planning | Pre-conception. No pregnancy, no countdown. |
| Nabila Karim | `nabila@stage.demo` | new mother | Ayaan at seven weeks, with his own daily log. |
| Orpa Das | `orpa@stage.demo` | parent | Rehnuma at two and a half, growth and milestones. |

Passwords by role:

| Role | Password |
|---|---|
| mother | `demo-mother-2026` |
| clinician | `demo-clinician-2026` |
| admin | `demo-admin-2026` |

The other seeded mothers — Nusrat, Farhana, Priya, Maria, Shirin — use the same
mother password and their `firstname.lastname@example.com` address. They exist
to populate a clinician's caseload.

> These are demo credentials for a database of invented people. If this is ever
> pointed at real records, every one of these accounts has to go first — a known
> password on a medical record is the whole problem.

Each of the four dashboards is different, so signing in as each is the fastest
way to see what the app actually does. Sign out from the account menu, top right.

---

## Security

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
| **Dependencies** | `npm audit` is clean; `qs` (Express's default query parser, two advisories) is not used — `req.query` is parsed by Node's own `querystring`, and the urlencoded body parser is gone. | `package.json`, `app.js` |

The boot banner prints the posture in one line, so a deployment can be read
off the console:

```
  headers: helmet + CSP  ·  TLS: enforced (trusting the proxy for X-Forwarded-Proto)
  CORS: same-origin only  ·  CSRF: origin-checked writes  ·  cookie: __Host-mc_session
  sessions: 14 days, idle 7 days (clinicians 12 hours)  ·  sign-in: rate-limited
```

### Terms & privacy

One document, `frontend/src/data/terms.ts`, describing what the application
actually does — the seven-day deletion, who sees what, scrypt, the guardian
link. The registration form opens it (and refuses to register without the
version it showed, recorded as `users.terms_version` / `terms_accepted_at`),
both profile panels open the same document under **Privacy & data**, and it is
a page at `/terms`, linked from the footer.

### The questionnaire

Registration ends in a questionnaire that differs by stage — a pregnant
mother is asked for her last period, history and symptoms; a new mother
about the baby and feeding; a parent about growth and milestones; a woman
planning about cycles and folic acid — and every answer is kept
(`users.dob/height_cm/weight_kg/allergies/intake`, the pregnancy, the child,
and symptoms as real symptom entries). The dashboard's corner button
("Edit due date", "Update *baby*", "Add a measurement", "Update your
details") reopens the same questionnaire **for that stage, on that
question, pre-filled** from `GET /api/onboarding`; a question left as it
was keeps its answer. Saving updates the dashboard and the profile panel
without a reload.

### The clinician's entry

A clinician's profile shows what registration asked — specialty,
qualification, years, phone, licence number, sign-in email — and lets her
change all but the last two (**Your details**), plus her **Caseload**:
capacity and whether she is taking new patients. Those two decide the
directory's open/busy/full badge and the booking button, computed from her
*real* caseload (the same query as her patient list) — `doctors.patients`
was a seed number that said 22 for a clinician with two patients, and is no
longer read. `PATCH /api/me/doctor`.

### Reminders that reach the device

Reminders are delivered as **browser push notifications** — Chrome, Edge,
Firefox, and iOS when the app is added to the home screen — with the tab
closed. **Reminders → *Get reminders on this device* → Turn on**, then
*Send a test* to see one arrive. The server (`models/pushModel.js`) checks
every minute for reminders that have fallen due, computes today's occurrence
for daily and weekly ones, records each occurrence as sent so nothing is sent
twice, encrypts each message to the device's own keys (`web-push`, VAPID) and
posts it to the browser's push service, which cannot read it. A device the
service reports gone is forgotten; deleting the account forgets them all.
Keys: see `VAPID_*` in `.env.example`. (In the Android app, reminders are
local alarms instead — see *Reminders in the app* above.)

### Deploying

Set `NODE_ENV=production` behind a TLS-terminating proxy, build the client
(`npm --prefix frontend run build`) so this process serves it on one origin,
and leave `CLIENT_ORIGIN` unset unless the client is hosted elsewhere.
`.env.example` documents every variable.

**Render:** [`render.yaml`](render.yaml) is a Blueprint for exactly that —
push the repository to GitHub, *New → Blueprint*, pick the repo, and paste
`DATABASE_URL` and a VAPID key pair (`npx web-push generate-vapid-keys`,
made once and kept) when asked. Two limits of the free plan, both explained
in the file: uploaded files live on a disk that is wiped on every deploy
(a persistent disk fixes it, from the Starter plan), and a sleeping
instance delays reminder pushes and the daily account purge.

---

## Key screens

| URL | Screen |
|---|---|
| `localhost:5173/` | Landing page |
| `localhost:5173/register` | Registration (mother / doctor) |
| `localhost:5173/onboarding` | Onboarding questionnaire |
| **`localhost:5173/mother`** | **Mother dashboard — main Sprint 2 deliverable** |
| `localhost:5173/about` | About — scroll-driven story |
| `localhost:5173/doctor` | Clinician portal |

`localhost:3000` serves no pages. It is the API the client fetches from, and it
must be running for any of the above to load data.

---

## API

| Method | Endpoint | Purpose |
|---|---|---|
| `GET` | `/api/me` | Current demo user + pregnancy summary |
| `GET` | `/api/symptoms` | List logged symptoms |
| `PUT` | `/api/symptoms` | Replace the symptom journal |
| `POST` | `/api/symptoms` | Add one symptom |
| `PATCH` | `/api/symptoms/:id` | Update intensity / duration |
| `DELETE` | `/api/symptoms/:id` | Remove a symptom |
| `POST` | `/api/symptoms/end-entry` | End entry — next visit asks "still there?" |
| `GET` | `/api/reminders` | List reminders (`?upcoming=true` to filter) |
| `POST` | `/api/reminders` | Create a reminder |
| `DELETE` | `/api/reminders/:id` | Delete a reminder |

Quick check:

```bash
curl http://localhost:3000/api/me
```

---

## Documentation

- [Proposal audit](docs/PROPOSAL-AUDIT.md) — each proposed feature against what was built
- [Database setup](db/SETUP.md) and the [migration notes](db/README.md)
- [Risk model service](ml-service/README.md)
- [Android app](../MaternalCare-App/README.md) · [Guardian app](../MaternalCare-Guardian/README.md)

## Checking the code

```bash
npm run db:check                          # the database is reachable and shaped as the migrations say
npm run db:test                           # the model suite (against a fresh seed — see the summary it prints)
npm --prefix frontend run lint            # ESLint: TypeScript, React Hooks, Fast Refresh
npm --prefix frontend run build           # type-checks (tsc -b) and bundles
```

---

## Tech stack

Node.js · Express 4 · PostgreSQL (Supabase, `pg`) ·
React 18 · TypeScript · Vite · Tailwind CSS · Framer Motion · Recharts · Lucide

Django, FastAPI and Flask are **not** used.
