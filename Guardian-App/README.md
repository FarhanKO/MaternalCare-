# Guardian — the companion app for the people she trusts

Part of [MaternalCare+](../README.md). A mother nominates the people who
should be reached in an emergency — her husband, her mother, a brother, her
obstetrician. **Guardian** is the small app those people install. It shows
them how she is doing, what she may be struggling with and what they can do
about it — and the moment she presses SOS, it takes over their phone with a
full-volume alarm, her location and a route to her.

App: .../blob/main/Guardian-App/main-app/guardian.apk

<p align="center">
  <img src="https://github.com/user-attachments/assets/a83fe6de-3089-4a6b-8afd-dd7e2d8bd7a6" width="230" alt="The guardian's dashboard: her week, her latest readings, and what to do about them">
  <img src="https://github.com/user-attachments/assets/daef171e-98fc-4883-ab5c-8c7aec0be718" width="230" alt="Guidance cards and the honest per-phone capability list">
  <img src="https://github.com/user-attachments/assets/d1bd794d-8653-4559-91f2-a9231f6feb57" width="230" alt="The SOS alarm waking a sleeping phone through a full-screen intent">
</p>
<p align="center"><sub>Real screenshots from the built APK (<code>public/downloads/guardian.apk</code>) on an Android 17 emulator, paired to a local server.</sub></p>

---

## Contents

- [What a guardian sees](#what-a-guardian-sees)
- [How the SOS reaches them, end to end](#how-the-sos-reaches-them-end-to-end)
- [Pairing — no account, no password](#pairing--no-account-no-password)
- [Where it sits in the architecture](#where-it-sits-in-the-architecture)
- [The API it talks to](#the-api-it-talks-to)
- [What each platform can actually do](#what-each-platform-can-actually-do)
- [The native Android pieces](#the-native-android-pieces)
- [Running it](#running-it)
- [Building the Android APK](#building-the-android-apk)
- [Testing on a real phone](#testing-on-a-real-phone)
- [Project layout](#project-layout)
- [Known gaps](#known-gaps)

---

## What a guardian sees

One screen, deliberately. A guardian is not a clinician and does not get her
symptom journal, her messages with her doctor, her documents or her clinical
notes — only what helps them help her.

| Block | What it shows | Where it comes from |
|---|---|---|
| **Header** | Her name, the guardian's relation to her ("You are her brother"), and a status badge: *Settled*, *Worth watching* or *Needs attention*. | `guardianModel.overview()` — the badge is derived from the guidance cards underneath it, never from a separate threshold table, so the badge and the list never disagree. |
| **Pregnancy card** | Week, days to go, a progress bar to week 40, the due date. | Her pregnancy's LMP; week is computed on the server so every guardian sees the same number she does. |
| **Her latest readings** | Blood pressure, glucose, weight and temperature — the last value, with a sparkline of the last twelve. | `GET /guardian/:token` for the latest, `GET /guardian/:token/vitals` for the series. |
| **How you can help** | Cards phrased for the person beside her: *what she may be facing* and *something concrete to do*. Urgent (red), watch (amber) or info (blue). | `guardianModel.insight()` — built from her own readings and logged symptoms, not generic pregnancy advice. Examples: BP ≥ 140/90 → "sit and rest on her left side, reach her doctor today"; a symptom logged for 4+ days → "ask how it is today rather than whether it is better". There is always a stage-based card, so a good week still gives them something useful. |
| **Turn on alerts** | Asks for notification permission so an SOS reaches them when the app is closed. On iPhone it is disabled until the app is added to the Home Screen, and says so. | `Notification.requestPermission()` |
| **What this phone will do** | A per-device capability list with a green/amber/grey dot for alarm sound, vibration, screen wake, alerts while closed, ringing through silent mode. | `lib/alert.ts → capabilities()` — feature-detected live, not assumed. |
| **Call 999** | A `tel:` link to her configured emergency number. | `emergencyNumber` from her SOS settings. |

<p align="center">
  <img src="https://github.com/user-attachments/assets/910138ce-8f64-4260-aff1-9ebf0241f7a5" width="300" alt="The full guardian dashboard, top to bottom">
</p>

## How the SOS reaches them, end to end

```
 Mother's app / site                  Express API (+ Postgres)              Guardian app
 ─────────────────────                ─────────────────────────             ────────────────────────────
 taps SOS ─► 5 s countdown            POST /sos                             polls GET /guardian/:token/alert
   (cancel any time)          ──────► sos_alerts row: location,             · every 12 s while quiet
 location is attached                 accuracy, triggered_at                · every 5 s once an alert is live
 guardians + doctor listed            sos_notifications per contact         · APK: SosWatchService every 20 s,
                                                                              app closed, screen off
                                                                      ◄───── alert seen for the first time:
                                                                            ▸ APK: STREAM_ALARM siren + vibration,
                                                                              full-screen intent wakes the phone
                                                                            ▸ web/PWA: WebAudio siren, vibration,
                                                                              flashing red screen, notification
                                                                            guardian taps "I'm on my way"
                                      POST /guardian/:token/ack ◄───────────
 mother sees who is coming ◄────────  ack recorded on the notification
 marks herself safe ──────────────►   POST /sos/:id/close
                                      alert cleared                  ────► next poll: alarm stops, screen returns
```

The SOS screen itself:

<p align="center">
  <img src="https://github.com/user-attachments/assets/99a6d67f-2493-4fce-8d03-80e9268c9b67" width="230" alt="The SOS takeover screen inside the app">
  <img src="https://github.com/user-attachments/assets/83a1570d-fd32-4add-911e-7c140bb62695" width="230" alt="After tapping I'm on my way">
  <img src="https://github.com/user-attachments/assets/d75eb3a3-e50a-4883-a9d2-ffbeacaf83e4" width="420" alt="The mother's side: the SOS dialog on the site, with the guardian-app links">
</p>

- **It takes the whole screen.** A pulsing full-bleed red that cannot be
  mistaken for an ordinary notification — on iPhone, where there is no
  vibration to lean on, the visual carries the urgency.
- **Where she is.** Latitude/longitude, the accuracy the phone reported, a
  **Directions** button (Google Maps on Android, Apple Maps on iPhone) and
  **See on map** (OpenStreetMap).
- **Call** her emergency number, **I'm on my way** (acknowledges — she and
  the other guardians see it), **Silence the alarm** (stops the sound but
  keeps the screen).
- **"Raised 33s ago"** ticks without re-fetching.
- On the APK the alarm is native; on the web `lib/alert.ts` synthesises a
  two-tone siren with WebAudio and vibrates in a long emergency pattern. iOS
  refuses to start audio that no gesture began, and an SOS arrives from a
  poll — so the first touch anywhere in the app unlocks the audio context
  and plays a silent buffer to keep it alive. Without that the alarm is
  simply mute on iPhone.

## Pairing — no account, no password

A guardian never logs in. From her **SOS → Send links** screen the mother
sends each person a private link:

```
maternalcare://guardian/?t=<token>&api=<http://host:3000/api>
```

- `t` is a 24-character random token (`crypto.randomBytes(18)`, base64url)
  stored on that guardian's row in `emergency_contacts.access_token`. **It is
  the credential** — anyone holding it can read her wellbeing summary — and
  the mother's app says so beside it.
- `api` is the server address. **It is never compiled into the APK**: inside
  an app, `localhost` means the phone itself, so a baked-in address would
  guarantee the app could never reach the server. The address travels in the
  link, is stored next to the token, and falls back to the host the page was
  served from. One APK therefore works against a laptop on the wifi, a college
  server or a real deployment with no rebuild. If a link carries an address
  the phone cannot see, the error screen has a field to correct it.
- Opening a `maternalcare://` link launches the installed APK directly
  (`CapacitorApp.getLaunchUrl` / `appUrlOpen`). An `http://` link may open in
  the browser instead, so the pairing screen also accepts the full link, or
  just the code, pasted in. The server strips a URL down to the token if a
  whole link is pasted (`guardianModel.resolve`).
- The first successful request marks the contact `app_linked`, which the
  mother's SOS screen shows as *Android ready* / paired.

<p align="center">
  <img src="https://github.com/user-attachments/assets/910db541-e04a-46a7-8f00-11f4366f643a" width="230" alt="The pairing screen, waiting for a link or code">
  <img src="https://github.com/user-attachments/assets/b9321d2c-e86d-4797-b995-f4613cbf108b" width="230" alt="The same screen in a browser">
</p>

The browser companion (PWA) lives at
`<img width="720" height="1604" alt="guardian-sos" src="https://github.com/user-attachments/assets/6c6e52ab-0c02-47fa-9faf-8aee22c6afe8" />://<host>:3000/guardian-app/?t=<token>&api=<…>` once the bundle has been
built; on iPhone it is added to the Home Screen with **Share → Add to Home
Screen**.

## Where it sits in the architecture

The guardian app is a **third View** over the one shared Model layer. It
holds no domain logic of its own; `src/lib/api.ts` is transport only — it
carries what the Model decided and never interprets it.

| Layer | Lives in | Notes |
|---|---|---|
| **Model** | [`../models/guardianModel.js`](../models/guardianModel.js) | Resolves the token, decides what a guardian may see, derives her status, writes the "what she may be facing / how to help" insight from her vitals and logged symptoms. Reads `emergency_contacts`, `users`, `pregnancies`, `vitals`, `symptoms`, `sos_alerts`. |
| **Controller** | [`../controllers/api/guardianApiController.js`](../controllers/api/guardianApiController.js) | Thin. Resolves the token, returns 404 for anything unknown. |
| **Routes** | [`../routes/api.js`](../routes/api.js) | `/guardian/*` is one of the four public exceptions to the "every route needs a session" guard — the token is its credential. CORS answers `*` on these routes, without credentials. |
| **View** | this folder | React + TypeScript + Vite + Tailwind; Capacitor wraps the same bundle into the APK. |

The other Views are the mother/clinician SPA in [`../frontend`](../frontend/README.md)
and its Android build ([`../frontend/android`](../frontend/android/README.md)).
All of them read the same models and the same PostgreSQL database.

## The API it talks to

| Method | Endpoint | Returns |
|---|---|---|
| `GET` | `/api/guardian/:token` | Everything the home screen needs in one call: `guardian {name, relation}`, `overview {motherName, week, dueDate, daysToGo, status, lastReadingOn, vitals}`, `insight[]`, the active `alert` (or null), `emergencyNumber`. |
| `GET` | `/api/guardian/:token/vitals` | The last 12 readings, for the sparklines. |
| `GET` | `/api/guardian/:token/alert` | Just the active alert — small and fast, because it is polled. |
| `POST` | `/api/guardian/:token/ack` | "I'm on my way." Recorded against this guardian's notification. |

An unknown or revoked token is a 404 on all four. Removing a guardian from
her SOS screen deletes the row, and with it the token.

## What each platform can actually do

This matters more than usual, because a guardian relying on an alarm that
never sounds is worse off than one who knows to keep the app open. The
dashboard's capability panel says which of these *this* phone will do.

| | Android APK | Android PWA | iPhone (installed PWA) |
|---|---|---|---|
| Dashboard, vitals, guidance | yes | yes | yes |
| Alarm while app is open | yes | yes | yes |
| Vibration | yes | yes | **no** — Safari has never implemented the Vibration API |
| Alarm while app is closed | yes | notification only | notification only, iOS 16.4+ |
| Wakes a sleeping / locked phone | yes | no | no |
| **Rings through silent / Do Not Disturb** | **yes** | no | no |

On iPhone none of the bottom rows is possible from the web. Overriding the
ringer needs Apple's *critical alert* entitlement, granted only to a native
app on request; building that `.ipa` needs a Mac with Xcode
(`npx cap add ios` generates the project). Until then iPhone guardians use
the installable PWA and the app leans on what iOS does allow: a full-volume
alarm while open, a full-screen flashing alert, and a screen wake lock.

## The native Android pieces

The web layer stays in charge of what the guardian sees. The Java in
`android/app/src/main/java/plus/maternalcare/guardian/` exposes only the
things a browser genuinely cannot do, through one Capacitor plugin
(`GuardianPlugin`, reached from `src/lib/native.ts`):

| File | What it does |
|---|---|
| `SosWatchService.java` | A **foreground service** that polls `/alert` every 20 seconds while the app is closed, holding a partial wake lock. Without Firebase there is no push channel and Android will not let a background app poll reliably; the persistent notification a foreground service requires is a fair trade — it also tells the guardian, truthfully, that the watch is running. Started by the web layer as soon as the dashboard loads (`startNativeWatch`), with the token, API base and her name kept in `SharedPreferences`. |
| `SosAlarm.java` | The alarm itself. Audio on **`STREAM_ALARM` with `USAGE_ALARM`**, which Android exempts from the ringer switch and from Do Not Disturb; a notification channel with `setBypassDnd(true)` and a **full-screen intent**, which wakes the device and shows the alert over the keyguard; a repeating vibration pattern. |
| `AlarmActivity.java` | The screen the full-screen intent opens, over the lock screen (`showWhenLocked`, `turnScreenOn`, keyguard dismissed). Built in code rather than XML so it cannot fail to inflate — this is the one screen that has to appear whatever state the app is in. |
| `BootReceiver.java` | Restarts the watch after a reboot, but only if the app was paired and running. |
| `GuardianPlugin.java` | The bridge: `startWatch`, `stopWatch`, `startAlarm`, `stopAlarm`, `requestBatteryExemption` (so the watch survives Doze), `capabilities`. |
| `MainActivity.java` | Registers the plugin before the WebView loads and creates the notification channels. |

Permissions declared in the manifest, and why: `INTERNET`, `VIBRATE`,
`WAKE_LOCK`, `POST_NOTIFICATIONS`, `USE_FULL_SCREEN_INTENT`,
`FOREGROUND_SERVICE` + `FOREGROUND_SERVICE_DATA_SYNC`,
`RECEIVE_BOOT_COMPLETED`, `ACCESS_NETWORK_STATE`,
`REQUEST_IGNORE_BATTERY_OPTIMIZATIONS`. Nothing for location, camera,
contacts or storage — the app has no use for them.

Every native call in `src/lib/native.ts` degrades to the web behaviour when
the plugin is absent, so the same React code runs in a browser, an installed
PWA and the APK.

## Running it

The backend must be running on port 3000 (see the [root README](../README.md#running-the-project)).

```bash
cd guardian-app
npm install
npm run dev          # http://localhost:5174
```

Then open a pairing link. The fastest way to get one is to sign in as a
mother on the main site, open **SOS → Guardians → Send links**, and copy a
link — or read a token straight from the API while signed in
(`GET /api/guardians`) and open:

```
http://localhost:5174/?t=<token>&api=http://localhost:3000/api
```

In development the API accepts requests from `localhost:5173`,
`localhost:5174` and any private-network address on those ports, so the dev
server can be opened on a real phone too (`vite` listens on all interfaces).

## Building the Android APK

Needs a JDK and the Android SDK; Android Studio ships both.

```bash
npm run apk
```

That runs `tsc -b && vite build`, `cap sync android`, `gradlew assembleDebug`,
and copies the result from `android/app/build/outputs/apk/debug/app-debug.apk`
to `../public/downloads/guardian.apk` — which the running server serves at
`/downloads/guardian.apk`, and which the mother's SOS screen links to as
**Android app**.

The debug build is signed with the standard debug key and is fine for
sideloading. A release build needs your own keystore. APKs are build
artifacts and gitignored, so a fresh clone has to build one before the
mother's **Android app** button has anything to serve.

`capacitor.config.json`: `appId` `plus.maternalcare.guardian`, `webDir`
`dist`, `androidScheme: https` with `cleartext: true` and
`allowMixedContent` so the `https://localhost` WebView may call a plain-http
laptop.

## Testing on a real phone

Start the mother's frontend with the machine's wifi address, so the links it
generates point somewhere the phone can reach:

```bash
cd frontend && VITE_API_URL=http://192.168.0.12:3000/api npm run dev
```

Substitute your own address (the SOS screen shows the ones this machine has,
from `GET /api/network`). On an emulator the host machine is `10.0.2.2`, so
the link becomes `…&api=http://10.0.2.2:3000/api`.

To raise a test SOS without a second phone, sign in as the mother on the
site and press the SOS button, or from a signed-in browser console:

```js
await fetch('http://localhost:3000/api/sos', { method: 'POST', credentials: 'include',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ lat: 23.7806, lng: 90.4074, accuracy: 25 }) });
```

and stand it down with `POST /api/sos/:id/close` `{ "status": "safe" }`, or
the stand-down button on her SOS screen.

## Project layout

```
guardian-app/
├── src/
│   ├── App.tsx                 pairing screen, error screen, the polling loop, alarm on/off
│   ├── components/
│   │   ├── Dashboard.tsx       the one screen: overview, vitals, guidance, capabilities
│   │   └── SosScreen.tsx       the full-screen takeover
│   ├── lib/
│   │   ├── api.ts              the four endpoints; token + API base in localStorage
│   │   ├── alert.ts            WebAudio siren, vibration, wake lock, capability detection
│   │   ├── native.ts           the Capacitor bridge, inert in a browser
│   │   └── cn.ts
│   └── index.css               Tailwind + the glass utility
├── public/
│   ├── manifest.webmanifest    installable PWA
│   ├── sw.js                   service worker: caches the shell only — never her readings
│   └── guardian-icon.svg
├── android/                    Capacitor project + the native pieces above
├── scripts/copy-apk.mjs        copies the built APK into ../public/downloads
├── capacitor.config.json
└── vite.config.ts              base './' so the bundle works both in the WebView
                                and mounted by Express at /guardian-app/
```

## Known gaps

- **The capability panel understates the APK.** `Dashboard.tsx` builds the
  list from `lib/alert.ts` (web feature detection) and does not consult
  `nativeCapabilities()` from `lib/native.ts`, so inside the APK the panel
  still shows *Rings through silent mode — needs the native build* even though
  the native build is exactly what is running (visible in the screenshot at
  the top). The alarm itself works; only the list is wrong.
- **Polling, not push.** 12 s / 5 s in the web layer and 20 s in the
  foreground service. Fine on wifi, and honest about battery; a deployment
  at scale would want a push channel.
- **No iOS build** can be produced on Windows — see the platform table.
