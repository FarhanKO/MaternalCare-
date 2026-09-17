import type { CapacitorConfig } from '@capacitor/cli';

/**
 * The Android (and, from a Mac, iOS) build of the mother/doctor client.
 *
 * The same React bundle the Express server serves is wrapped in a WebView;
 * nothing is written twice. What differs at runtime — where the server is,
 * how the session is carried — lives in src/lib/native.ts.
 *
 * `webDir` is a separate output from the web build (see package.json's
 * build:native), so an APK built against one server address never leaves
 * that address baked into the bundle Express serves.
 */
const config: CapacitorConfig = {
  appId: 'plus.maternalcare.app',
  appName: 'MaternalCare+',
  webDir: 'dist-native',
  android: {
    // the page is https://localhost; a laptop running `npm start` is http
    allowMixedContent: true,
  },
  server: {
    androidScheme: 'https',
    cleartext: true,
  },
  plugins: {
    // reminder notifications: the brand mark in the status bar, in brand blue
    LocalNotifications: {
      smallIcon: 'ic_stat_maternalcare',
      iconColor: '#3F66F0',
    },
  },
};

export default config;
