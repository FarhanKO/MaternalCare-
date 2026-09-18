# MaternalCare+ — Android app

The mother and clinician portals as an installable Android app. It is the
**same React client** as the website — built from
[`../MaternalCare-Webapp/frontend`](../MaternalCare-Webapp/frontend) — wrapped in a
[Capacitor](https://capacitorjs.com) WebView, with a home-screen widget and
the native plugins the web cannot offer. Nothing in this folder is UI: fix
the site and the app is fixed with it.

The server address is **compiled in**, so the app connects on its own; the
sign-in screen asks for an email and a password, nothing else.

```
MaternalCare-App/
├── android/                 the Android project (Gradle, the widget, the plugins)
├── capacitor.config.ts      webDir points at the Webapp's native build
├── scripts/build-apk.mjs    builds the web client, syncs it in, runs Gradle
└── .env                     API_URL — the server this build talks to
```

## Building

Needs Android Studio (for its SDK and JDK) and the Webapp folder beside this
one (or `WEBAPP_DIR` in `.env`).

```bash
npm install
cp .env.example .env        # set API_URL — the laptop's wifi address, or the deployed site
npm run apk
```

`npm run apk` builds `../MaternalCare-Webapp/frontend/dist-native` with the
address baked in, syncs it into `android/`, runs Gradle, and copies the result
to `../MaternalCare-Webapp/public/downloads/maternalcare.apk`, which the
running server serves at `/downloads/maternalcare.apk`.

To run on a connected phone or emulator from Android Studio instead:
`npm run sync`, then `npm run open`.

## Changing the server

Edit `API_URL` in `.env` and build again. A laptop on the wifi is
`http://192.168.0.249:3000/api` (the address `ipconfig` shows for Wi-Fi); the
deployed site is `https://<your-host>/api`. The address lives in the APK, so
each build is for one server.

## How the app signs in

Its WebView is a different site from the API, so a session cookie cannot be
used. The app sends `X-Client: android`, receives the session token in the
sign-in response, keeps it in app-private storage and presents it as
`Authorization: Bearer`. The server side of that is `middleware/session.js`
in the Webapp; the app side is `frontend/src/lib/native.ts`.

iOS is the same code with `npx cap add ios`, but building it needs a Mac.
