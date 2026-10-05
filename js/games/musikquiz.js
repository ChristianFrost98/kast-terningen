// Musikquiz: the host's Spotify plays a clip from one of their own playlists on a Spotify
// Connect device (the Spotify app on the phone, a speaker). Everyone guesses out loud, the
// app reveals the song, and the host taps who got it right.
import { h, mount, toast, listNames } from "../ui.js";
import * as spotify from "../spotify.js";
import { mulberry32, seededShuffle } from "./rng.js";
import { gameTop, chips } from "./ui.js";

export const defaults = { clip: 20, rounds: 15, start: "midt", year: false, playlistId: null, playlistName: "", deviceId: null };

// Loaded in the background while the setup screen is open.
const cache = { user: null, playlists: null, devices: null, loading: false, error: "" };

async function loadSpotify(redraw) {
  if (cache.loading) return;
  cache.loading = true;
  cache.error = "";
  try {
    const [user, playlists, devices] = await Promise.all([spotify.me(), spotify.playablePlaylists(), spotify.devices()]);
    Object.assign(cache, { user, playlists, devices });
  } catch (e) {
    cache.error = e.status === 401 ? "Log ind igen." : e.status === 403 ? "Spotify afviste adgangen. Er du tilføjet som bruger i din Spotify-app?" : e.message;
    if (e.status === 401) spotify.logout();
  }
  cache.loading = false;
  redraw();
}

async function refreshDevices(redraw) {
  try { cache.devices = await spotify.devices(); } catch (e) { cache.error = e.message; }
  redraw();
}

export function canStart(s) {
  if (!spotify.clientId()) return { ok: false, reason: "Indtast et Spotify Client ID" };
  if (!spotify.isLoggedIn()) return { ok: false, reason: "Forbind Spotify først" };
  if (!s.playlistId) return { ok: false, reason: "Vælg en playliste" };
  return { ok: true };
}

export function settingsView({ settings: s, redraw }) {
  const loginError = sessionStorage.getItem("kt-spotify-error");
  if (loginError) sessionStorage.removeItem("kt-spotify-error");

  // 1. The host's own Spotify developer app.
  if (!spotify.clientId()) {
    return [h("form", { class: "card", onsubmit: (e) => {
      e.preventDefault();
      spotify.setClientId(e.target.elements.client.value);
      redraw();
    } },
      h("span", { class: "tag" }, "Spotify"),
      h("h2", {}, "Forbind din Spotify"),
      h("p", { class: "small" }, "Musikquizzen spiller fra din egen Spotify Premium. Det kræver en lille, gratis udvikler-app hos Spotify, som du laver én gang:"),
      h("ol", { class: "small", style: "margin:0;padding-left:20px" },
        h("li", {}, "Gå til developer.spotify.com/dashboard og log ind."),
        h("li", {}, "Opret en app, vælg Web API, og tilføj denne adresse som Redirect URI: ", h("code", {}, spotify.redirectUriFor(location))),
        h("li", {}, "Kopiér appens Client ID herind.")),
      h("div", { class: "inline-form" },
        h("input", { type: "text", name: "client", placeholder: "Client ID", "aria-label": "Spotify Client ID", autocomplete: "off", spellcheck: "false" }),
        h("button", { class: "btn small", type: "submit" }, "Gem")))];
  }

  // 2. Login.
  if (!spotify.isLoggedIn()) {
    return [h("div", { class: "card" },
      h("span", { class: "tag" }, "Spotify"),
      h("h2", {}, "Log ind med Spotify"),
      h("p", { class: "small" }, "Du bliver sendt til Spotify og tilbage hertil. Appen må kun læse dine playlister og styre afspilningen."),
      loginError ? h("p", { class: "capture" }, "Login lykkedes ikke. Tjek at adressen ovenfor står præcis sådan som Redirect URI i din Spotify-app.") : null,
      h("div", { class: "row" },
        h("button", { class: "btn", onclick: () => spotify.login(location.hash) }, "Forbind Spotify"),
        h("button", { class: "linkbtn", onclick: () => { spotify.setClientId(""); redraw(); } }, "Skift Client ID")))];
  }

  // 3. Playlist, device and quiz settings.
  if (!cache.playlists && !cache.loading && !cache.error) loadSpotify(redraw);
  const pickPlaylist = (p) => { s.playlistId = p.id; s.playlistName = p.name; redraw(); };
  const deviceChips = (cache.devices || []).map((d) => ({ id: d.id, label: `${d.name}${d.is_active ? " (aktiv)" : ""}` }));
  if (!s.deviceId && cache.devices?.length) s.deviceId = (cache.devices.find((d) => d.is_active) || cache.devices[0]).id;

  return [
    h("section", { class: "card" },
      h("span", { class: "tag" }, "Spotify"),
      cache.user ? h("p", {}, `Forbundet som ${cache.user.display_name || cache.user.id}.`) : null,
      cache.error ? h("p", { class: "capture" }, cache.error) : null,
      cache.loading ? h("p", { class: "muted" }, "Henter dine playlister ...") : null,
      cache.playlists ? h("div", { class: "field" },
        h("h3", { style: "margin:0" }, "Playliste"),
        cache.playlists.length
          ? h("div", { class: "chips" }, ...cache.playlists.map((p) => h("button", {
              class: "chip", type: "button", "aria-pressed": String(s.playlistId === p.id), onclick: () => pickPlaylist(p),
            }, p.count ? `${p.name} (${p.count})` : p.name)))
          : h("p", { class: "small" }, "Du har ingen playlister, appen må læse. Spotify tillader kun dine egne. Lav en ny playliste, og tilføj sange, eller kopiér en andens playliste til din egen."),
        h("p", { class: "meta" }, "Kun dine egne playlister kan bruges. Tip: Åbn en playliste i Spotify, vælg Tilføj til anden playliste, og kopiér den til en ny.")) : null,
      cache.playlists ? h("div", { class: "field" },
        h("h3", { style: "margin:0" }, "Afspil på"),
        deviceChips.length
          ? chips(deviceChips, () => s.deviceId, (id) => { s.deviceId = id; redraw(); })
          : h("p", { class: "small" }, "Ingen Spotify-enhed fundet. Åbn Spotify på telefonen eller højttaleren, og spil et par sekunder af noget, så den vågner."),
        h("button", { class: "btn small ghost", type: "button", onclick: () => refreshDevices(redraw) }, "Opdatér enheder")) : null,
      h("div", { class: "row" },
        cache.error ? h("button", { class: "btn small", onclick: () => loadSpotify(redraw) }, "Prøv igen") : null,
        h("button", { class: "linkbtn small", onclick: () => { spotify.logout(); Object.assign(cache, { user: null, playlists: null, devices: null, error: "" }); redraw(); } }, "Log ud af Spotify"))),
    h("section", { class: "field" }, h("h3", { style: "margin:0" }, "Klippets længde"),
      chips([10, 20, 30].map((v) => ({ id: v, label: `${v} sek.` })), () => s.clip, (v) => { s.clip = v; redraw(); })),
    h("section", { class: "field" }, h("h3", { style: "margin:0" }, "Antal sange"),
      chips([10, 15, 20].map((v) => ({ id: v, label: String(v) })), () => s.rounds, (v) => { s.rounds = v; redraw(); })),
    h("section", { class: "field" }, h("h3", { style: "margin:0" }, "Hvor i sangen?"),
      chips([{ id: "midt", label: "Et sted i midten" }, { id: "start", label: "Fra starten" }], () => s.start, (v) => { s.start = v; redraw(); })),
    h("label", { class: "row" }, h("input", { type: "checkbox", checked: s.year, onchange: (e) => { s.year = e.target.checked; } }), "Gæt også årstallet (ekstra point)"),
  ];
}

export async function newGame({ settings, seed }) {
  const all = await spotify.playlistTracks(settings.playlistId);
  if (all.length < 3) throw new Error("Playlisten har for få sange. Vælg en med mindst tre.");
  const rnd = mulberry32(seed);
  const tracks = seededShuffle(all, seed).slice(0, settings.rounds)
    .map((t) => ({ ...t, startMs: spotify.clipStart(t.durationMs, settings.clip * 1000, settings.start, rnd()) }));
  return { tracks, round: 0, phase: "ready", scores: {}, correct: [], yearCorrect: [] };
}

let timer = null;
let pausedFor = null;
export function cleanup() {
  if (timer) { clearInterval(timer); timer = null; }
}

export function render(root, ctx) {
  cleanup();
  const { game } = ctx;
  const s = game.settings;
  const track = game.tracks[game.round];
  const top = gameTop({ name: "Musikquiz", onLeave: async () => { await spotify.pause(s.deviceId); ctx.finish(); }, right: track ? `Sang ${game.round + 1}/${game.tracks.length}` : "" });
  const go = (phase, extra = {}) => { ctx.save({ phase, ...extra }); ctx.redraw(); };
  const board = () => {
    const rows = game.players.map((p) => [p, game.scores[p] || 0]).sort((a, b) => b[1] - a[1]);
    return h("ul", { class: "result-list" }, ...rows.map(([p, n]) => h("li", {}, h("span", {}, p), h("span", {}, `${n} point`))));
  };

  const playClip = async (fromMs, lengthMs) => {
    try {
      await spotify.play({ uri: track.uri, positionMs: fromMs, deviceId: s.deviceId });
      go("playing", { endsAt: Date.now() + lengthMs, playError: "" });
    } catch (e) {
      const msg = e.status === 404 ? "Spotify kan ikke finde enheden. Åbn Spotify på telefonen eller højttaleren, og prøv igen."
        : e.status === 403 ? "Spotify afviste afspilningen. Det kræver Premium." : e.status === 401 ? "Log ind på Spotify igen fra spillets opsætning." : e.message;
      go(game.phase === "playing" ? "guess" : game.phase, { playError: msg });
    }
  };

  // The end: scores and a winner.
  if (!track || game.phase === "end") {
    const best = Math.max(0, ...game.players.map((p) => game.scores[p] || 0));
    const winners = game.players.filter((p) => (game.scores[p] || 0) === best && best > 0);
    mount(root, gameTop({ name: "Musikquiz", onLeave: () => ctx.finish({ ask: false }) }),
      h("div", { class: "game-card" }, h("span", { class: "label" }, winners.length > 1 ? "Vinderne" : "Vinderen"),
        h("span", { class: "big" }, winners.length ? listNames(winners) : "Ingen point")),
      board(),
      h("button", { class: "btn big", onclick: () => ctx.finish({ ask: false }) }, "Afslut"));
    return;
  }

  const error = game.playError ? h("p", { class: "capture" }, game.playError) : null;

  if (game.phase === "ready") {
    mount(root, top,
      h("div", { class: "game-card", style: "min-height:240px;justify-content:center" },
        h("span", { class: "label" }, `Sang ${game.round + 1}`),
        h("span", { class: "big" }, "Klar?"),
        h("span", {}, `Lyt efter i ${s.clip} sekunder. Råb titlen og kunstneren${s.year ? ", og bud på året" : ""}.`)),
      error,
      h("button", { class: "btn big", onclick: () => playClip(track.startMs, s.clip * 1000) }, "Spil klippet"),
      game.round > 0 ? board() : null);
    return;
  }

  if (game.phase === "playing") {
    const bar = h("span");
    const left = h("div", { class: "timer-text" });
    mount(root, top,
      h("div", { class: "timer" }, bar), left,
      h("div", { class: "game-card", style: "min-height:240px;justify-content:center" },
        h("div", { class: "eq", "aria-hidden": "true" }, h("span"), h("span"), h("span"), h("span"), h("span")),
        h("span", {}, "Hvad er det for en sang?")),
      h("button", { class: "btn big", onclick: async () => { cleanup(); await spotify.pause(s.deviceId); go("reveal"); } }, "Vi har gættet. Afslør"));
    const total = game.endsAt - Date.now();
    const tick = async () => {
      const ms = Math.max(0, game.endsAt - Date.now());
      bar.style.transform = `scaleX(${total > 0 ? ms / total : 0})`;
      left.textContent = String(Math.ceil(ms / 1000));
      if (ms <= 0 && pausedFor !== game.endsAt) {
        pausedFor = game.endsAt;
        cleanup();
        await spotify.pause(s.deviceId);
        go("guess");
      }
    };
    tick();
    timer = setInterval(() => { if (location.hash !== "#/spil") { cleanup(); return; } tick(); }, 200);
    return;
  }

  if (game.phase === "guess") {
    mount(root, top,
      h("div", { class: "game-card", style: "min-height:200px;justify-content:center" },
        h("span", { class: "big" }, "Gæt!"),
        h("span", {}, "Råb jeres bud. Ingen telefoner, ingen Shazam.")),
      error,
      h("button", { class: "btn big", onclick: () => go("reveal") }, "Afslør sangen"),
      h("div", { class: "game-actions" },
        h("button", { class: "btn ghost", onclick: () => playClip(track.startMs, s.clip * 1000) }, "Hør igen"),
        h("button", { class: "btn ghost", onclick: () => playClip(track.startMs + s.clip * 1000, 10000) }, "10 sek. mere")));
    return;
  }

  // Reveal: the song, and who got it.
  const toggle = (key, name) => {
    const list = game[key] || [];
    ctx.save({ [key]: list.includes(name) ? list.filter((n) => n !== name) : [...list, name] });
    ctx.redraw();
  };
  const next = async () => {
    const scores = { ...game.scores };
    for (const p of game.correct || []) scores[p] = (scores[p] || 0) + 1;
    for (const p of game.yearCorrect || []) scores[p] = (scores[p] || 0) + 1;
    const round = game.round + 1;
    go(round >= game.tracks.length ? "end" : "ready", { scores, round, correct: [], yearCorrect: [], playError: "" });
  };
  mount(root, top,
    h("div", { class: "game-card" },
      track.image ? h("img", { src: track.image, alt: "", class: "cover" }) : null,
      h("span", { class: "big", style: "font-size:clamp(1.7rem,8vw,2.4rem)" }, track.name),
      h("span", { style: "font-weight:600" }, listNames(track.artists)),
      track.year ? h("span", { class: "meta" }, track.year) : null),
    h("section", { class: "field" }, h("h3", { style: "margin:0;color:inherit" }, "Hvem gættede sangen?"),
      h("div", { class: "chips" }, ...game.players.map((p) => h("button", { class: "chip", type: "button", "aria-pressed": String((game.correct || []).includes(p)), onclick: () => toggle("correct", p) }, p)))),
    s.year ? h("section", { class: "field" }, h("h3", { style: "margin:0;color:inherit" }, `Hvem ramte ${track.year || "året"}?`),
      h("div", { class: "chips" }, ...game.players.map((p) => h("button", { class: "chip", type: "button", "aria-pressed": String((game.yearCorrect || []).includes(p)), onclick: () => toggle("yearCorrect", p) }, p)))) : null,
    h("button", { class: "btn big", onclick: next }, game.round + 1 >= game.tracks.length ? "Se resultatet" : "Næste sang"),
    h("button", { class: "linkbtn", onclick: () => playClip(track.startMs, s.clip * 1000) }, "Spil sangen igen"));
}
