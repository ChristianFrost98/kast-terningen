// Small preferences in localStorage, always wrapped in try/catch (private mode, blocked storage).

function get(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function set(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ }
}

export const newId = () => (globalThis.crypto?.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`);

/** This phone's player name, used as the default player and on invitations. */
export function myName() { return get("kt-me", {}).name || ""; }
export function setMyName(name) { set("kt-me", { ...get("kt-me", {}), name: name.trim() }); }

// People you've played with, most recent first, offered as chips in the next game.
export function recentPlayers() { return get("kt-players", []); }
export function rememberPlayers(names) {
  set("kt-players", [...names, ...recentPlayers().filter((n) => !names.includes(n))].slice(0, 30));
}
export function forgetPlayer(name) { set("kt-players", recentPlayers().filter((n) => n !== name)); }
