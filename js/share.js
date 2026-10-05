// Game links without a server: the game (seed, players, settings) is packed into the link
// itself, after "#", which browsers never send to the server.

const PREFIX = "#/delt/";

async function pack(text) {
  const stream = new Blob([text]).stream().pipeThrough(new CompressionStream("deflate-raw"));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function unpack(code) {
  const binary = atob(code.replace(/-/g, "+").replace(/_/g, "/"));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Response(stream).text();
}

/** Everything another phone needs to play along: no scores, no local state. */
export function gamePayload(game, from) {
  const { id, game: kind, seed, players, settings, dataVersion } = game;
  return { type: "game", from, game: { id, game: kind, seed, players, settings, dataVersion } };
}

export async function encodeShare(payload) {
  return pack(JSON.stringify({ v: 1, ...payload }));
}

export async function decodeShare(code) {
  const data = JSON.parse(await unpack(code));
  if (data?.v !== 1 || data.type !== "game" || !data.game?.game) throw new Error("Ukendt link");
  return data;
}

export async function shareLink(payload, base) {
  return `${base}${PREFIX}${await encodeShare(payload)}`;
}

/** Opens the share sheet with a text and the link; falls back to copying the link. */
export async function sendLink({ title, text, url }) {
  if (navigator.share) {
    try { await navigator.share({ title, text, url }); return "shared"; }
    catch (e) { if (e.name === "AbortError") return "cancelled"; }
  }
  try { await navigator.clipboard.writeText(`${text}\n${url}`); return "copied"; }
  catch { return "failed"; }
}
