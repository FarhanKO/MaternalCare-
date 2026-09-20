# MaternalCare+ — the Android app

Part of [MaternalCare+](../../README.md). The same React client that the
website serves ([`frontend/`](../README.md)) is wrapped by
[Capacitor](https://capacitorjs.com) into an APK a mother or a clinician
installs. **Nothing is written twice**: every screen, every tab and every
chart is the web bundle, running in a WebView against the same Express API.
What *is* different — how the app finds the server, how it stays signed in,
how files and downloads behave, reminders as real Android alarms, a
home-screen widget, the hardware back button — lives in a handful of files
that this README walks through.

<p align="center">
  <img src="https://github.com/user-attachments/assets/ab870e0a-54f7-49b2-9dc5-e82352d2f58d" width="200" alt="Sign in, with the server-address field that only the app shows">
  <img src="https://github.com/user-attachments/assets/349e1a91-645f-494b-ab7d-14ed29f2104f" width="200" alt="The mother's dashboard in the app">
  <img src="https://github.com/user-attachments/assets/2400c3c5-ed35-4b45-b0dc-1c9dfb11d0e2" width="200" alt="The home-screen widget card, app only">
  <img src="https://github.com/user-attachments/assets/88dcde83-60a7-419e-acab-99804bb2a7de" width="200" alt="The widget on the Android home screen">
</p>
<p align="center"><sub>Real screenshots from the built APK (<code>public/downloads/maternalcare.apk</code>) on an Android 17 emulator, pointed at a local server (<code>10.0.2.2:3000</code>).</sub></p>

---

## Contents

- [What it is, in one paragraph](#what-it-is-in-one-paragraph)
- [Installing and signing in](#installing-and-signing-in)
- [What the app does differently from the browser](#what-the-app-does-differently-from-the-browser)
  - [Finding the server](#1-finding-the-server)
  - [Staying signed in — a bearer token, not a cookie](#2-staying-signed-in--a-bearer-token-not-a-cookie)
  - [Files, photos and downloads](#3-files-photos-and-downloads)
  - [Permissions: location, camera, microphone](#4-permissions-location-camera-microphone)
  - [Reminders as Android alarms — no push service](#5-reminders-as-android-alarms--no-push-service)
  - [The home-screen widget](#6-the-home-screen-widget)
  - [Where the app opens, and the back button](#7-where-the-app-opens-and-the-back-button)
- [Screens](#screens)
- [Building the APK](#building-the-apk)
- [Testing on an emulator or a phone](#testing-on-an-emulator-or-a-phone)
- [Project layout](#project-layout)
- [iOS](#ios)

---

## What it is, in one paragraph

`frontend/` is built twice: `npm run build` produces `dist/`, which Express
serves as the website, and `npm run build:native` produces `dist-native/`,
which Capacitor copies into this Android project and loads from
`https://localhost` inside a WebView. `capacitor.config.ts` keeps the two
outputs apart so an APK built against one server address never leaves that
address baked into the bundle the website serves. The app's `appId` is
`plus.maternalcare.app`; the guardian companion is a separate, smaller app
([`guardian-app/`](../../guardian-app/README.md)).

## Installing and signing in

1. Install `public/downloads/maternalcare.apk` — the running server also
   serves it at `/downloads/maternalcare.apk`. It is a debug-signed build,
   fine for sideloading. APKs are build artifacts and gitignored, so a fresh
   clone has to [build one first](#building-the-apk).
2. The sign-in screen asks for a **server address** — the one field a
   browser never shows. `192.168.0.12:3000` for a laptop on the same wifi,
   `10.0.2.2:3000` from an emulator, or a deployed host. It is remembered.
3. Sign in with an account from the [demo list](../../README.md#signing-in)
   — a mother lands on her dashboard, a clinician on the portal.

## What the app does differently from the browser

All of it is in `src/lib/native.ts`, `src/lib/files.ts`,
`src/lib/localReminders.ts`, `src/lib/widget.ts` and
`src/components/native/AppShell.tsx`, so **screens never branch on the
platform**. In a browser every one of these files is inert: `isNative` is
false and each function falls through to the web behaviour.

### 1. Finding the server

Inside an APK, `localhost` is the phone. So the API base cannot be assumed
the way the website assumes "wherever this page came from":

- The address typed on the sign-in screen is normalised by
  `normaliseServerUrl` — `192.168.0.12:3000`, `care.example.org`,
  `https://host/` all become `scheme://host[:port]/api`. A bare address gets
  `http` when it looks like a LAN machine (an IP, or a hostname with no dot)
  and `https` otherwise.
- It is kept in Capacitor **Preferences** (app-private storage the OS does
  not clear the way it may clear a WebView's `localStorage` under pressure),
  read once before the first render (`restoreNative`), and mirrored in
  memory so the API layer can ask synchronously.
- `npm run apk -- --api https://host/api` compiles an address in as the
  default (`VITE_API_URL`); it can still be changed on the sign-in screen.
- `capacitor.config.ts` sets `androidScheme: https`, `cleartext: true` and
  `allowMixedContent: true` so the `https://localhost` page may call a
  plain-http laptop running `npm start`.

### 2. Staying signed in — a bearer token, not a cookie

The website's session is an `httpOnly`, `SameSite=Lax` cookie. The WebView's
origin is `https://localhost`, which makes every call to the server
cross-site, and a cross-site cookie is exactly what `SameSite` exists to
refuse. So:

- The app sends `X-Client: android` on every request.
- On sign-in the server hands the **same** session token back in the
  response body (and sets no cookie). The app keeps it in Preferences and
  presents it as `Authorization: Bearer …` (`credentials: 'omit'`).
- A request marked as the app's is answered on that header alone; a cookie
  beside it is ignored. Its sessions appear in the account panel's *Where
  you're signed in* list as **MaternalCare+ app on Android**, and can be
  ended from any other device.
- CORS answers the WebView origin **without credentials**, and only for
  requests that carry the app's own headers — the origin alone earns
  nothing. The origin-checked CSRF rule passes the app's writes for the same
  reason: they are never answered on a cookie.

Server side this is `middleware/session.js`, `middleware/cors.js` and
`models/authModel.js`; the [root README's security table](../../README.md#security)
has the whole picture.

<p align="center">
  <img src="https://github.com/user-attachments/assets/02f1dbcd-69db-4ded-9124-4ef79dc4a02c" width="230" alt="The account panel in the app, with Where you're signed in">
</p>

### 3. Files, photos and downloads

Files the API serves behind the session — prescriptions and reports, chat
photos, vaccination cards, her avatar — and files the app produces for her to
keep — the PDF health report, the account export. In a browser both are
simple: an `<img>` pointed at the URL carries the cookie by itself, and a
download is `<a download>`. Neither works in the app: a tag cannot send a
bearer header, and the WebView ignores `<a download>` outright. So in
`src/lib/files.ts`:

- `resolveFileUrl` / `useFileUrl` fetch the bytes through the API layer, with
  the header, and hand back an **object URL** for the tag (`FileImage`
  component). Fetched once per path and kept for the session.
- `saveBlob` writes the file to the app's cache (`@capacitor/filesystem`)
  and opens **Android's share sheet** (`@capacitor/share`) — which is how a
  phone "downloads": she picks Files, Drive, a PDF viewer, or a message to
  her partner.
- A PDF in the document viewer opens in the phone's own viewer instead of
  an in-page `<object>`.

### 4. Permissions: location, camera, microphone

The manifest declares `ACCESS_FINE_LOCATION` / `ACCESS_COARSE_LOCATION`,
`CAMERA`, `RECORD_AUDIO` and `MODIFY_AUDIO_SETTINGS`, so the page's own
prompts become Android's: the **SOS** screen's location fix, **Take a
photo** of a prescription, and **voice entry** on the symptom logger. The
SOS screen asks for location the moment it opens, so the first emergency
never waits on a permission sheet.

### 5. Reminders as Android alarms — no push service

On the website a reminder reaches the device as a browser push: the server
works out when each one falls due and sends it (`models/pushModel.js`). A
WebView cannot receive browser push, and the alternative — Firebase Cloud
Messaging — would mean a Firebase project, a server-side sender and a device
token, all to tell a phone about times it already knows.

So in the app the **phone schedules the reminders itself**
(`src/lib/localReminders.ts`, `@capacitor/local-notifications`):

- Each of her reminders becomes an Android alarm. They fire with the app
  closed, survive a reboot, and need no network. A repeating reminder is a
  schedule ("every day at 9:00") the plugin re-arms after each firing; a
  one-off is an exact alarm at its time.
- The schedule is **rebuilt from her reminders whenever they change and
  whenever the app opens**, so the phone never shows a reminder she has
  since deleted.
- What is shown is the same as the server would push: the title, the note
  or a sentence for the kind ("Time for your medicine", "Test due"), the
  brand mark in the status bar (`ic_stat_maternalcare`, brand blue), and a
  tap that opens the reminders tab.
- The **Reminders → *Get reminders on this phone*** card turns them on, sends
  a test, and — from Android 12, where exact alarms are a setting she grants
  (`SCHEDULE_EXACT_ALARM`) — offers **Allow exact timing**; without it
  Android may hold a reminder back a few minutes, and the card says so.

<p align="center">
  <img src="https://github.com/user-attachments/assets/50a1d19b-e8d0-4f39-bf7d-f6725b5eeb15" width="230" alt="The reminders card in the app">
  <img src="https://github.com/user-attachments/assets/46e9268c-8235-4666-9377-68bc2b1a5aa0" width="230" alt="A test reminder arriving in the notification shade">
</p>

### 6. The home-screen widget

Android draws a widget from a native layout, not from the bundle, so the
app's job is to hand the native side everything it needs — one JSON snapshot
— whenever the dashboard has fresh data (`src/lib/widget.ts` →
`WidgetPlugin.java`). The provider (`MaternalCareWidget.java`) keeps the
snapshot in `SharedPreferences` and redraws from it: on its half-hourly
refresh, when she resizes it, and when she taps for the next message.

What it shows, top to bottom — **her week and days to go** with the baby's
size that week, a **small message** that changes through the day ("Small
sips through the day beat one big glass at night", 43 of them in
`src/data/sweetMessages.ts`, each tagged morning / afternoon / evening /
night), the **next reminder**, and **the article written for this week**.

- **Resizable** (`resizeMode="horizontal|vertical"`, min height 40 dp): one
  row is just the message, two add the week and reminder, three add the
  reading. Rows are dropped from the least important up so whatever fits is
  never clipped.
- Tapping the message shows the next one; tapping anywhere else opens the
  app.
- Two things are decided **on the phone at draw time** rather than in the
  snapshot, so a widget that has not been opened for days does not go stale:
  the week and days to go (from her LMP and due date), and which message to
  show (from the hour of the day). `chooseMessage` in `widget.ts` is the
  same rule the Java applies, so the preview in the app shows exactly what
  the widget shows.
- The dashboard's **Your home-screen widget** card (app only) has a live
  preview, a switch per block, a *Next message* button, and **Add to home
  screen** (`requestPinAppWidget` — Android shows its own sheet). The badge
  reads *On your home screen* once one is placed.

<p align="center">
  <img src="https://github.com/user-attachments/assets/bda99c43-3e23-44f9-a424-b3c1be11c72a" width="230" alt="The widget on the launcher, second page">
  <img src="https://github.com/user-attachments/assets/178aab34-f07c-49b8-95a1-95ee8c1b3ede" width="230" alt="The widget card in the dashboard with its live preview">
</p>

### 7. Where the app opens, and the back button

`src/components/native/AppShell.tsx`, mounted only in the app:

- **`AppHome`** — the site opens on its landing page; the app has nothing to
  sell and opens on her portal (`/mother` or `/doctor`), or on sign-in when
  there is nobody to open it for. Nothing renders while the session is being
  checked, to avoid a flash of the wrong screen.
- **`BackButton`** — Android hands the hardware back button to the app
  rather than the WebView, so without this it would close the app from any
  screen. Inside the app it goes back a page; on the screens the app opens
  on (`/`, `/signin`, `/mother`, `/doctor`) it closes the app, which is what
  every other app on the phone does. It also routes a tapped reminder
  notification to the reminders tab.

## Screens

Everything the website has, at phone width — the [web README](../README.md)
describes each tab in full. The bottom **dock** replaces the pill tabs.

<p align="center">
  <img src="https://github.com/user-attachments/assets/0bdc120a-234f-4194-81d6-465a1c1a25e3" width="180" alt="Vitals tab">
  <img src="https://github.com/user-attachments/assets/85ae841b-f952-42fd-8732-70089f42ff27" width="180" alt="Risk assessment: rule engine and trained model side by side">
  <img src="https://github.com/user-attachments/assets/1d63265d-60ca-447c-a72a-f77f7a4fd04a" width="180" alt="The personalised care plan">
  <img src="https://github.com/user-attachments/assets/b0286d44-021d-46af-8b29-125dcfec15fb" width="180" alt="Vaccination record and reminders">
</p>
<p align="center">
  <img src="https://github.com/user-attachments/assets/b09ae24d-7326-4430-823d-34bd1d99de38" width="180" alt="Vaccination scheduler">
  <img src="https://github.com/user-attachments/assets/6d5abcc0-e508-4fe3-8240-59fc0c43b132" width="180" alt="Doctor tab: book, message, documents">
  <img src="https://github.com/user-attachments/assets/cf76b0a9-a0e1-4c4a-aab1-2e977815be44" width="180" alt="Community">
  <img src="https://github.com/user-attachments/assets/87e70112-c3e1-49e2-951c-623e81678d57" width="180" alt="Emergency SOS">
</p>
<p align="center">
  <img src="https://github.com/user-attachments/assets/b6398944-a04a-4b3e-8090-b126c80d8e02" width="180" alt="The clinician portal in the app">
  <img src="https://github.com/user-attachments/assets/64d00a74-25d0-4640-8176-25557dcd6a30" width="180" alt="The clinician's caseload">
</p>

## Building the APK

Needs Android Studio, for its SDK and JDK — nothing else is read from it.
`scripts/build-apk.mjs` finds both where Android Studio puts them when
`ANDROID_HOME` / `JAVA_HOME` are not set, and writes `android/local.properties`
on first run.

```bash
npm --prefix frontend run apk
```

What happens: `tsc -b && vite build --outDir dist-native` → `cap sync android`
→ `gradlew assembleDebug` → the APK is copied from
`android/app/build/outputs/apk/debug/app-debug.apk` to
`public/downloads/maternalcare.apk`, which the server serves at
`/downloads/maternalcare.apk`.

```bash
npm --prefix frontend run apk -- --api https://care.example.org/api   # compile in a default server
```

A release build needs your own keystore; the debug build is fine for
sideloading.

## Testing on an emulator or a phone

| Where the app runs | Server address to type |
|---|---|
| Android emulator on the same machine as `npm start` | `10.0.2.2:3000` |
| A phone on the same wifi | the laptop's LAN address, e.g. `192.168.0.12:3000` — the SOS screen lists this machine's addresses, from `GET /api/network` |
| A deployment | the host name; `https` is assumed |

The backend accepts private-network origins in development, so nothing else
needs configuring. If the app cannot reach the server, the sign-in screen
says so and lets the address be corrected.

The APK's WebView is debuggable: `chrome://inspect` in desktop Chrome (or
`adb forward tcp:9222 localabstract:webview_devtools_remote_<pid>`) attaches
DevTools to the running app.

## Project layout

```
frontend/
├── capacitor.config.ts               appId, webDir dist-native, https scheme + cleartext
├── scripts/build-apk.mjs             the one-command build above
├── dist-native/                      the bundle Capacitor copies (gitignored)
├── src/
│   ├── lib/native.ts                 isNative, server address, session token (Preferences)
│   ├── lib/files.ts                  FileImage object URLs, share-sheet "downloads"
│   ├── lib/localReminders.ts         reminders → Android alarms
│   ├── lib/widget.ts                 the widget snapshot + chooseMessage
│   ├── data/sweetMessages.ts         the 43 small messages
│   ├── components/native/AppShell.tsx  AppHome + BackButton
│   └── components/mother/WidgetSection.tsx / PushNotificationsCard.tsx   the two app-aware cards
└── android/                          ← this folder: the Capacitor project
    └── app/src/main/
        ├── AndroidManifest.xml       permissions, the widget receiver
        ├── java/plus/maternalcare/app/
        │   ├── MainActivity.java     registers WidgetPlugin before the WebView loads
        │   ├── WidgetPlugin.java     update / status / requestPin
        │   └── MaternalCareWidget.java  the AppWidgetProvider: sizes, rows, draw-time week + message
        └── res/
            ├── xml/maternalcare_widget_info.xml   250×110 dp, resizable, 30-min refresh
            ├── layout/widget_maternalcare.xml     the widget rows
            └── drawable/ic_stat_maternalcare.xml  the status-bar mark
```

## iOS

The same code: `npx cap add ios` generates an Xcode project, and the native
bridge already reports `platform === 'ios'`. Compiling an `.ipa` needs macOS
with Xcode and cannot be done on Windows, so there is no iOS build in this
repository. Local reminders and the file/share behaviour are cross-platform
Capacitor plugins; the widget is Android-only.
