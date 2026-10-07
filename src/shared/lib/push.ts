import { http } from "@/shared/api/http";

/**
 * Notifications that reach a device when the CRM is not open on it.
 *
 * The in-app reminder pop-up only exists while the page is on screen. On a
 * phone it rarely is — the screen is locked, or WhatsApp is in front — so a
 * reminder set for 4 pm simply never appeared. Web Push fixes that: the browser
 * registers this device with its vendor's push service, the server sends the
 * reminder there when it comes due, and the service worker (public/sw.js) shows
 * it whether or not the CRM is running.
 *
 * What a person has to do, once per device: tap "Turn on notifications" and
 * allow them. On an iPhone the CRM must first be added to the home screen —
 * Apple only delivers web notifications to installed apps (iOS 16.4+).
 */

export type PushState =
  /** Still finding out. */
  | "checking"
  | "on"
  | "off"
  /** The person, or their browser settings, said no. Only they can undo it. */
  | "blocked"
  /** iPhone/iPad in Safari: works once added to the home screen. */
  | "needs-install"
  /** This browser cannot do it at all. */
  | "unsupported"
  /** The server has no push keys configured, so there is nothing to turn on. */
  | "unavailable";

const ICONS = { icon: "/icon-192.png", badge: "/badge-72.png" };

function isIos() {
  return (
    /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS reports itself as a Mac; the touch points give it away.
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
  );
}

function isInstalled() {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function support(): "ok" | "needs-install" | "unsupported" {
  if ("serviceWorker" in navigator && "PushManager" in window && "Notification" in window) {
    return "ok";
  }
  return isIos() && !isInstalled() ? "needs-install" : "unsupported";
}

let registration: Promise<ServiceWorkerRegistration | null> | null = null;

/** Register the service worker once per page load. Never throws. */
export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return Promise.resolve(null);
  registration ??= navigator.serviceWorker.register("/sw.js").catch(() => null);
  return registration;
}

let serverKey: Promise<string | null> | null = null;

/** The server's public key, or null when it has none (or is an older build). */
function getServerKey() {
  serverKey ??= http
    .get<{ data: { configured: boolean; publicKey: string | null } }>("/push/config")
    .then((res) => (res.data.data.configured ? res.data.data.publicKey : null))
    .catch(() => null);
  return serverKey;
}

/** The key as the bytes `pushManager.subscribe` wants. */
function keyBytes(base64Url: string) {
  const padded = base64Url.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

async function currentSubscription() {
  const reg = await registerServiceWorker();
  return reg ? reg.pushManager.getSubscription() : null;
}

// ── A tiny shared store, so every opt-in prompt on screen agrees ────────────

let state: PushState = "checking";
const listeners = new Set<() => void>();

function setState(next: PushState) {
  state = next;
  listeners.forEach((l) => l());
}

export const pushStore = {
  get: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
};

let checked = false;

/** Work out where this device stands. Safe to call from every prompt. */
export async function checkPush() {
  if (checked) return;
  checked = true;
  try {
    const s = support();
    if (s !== "ok") return setState(s);
    if (!(await getServerKey())) return setState("unavailable");
    if (Notification.permission === "denied") return setState("blocked");
    const sub = await currentSubscription();
    setState(sub && Notification.permission === "granted" ? "on" : "off");
  } catch {
    setState("unsupported");
  }
}

/**
 * Turn notifications on for this device. Must be called from a tap: browsers
 * only show the permission prompt in response to one, and Safari requires the
 * request to be the first thing the tap does — hence permission before any
 * network call.
 */
export async function enablePush(): Promise<PushState> {
  const s = support();
  if (s !== "ok") {
    setState(s);
    return s;
  }

  const permission = await Notification.requestPermission();
  if (permission !== "granted") {
    const next = permission === "denied" ? "blocked" : "off";
    setState(next);
    return next;
  }

  const key = await getServerKey();
  const reg = await registerServiceWorker();
  if (!key || !reg) {
    const next = key ? "unsupported" : "unavailable";
    setState(next);
    return next;
  }
  await navigator.serviceWorker.ready;

  const options = { userVisibleOnly: true, applicationServerKey: keyBytes(key) };
  let sub = await reg.pushManager.getSubscription();
  if (!sub) {
    try {
      sub = await reg.pushManager.subscribe(options);
    } catch {
      // A subscription made against a different server key blocks a new one.
      await (await reg.pushManager.getSubscription())?.unsubscribe();
      sub = await reg.pushManager.subscribe(options);
    }
  }

  await http.post("/push/subscribe", sub.toJSON());
  setState("on");
  return "on";
}

export async function disablePush() {
  const sub = await currentSubscription();
  if (sub) {
    await http.post("/push/unsubscribe", { endpoint: sub.endpoint }).catch(() => undefined);
    await sub.unsubscribe();
  }
  setState("off");
}

/** A notification the person can see arrive, to prove the round trip works. */
export function sendTestPush() {
  return http.post("/push/test");
}

/**
 * On sign-in: if this device already has notifications on, make sure the
 * server files it under whoever is signed in now. Quiet by design.
 */
export async function syncPushSubscription() {
  try {
    if (support() !== "ok" || Notification.permission !== "granted") return;
    const sub = await currentSubscription();
    if (sub && (await getServerKey())) await http.post("/push/subscribe", sub.toJSON());
  } catch {
    // Not worth interrupting anyone over; the prompt offers it again.
  }
}

/**
 * On sign-out: stop sending this device the signed-out person's reminders.
 * The browser keeps its subscription, so the next person to sign in here is
 * picked up by `syncPushSubscription` without being asked for permission again.
 * Capped at a couple of seconds so a slow network can never hold up a log out.
 */
export async function forgetPushOnSignOut() {
  try {
    if (support() !== "ok") return;
    const sub = await currentSubscription();
    if (!sub) return;
    await Promise.race([
      http.post("/push/unsubscribe", { endpoint: sub.endpoint }),
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ]);
  } catch {
    // The row is also dropped the first time a send to it fails.
  } finally {
    checked = false;
    setState("checking");
  }
}

/**
 * Show a notification from the open page, for a device that allowed
 * notifications but has no push subscription.
 *
 * Goes through the service worker because `new Notification()` throws on
 * Android Chrome. Skipped when a subscription exists: the server is about to
 * send this same notification, and two would buzz twice.
 */
export async function notifyFromPage(
  title: string,
  opts: { body: string; tag: string; url: string },
) {
  try {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const reg = await registerServiceWorker();
    if (!reg) return;
    if ("pushManager" in reg && (await reg.pushManager.getSubscription())) return;
    await reg.showNotification(title, {
      body: opts.body,
      tag: opts.tag,
      data: { url: opts.url },
      ...ICONS,
    });
  } catch {
    // The in-app pop-up is still on screen when they come back.
  }
}
