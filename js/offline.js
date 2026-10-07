// The service worker: registering it, switching to a new version, and asking whether
// everything is cached so the app works with no network.

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;
  // When a new version takes over, reload onto it so all files come from the same version.
  // A game in progress is kept in localStorage and survives the reload.
  const hadController = Boolean(navigator.serviceWorker.controller);
  let reloading = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController || reloading) return;
    reloading = true;
    location.reload();
  });
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

/** "ready" when every file is cached, "pending" while it's downloading, null where it can't work. */
export async function offlineStatus() {
  if (!("serviceWorker" in navigator) || !window.isSecureContext) return null;
  const registration = await navigator.serviceWorker.getRegistration();
  if (!registration) return "pending";
  const worker = registration.active;
  if (!worker) return "pending";
  const reply = await new Promise((resolve) => {
    const channel = new MessageChannel();
    channel.port1.onmessage = (e) => resolve(e.data);
    worker.postMessage("status", [channel.port2]);
    setTimeout(() => resolve(null), 3000);
  });
  return reply && reply.missing === 0 ? "ready" : "pending";
}

/** Resolves when the first install finishes (or right away if one is already active). */
export function whenInstalled() {
  if (!("serviceWorker" in navigator)) return new Promise(() => {});
  return navigator.serviceWorker.ready;
}
