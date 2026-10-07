/*
  SRF CRM service worker — notifications only.

  It exists so a reminder can reach a phone whose CRM tab is closed or whose
  screen is locked: the browser wakes this script when the server sends a push,
  and it puts the notification on screen.

  Deliberately no `fetch` handler and no caching. An app-shell cache would mean
  staff keep running last week's build after a deploy until the cache turns
  over, which for a CRM that issues tax invoices is a worse problem than the
  half-second it saves.
*/

self.addEventListener("install", () => {
  // Take over at once: there is no cached state for an old version to protect.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "SRF Power Machine";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      // One notification per reminder: a repeat replaces the earlier one
      // instead of stacking, and `renotify` makes the replacement buzz.
      tag: data.tag,
      renotify: Boolean(data.tag),
      icon: "/icon-192.png",
      badge: "/badge-72.png",
      data: { url: data.url || "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(
    (event.notification.data && event.notification.data.url) || "/",
    self.location.origin,
  ).href;

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Reuse a CRM tab that is already open rather than piling up new ones.
      for (const client of windows) {
        if (!("focus" in client)) continue;
        await client.focus();
        if ("navigate" in client) {
          try {
            await client.navigate(target);
          } catch {
            // A tab that cannot be navigated is still in front; good enough.
          }
        }
        return;
      }
      await self.clients.openWindow(target);
    })(),
  );
});
