/**
 * The Android build of the mother/doctor client.
 *
 * There is no web code in this folder on purpose. The bundle the WebView
 * runs is the same React client the server serves, built next door in
 * ../MaternalCare-Webapp/frontend — one codebase, so a fix on the site is a
 * fix in the app. What this project adds is what only an app can: the
 * native shell (android/, with the home-screen widget), the plugins, and
 * the server address compiled in at build time (scripts/build-apk.mjs).
 *
 * WEBAPP_DIR points at the web project when it does not sit beside this one.
 */
const webapp = process.env.WEBAPP_DIR ?? '../MaternalCare-Webapp';

/** @type {import('@capacitor/cli').CapacitorConfig} */
const config = {
  appId: 'plus.maternalcare.app',
  appName: 'MaternalCare+',
  webDir: `${webapp}/frontend/dist-native`,
  android: {
    // the page is https://localhost; a laptop running `npm start` is http
    allowMixedContent: true,
  },
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
};

module.exports = config;
