// Proactive Work Log Service Worker — RFC 8291 / 8292 Web Push
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch (e) {
    payload = {
      title: "Proactive Work Log",
      body: event.data.text(),
      data: { url: "/proactive-work" },
    };
  }

  const title = payload.title || "Proactive Work Log";
  const options = {
    body: payload.body || "",
    icon: payload.icon || "/kpi/favicon.svg",
    badge: payload.badge || "/kpi/favicon.svg",
    data: payload.data || { url: "/proactive-work" },
    tag: payload.tag || (payload.data?.entryId ? `entry-${payload.data.entryId}` : "proactive-digest"),
    renotify: true,
    actions: payload.actions || [
      { action: "open", title: "Open" },
      { action: "endorse", title: "Endorse" },
    ],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  let targetPath = data.url || "/proactive-work";

  if (event.action === "endorse" && data.entryId) {
    targetPath = `/proactive-work/${data.entryId}?action=endorse`;
  }

  const origin = self.location.origin;
  // Account for Vite / Spring context path (/kpi)
  const fullUrl = new URL(
    targetPath.startsWith("/kpi") ? targetPath : `/kpi${targetPath.startsWith("/") ? targetPath : "/" + targetPath}`,
    origin
  ).href;

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes("/kpi") && "focus" in client) {
          if ("navigate" in client) {
            client.navigate(fullUrl);
          }
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(fullUrl);
      }
    })
  );
});
