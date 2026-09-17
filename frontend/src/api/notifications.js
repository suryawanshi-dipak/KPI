// frontend/src/api/notifications.js
const API_BASE = import.meta.env.VITE_API_BASE || "/kpi/api/v1";

function getHeaders() {
  const token = sessionStorage.getItem("kpi_token");
  const headers = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export async function getBellFeed({ page = 0, size = 20 } = {}) {
  const res = await fetch(`${API_BASE}/notifications?page=${page}&size=${size}`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch notification feed");
  const json = await res.json();
  return json.data; // PagedResponse
}

export async function getUnreadNotificationCount() {
  const res = await fetch(`${API_BASE}/notifications/unread-count`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch unread count");
  const json = await res.json();
  return json.data?.unreadCount || 0;
}

export async function markNotificationRead(id) {
  const res = await fetch(`${API_BASE}/notifications/${id}/read`, {
    method: "PATCH",
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to mark notification as read");
  return res.json();
}

export async function markAllNotificationsRead() {
  const res = await fetch(`${API_BASE}/notifications/mark-all-read`, {
    method: "POST",
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to mark all as read");
  return res.json();
}

export async function getNotificationPreferences() {
  const res = await fetch(`${API_BASE}/notifications/preferences`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to fetch notification preferences");
  const json = await res.json();
  return json.data;
}

export async function updateNotificationPreferences(preferences) {
  const res = await fetch(`${API_BASE}/notifications/preferences`, {
    method: "PUT",
    headers: getHeaders(),
    body: JSON.stringify(preferences),
  });
  if (!res.ok) throw new Error("Failed to update preferences");
  const json = await res.json();
  return json.data;
}

export async function recordPermissionAsked() {
  const res = await fetch(`${API_BASE}/notifications/preferences/permission-asked`, {
    method: "POST",
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to record permission asked");
  return res.json();
}

export async function registerPushSubscription(subscriptionData) {
  const res = await fetch(`${API_BASE}/notifications/subscriptions`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify(subscriptionData),
  });
  if (!res.ok) throw new Error("Failed to register push subscription");
  return res.json();
}

export async function deletePushSubscription(endpoint) {
  const res = await fetch(`${API_BASE}/notifications/subscriptions?endpoint=${encodeURIComponent(endpoint)}`, {
    method: "DELETE",
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to delete push subscription");
  return res.json();
}

export async function getVapidPublicKey() {
  const res = await fetch(`${API_BASE}/notifications/vapid-public-key`, {
    headers: getHeaders(),
  });
  if (!res.ok) throw new Error("Failed to get VAPID public key");
  const json = await res.json();
  return json.data?.publicKey;
}
