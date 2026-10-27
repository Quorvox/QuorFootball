// Сервис-воркер нужен только для уведомлений: кэша и офлайн-режима здесь нет.
self.addEventListener('push', (event) => {
  let d = {};
  try { d = event.data.json(); } catch { /* пустое уведомление */ }
  event.waitUntil(self.registration.showNotification(String(d.title || 'QuorFootball').slice(0, 80), {
    body: String(d.body || '').slice(0, 200),
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    tag: 'workout',
    data: { url: typeof d.url === 'string' && d.url.startsWith('/') ? d.url : '/' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(event.notification.data.url, self.location.origin).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    const open = list.find((c) => 'focus' in c);
    if (!open) return self.clients.openWindow(url);
    return open.navigate(url).then((c) => (c || open).focus());
  }));
});
