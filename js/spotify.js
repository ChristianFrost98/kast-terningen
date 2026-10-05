// Spotify for the music quiz, without a server: login with Authorization Code + PKCE,
// the host's own playlists, and playback control of a Spotify Connect device (the Spotify
// app on the phone, a speaker, a computer). Needs Spotify Premium and a Client ID from the
// host's own Spotify developer app (see README).
//
// Rules as of 2026: development-mode apps can only read the items of playlists the user owns
// or collaborates on, the playlist field is `items[].item` (was `tracks[].track`), and the
// redirect URI must be https or a loopback IP (127.0.0.1), never "localhost".

const AUTH_URL = "https://accounts.spotify.com/authorize";
const TOKEN_URL = "https://accounts.spotify.com/api/token";
const API = "https://api.spotify.com/v1";
const SCOPES = ["user-read-playback-state", "user-modify-playback-state", "playlist-read-private", "playlist-read-collaborative"];
const KEYS = { client: "kt-spotify-client", token: "kt-spotify-token", pending: "kt-spotify-pending" };

// ---------- Pure helpers (tested in Node) ----------

export function base64url(bytes) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function randomString(length = 64) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  const values = globalThis.crypto.getRandomValues(new Uint8Array(length));
  return [...values].map((v) => chars[v % chars.length]).join("");
}

export async function codeChallenge(verifier) {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

export function authUrl({ clientId, redirectUri, challenge, state }) {
  const q = new URLSearchParams({
    client_id: clientId, response_type: "code", redirect_uri: redirectUri,
    code_challenge_method: "S256", code_challenge: challenge, state, scope: SCOPES.join(" "),
  });
  return `${AUTH_URL}?${q}`;
}

/** The redirect URI is the app's own address without query or hash, e.g. https://x.pages.dev/ */
export function redirectUriFor(loc) {
  return `${loc.origin}${loc.pathname}`;
}

/** A playlist entry as the quiz needs it, or null for local files, podcasts and gaps. */
export function parseItem(entry) {
  const t = entry?.item ?? entry?.track; // `item` since February 2026, `track` before
  if (!t || t.type !== "track" || t.is_local || !t.uri) return null;
  const images = t.album?.images || [];
  return {
    uri: t.uri,
    name: t.name,
    artists: (t.artists || []).map((a) => a.name).filter(Boolean),
    year: (t.album?.release_date || "").slice(0, 4) || null,
    image: (images.find((i) => i.width && i.width <= 320) || images[0])?.url || null,
    durationMs: t.duration_ms || 0,
  };
}

/** Where a clip starts: somewhere in the middle of the song (20-60 %), or at the start. */
export function clipStart(durationMs, clipMs, mode, rnd) {
  if (mode === "start" || !durationMs) return 0;
  const latest = Math.max(0, durationMs - clipMs - 5000);
  const from = Math.min(durationMs * 0.2, latest);
  const to = Math.min(durationMs * 0.6, latest);
  return Math.round(from + rnd * Math.max(0, to - from));
}

// ---------- Settings and tokens ----------

function read(key) { try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; } }
function write(key, value) { try { value === null ? localStorage.removeItem(key) : localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage unavailable */ } }

export const clientId = () => read(KEYS.client) || "";
export const setClientId = (id) => write(KEYS.client, id.trim() || null);
export const isLoggedIn = () => Boolean(read(KEYS.token)?.refresh);
export function logout() { write(KEYS.token, null); }

/** Sends the host to Spotify's login; they come back to `returnHash`. */
export async function login(returnHash) {
  const verifier = randomString(64);
  const state = randomString(16);
  write(KEYS.pending, { verifier, state, returnHash });
  location.assign(authUrl({ clientId: clientId(), redirectUri: redirectUriFor(location), challenge: await codeChallenge(verifier), state }));
}

/**
 * Called once at startup. If Spotify just sent the host back with ?code=..., trade it for
 * tokens, clean the address bar and return the hash to continue on. Otherwise null.
 */
export async function handleRedirect() {
  const params = new URLSearchParams(location.search);
  if (!params.has("code") && !params.has("error")) return null;
  const pending = read(KEYS.pending);
  write(KEYS.pending, null);
  history.replaceState(null, "", redirectUriFor(location) + (pending?.returnHash || "#/"));
  if (params.get("error") || !pending || params.get("state") !== pending.state) return { error: params.get("error") || "state" };
  const body = new URLSearchParams({
    grant_type: "authorization_code", code: params.get("code"), redirect_uri: redirectUriFor(location),
    client_id: clientId(), code_verifier: pending.verifier,
  });
  const res = await fetch(TOKEN_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!res.ok) return { error: `token ${res.status}` };
  saveToken(await res.json());
  return { ok: true, returnHash: pending.returnHash };
}

function saveToken(t) {
  const old = read(KEYS.token) || {};
  write(KEYS.token, { access: t.access_token, refresh: t.refresh_token || old.refresh, expiresAt: Date.now() + (t.expires_in - 60) * 1000 });
}

async function accessToken() {
  const t = read(KEYS.token);
  if (!t) throw new SpotifyError(401, "Ikke logget ind");
  if (Date.now() < t.expiresAt) return t.access;
  const res = await fetch(TOKEN_URL, {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: t.refresh, client_id: clientId() }),
  });
  if (!res.ok) { logout(); throw new SpotifyError(401, "Login er udløbet"); }
  saveToken(await res.json());
  return read(KEYS.token).access;
}

export class SpotifyError extends Error {
  constructor(status, message, reason = "") { super(message); this.status = status; this.reason = reason; }
}

async function api(path, { method = "GET", body, query } = {}) {
  const url = `${API}${path}${query ? `?${new URLSearchParams(query)}` : ""}`;
  const res = await fetch(url, {
    method, headers: { Authorization: `Bearer ${await accessToken()}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 204 || res.status === 202) return null;
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new SpotifyError(res.status, data?.error?.message || `Spotify svarede ${res.status}`, data?.error?.reason || "");
  return data;
}

// ---------- What the quiz uses ----------

export const me = () => api("/me");

/** The host's playlists whose songs the app may read: own or collaborative ones. */
export async function playablePlaylists() {
  const user = await me();
  const all = [];
  for (let offset = 0; offset < 200; offset += 50) {
    const page = await api("/me/playlists", { query: { limit: 50, offset } });
    all.push(...(page?.items || []));
    if (!page?.next) break;
  }
  return all
    .filter((p) => p && (p.owner?.id === user.id || p.collaborative))
    .map((p) => ({ id: p.id, name: p.name, count: p.items?.total ?? p.tracks?.total ?? null, image: p.images?.[0]?.url || null }));
}

export async function playlistTracks(id, max = 500) {
  const tracks = [];
  for (let offset = 0; offset < max; offset += 100) {
    const page = await api(`/playlists/${id}/items`, { query: { limit: 100, offset } });
    tracks.push(...(page?.items || []).map(parseItem).filter(Boolean));
    if (!page?.next) break;
  }
  return tracks;
}

export async function devices() {
  return ((await api("/me/player/devices"))?.devices || []).filter((d) => !d.is_restricted);
}

export async function play({ uri, positionMs = 0, deviceId }) {
  await api("/me/player/play", { method: "PUT", query: deviceId ? { device_id: deviceId } : undefined, body: { uris: [uri], position_ms: positionMs } });
}

export async function pause(deviceId) {
  try { await api("/me/player/pause", { method: "PUT", query: deviceId ? { device_id: deviceId } : undefined }); } catch { /* already paused */ }
}
