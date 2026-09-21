/*
 * MaternalCare+ service worker — push only.
 *
 * It does one thing: turn a push message from the server into a
 * notification, and open the app when the notification is pressed. It
 * caches nothing. An offline cache is a second copy of the application that
 * has to be kept honest, and a stale copy of a health app is worse than a
 * "you are offline" page.
 *
 * The payload is what models/pushModel.js sends: { title, body, kind, at,
 * tag, url }. The time is an ISO timestamp, formatted here — on the device,
 * in its own zone — because the server does not know where she is.
 */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let data = {};
  try { data = event.data ? event.data.json() : {}; } catch { data = { title: 'MaternalCare+', body: event.data?.text() }; }

  const when = data.at ? new Date(data.at) : null;
  const time = when && !Number.isNaN(when.getTime())
    ? when.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    : null;

  const title = data.title || 'MaternalCare+';
  const body = [data.body, time && data.kind !== 'test' ? `Due ${time}` : null].filter(Boolean).join(' · ');

  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: '/icons/notification-192.png',
    badge: '/icons/notification-192.png',
    tag: data.tag || 'maternalcare',
    renotify: Boolean(data.tag),
    timestamp: when ? when.getTime() : Date.now(),
    data: { url: data.url || '/mother?tab=reminders' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/mother', self.location.origin).href;
  event.waitUntil((async () => {
    // an open tab of the app is brought forward rather than a second one opened
    const tabs = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const existing = tabs.find((c) => new URL(c.url).origin === self.location.origin);
    if (existing) {
      await existing.focus();
      if ('navigate' in existing) await existing.navigate(url);
      return;
    }
    await self.clients.openWindow(url);
  })());
});
