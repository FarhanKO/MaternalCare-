import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { MotionConfig } from 'framer-motion';
import App from './App';
import { LanguageProvider } from './i18n';
import { AuthProvider } from './lib/auth';
import { registerWorker } from './lib/push';
import { isNative, restoreNative } from './lib/native';
import './index.css';

/*
 * The service worker that shows push notifications. Registered on every
 * load, not only when she turns notifications on: a device that subscribed
 * last month needs the worker in place today for a message to arrive.
 * Registration is idempotent and never blocks the page.
 *
 * Not in the app: browser push does not reach an Android WebView, and the
 * app will get its notifications another way.
 */
if (!isNative) void registerWorker();

/*
 * The server's Content-Security-Policy allows no inline styles — except one
 * it names per page load, with a nonce it writes into this tag. framer-motion
 * needs it for popLayout, which pins an exiting list item with a <style>
 * element. In development Vite serves the page, there is no policy and no
 * tag, and the nonce is simply undefined.
 */
const cspNonce = document.querySelector('meta[name="csp-nonce"]')?.getAttribute('content') ?? undefined;

/*
 * The app reads its session token and server address from storage before
 * the first render, so the very first request already carries them; in a
 * browser this resolves at once with nothing to read. A promise rather than
 * a top-level await, which the build's oldest supported browsers lack.
 */
void restoreNative().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <MotionConfig nonce={cspNonce}>
        <BrowserRouter>
          {/* auth outermost: the language a screen renders in depends on whose
              account it is, and the guards need to know before anything paints */}
          <AuthProvider>
            <LanguageProvider>
              <App />
            </LanguageProvider>
          </AuthProvider>
        </BrowserRouter>
      </MotionConfig>
    </React.StrictMode>,
  );
});
