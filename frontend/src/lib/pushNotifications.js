// frontend/src/lib/pushNotifications.js
import {
  getNotificationPreferences,
  recordPermissionAsked,
  getVapidPublicKey,
  registerPushSubscription,
} from "../api/notifications";

export function isPushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

export function getBrowserPermissionState() {
  if (!isPushSupported()) return "unsupported";
  return Notification.permission; // "default", "granted", "denied"
}

export function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function bufferToBase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Ensures the service worker is registered.
 */
export async function registerServiceWorker() {
  if (!isPushSupported()) return null;
  try {
    const swUrl = `${import.meta.env.BASE_URL || "/kpi/"}sw.js`;
    const reg = await navigator.serviceWorker.register(swUrl, { scope: import.meta.env.BASE_URL || "/kpi/" });
    await navigator.serviceWorker.ready;
    return reg;
  } catch (err) {
    console.warn("Service worker registration failed:", err);
    return null;
  }
}

/**
 * Subscribes the current browser to push notifications with the server's VAPID key.
 */
export async function subscribeCurrentBrowser() {
  if (!isPushSupported() || Notification.permission !== "granted") {
    return false;
  }

  try {
    const registration = await registerServiceWorker();
    if (!registration) return false;

    const vapidKey = await getVapidPublicKey();
    if (!vapidKey) return false;

    let subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      const appServerKey = urlBase64ToUint8Array(vapidKey);
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: appServerKey,
      });
    }

    const p256dhKey = subscription.getKey("p256dh");
    const authKey = subscription.getKey("auth");

    if (!p256dhKey || !authKey) {
      return false;
    }

    await registerPushSubscription({
      endpoint: subscription.endpoint,
      p256dh: bufferToBase64Url(p256dhKey),
      auth: bufferToBase64Url(authKey),
      userAgent: navigator.userAgent,
    });

    return true;
  } catch (err) {
    console.warn("Failed to subscribe for web push:", err);
    return false;
  }
}

let checkInProgress = false;

/**
 * Triggered strictly upon user interaction (first entry open or first endorsement).
 * NEVER called on component mount or page load.
 * Checks server-side permissionAskedAt to ensure user is asked at most ONCE across all devices.
 */
export async function triggerPermissionPromptIfFirstTime() {
  if (!isPushSupported() || checkInProgress) return false;
  if (Notification.permission === "denied") return false;

  checkInProgress = true;
  try {
    // 1. Check server-side record — never rely solely on localStorage
    const prefs = await getNotificationPreferences();
    if (prefs?.permissionAsked || prefs?.permissionAskedAt) {
      // If permission was previously asked and user is already granted, refresh subscription silently
      if (Notification.permission === "granted") {
        await subscribeCurrentBrowser();
      }
      return false;
    }

    // 2. Only ask if never asked before
    const permission = await Notification.requestPermission();

    // 3. Immediately persist to server that user was prompted
    await recordPermissionAsked();

    // 4. If granted, complete subscription
    if (permission === "granted") {
      await subscribeCurrentBrowser();
      return true;
    }
    return false;
  } catch (e) {
    console.warn("Error checking or prompting push notification permission:", e);
    return false;
  } finally {
    checkInProgress = false;
  }
}

/**
 * Explicit, button-driven request from the Notification Preferences screen. Unlike
 * triggerPermissionPromptIfFirstTime(), this does NOT check "was this ever asked before" —
 * the click itself is the user asking, so it always shows the browser prompt (browsers require
 * the user gesture from this very click; a prompt can't be deferred and re-shown later).
 * Still records permissionAskedAt server-side (a no-op if already set) so the passive,
 * open-an-entry/endorse trigger doesn't ask again afterward.
 */
export async function enableNotificationsNow() {
  if (!isPushSupported()) return false;
  if (Notification.permission === "denied") return false;

  if (Notification.permission === "granted") {
    return subscribeCurrentBrowser();
  }

  try {
    const permission = await Notification.requestPermission();
    await recordPermissionAsked();
    if (permission === "granted") {
      return subscribeCurrentBrowser();
    }
    return false;
  } catch (e) {
    console.warn("Error requesting push notification permission:", e);
    return false;
  }
}
