// På panden (like Heads Up): one player holds the phone to their forehead, the others
// describe or act out the word. Tap the right half (or tip forward) for "Rigtigt",
// the left half (or tip back) to skip.
import { h, mount, listNames } from "../ui.js";
import { seededShuffle } from "./rng.js";
import { gameTop, chips } from "./ui.js";

export const defaults = { deck: "blandet", seconds: 60, tilt: true, flip: false };

export function settingsView({ settings: s, data, redraw }) {
  return [
    data ? h("section", { class: "field" }, h("h3", { style: "margin:0" }, "Bunke"),
      chips([{ id: "blandet", label: "Blandet" }, ...data.decks.map((d) => ({ id: d.id, label: d.name }))], () => s.deck, (v) => { s.deck = v; redraw(); })) : null,
    h("section", { class: "field" }, h("h3", { style: "margin:0" }, "Tid pr. tur"),
      chips([45, 60, 90].map((v) => ({ id: v, label: `${v} sek.` })), () => s.seconds, (v) => { s.seconds = v; redraw(); })),
    h("label", { class: "row" }, h("input", { type: "checkbox", checked: s.tilt, onchange: (e) => { s.tilt = e.target.checked; } }),
      "Vip telefonen for at svare (ellers tryk på skærmen)"),
    h("label", { class: "row" }, h("input", { type: "checkbox", checked: s.flip, onchange: (e) => { s.flip = e.target.checked; } }),
      "Byt om på vip frem og tilbage"),
  ];
}

export const newGame = () => ({ turn: 0, deckPos: 0, scores: {}, phase: "intro", results: [] });

let ticker = null;
let onTilt = null;
export function cleanup() {
  if (ticker) { clearInterval(ticker); ticker = null; }
  if (onTilt) { window.removeEventListener("deviceorientation", onTilt); onTilt = null; }
}

async function askMotion() {
  // iPhone asks for permission to read the motion sensor, and only after a tap.
  const D = window.DeviceOrientationEvent;
  if (D && typeof D.requestPermission === "function") {
    try { return (await D.requestPermission()) === "granted"; } catch { return false; }
  }
  return "DeviceOrientationEvent" in window;
}

/**
 * The tilt in degrees, or null when the event carries no measurement (browsers without a
 * motion sensor send one empty event). Landscape uses gamma, portrait beta.
 */
function reading(e) {
  const value = window.innerWidth > window.innerHeight ? e.gamma : e.beta;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function render(root, ctx) {
  cleanup();
  const { game, data, meta } = ctx;
  const s = game.settings;
  const words = s.deck === "blandet" ? data.decks.flatMap((d) => d.words) : (data.decks.find((d) => d.id === s.deck)?.words || []);
  const deck = seededShuffle(words, game.seed);
  const holder = game.players[game.turn % game.players.length];
  const top = gameTop({ name: meta.name, onLeave: () => ctx.finish(), right: holder });
  const go = (phase, extra = {}) => { ctx.save({ phase, ...extra }); ctx.redraw(); };
  const board = () => {
    const rows = game.players.map((p) => [p, game.scores[p] || 0]).sort((a, b) => b[1] - a[1]);
    return rows.some(([, n]) => n) ? h("ul", { class: "result-list" }, ...rows.map(([p, n]) => h("li", {}, h("span", {}, p), h("span", {}, `${n} point`)))) : null;
  };

  if (game.phase === "intro") {
    mount(root, top,
      h("div", { class: "game-card" },
        h("span", { class: "label" }, "Nu er det"),
        h("span", { class: "big" }, holder),
        h("span", {}, "Hold telefonen op mod panden med skærmen mod de andre. De forklarer eller mimer ordet."),
        h("span", { class: "meta" }, s.tilt ? "Vip frem eller tryk til højre: rigtigt. Vip tilbage eller tryk til venstre: spring over." : "Tryk til højre: rigtigt. Tryk til venstre: spring over.")),
      board(),
      h("button", { class: "btn big", onclick: async () => {
        const motion = s.tilt ? await askMotion() : false;
        go("countdown", { motion, results: [] });
      } }, "Klar"));
    return;
  }

  if (game.phase === "countdown") {
    const n = h("span", { class: "big panden-word" }, "3");
    mount(root, h("div", { class: "panden" }, n));
    let i = 3;
    ticker = setInterval(() => {
      i -= 1;
      if (i > 0) { n.textContent = String(i); return; }
      cleanup();
      go("play", { endsAt: Date.now() + s.seconds * 1000 });
    }, 900);
    return;
  }

  if (game.phase === "play") {
    let pos = game.deckPos;
    const word = h("span", { class: "big panden-word" }, deck[pos % deck.length]);
    const time = h("span", { class: "panden-time" });
    const flash = h("div", { class: "panden-flash" });
    const screen = h("div", { class: "panden" }, time, word, flash);
    let locked = false;
    const mark = (result) => {
      if (locked) return;
      locked = true;
      flash.className = `panden-flash ${result}`;
      flash.textContent = result === "right" ? "Rigtigt!" : "Videre";
      navigator.vibrate?.(result === "right" ? 80 : [30, 40, 30]);
      game.results = [...(game.results || []), { word: deck[pos % deck.length], result }];
      pos += 1;
      ctx.save({ results: game.results, deckPos: pos });
      setTimeout(() => { word.textContent = deck[pos % deck.length]; flash.className = "panden-flash"; flash.textContent = ""; locked = false; }, 650);
    };
    screen.addEventListener("pointerdown", (e) => mark(e.clientX > window.innerWidth / 2 ? "right" : "skip"));

    if (game.motion) {
      let base = null, armed = true;
      onTilt = (e) => {
        const r = reading(e);
        if (r === null) return;
        if (base === null) { base = r; return; }
        let d = r - base;
        if (s.flip) d = -d;
        if (armed && Math.abs(d) > 35) { armed = false; mark(d > 0 ? "right" : "skip"); }
        else if (!armed && Math.abs(d) < 15) armed = true;
      };
      window.addEventListener("deviceorientation", onTilt);
    }

    mount(root, screen);
    const update = () => {
      const left = Math.max(0, game.endsAt - Date.now());
      time.textContent = String(Math.ceil(left / 1000));
      if (left <= 0) {
        cleanup();
        navigator.vibrate?.([300, 100, 300]);
        go("summary");
      }
    };
    update();
    ticker = setInterval(() => { if (location.hash !== "#/spil") { cleanup(); return; } update(); }, 250);
    return;
  }

  // Summary of the turn.
  const results = game.results || [];
  const right = results.filter((r) => r.result === "right").length;
  mount(root, top,
    h("div", { class: "game-card" }, h("span", { class: "label" }, holder), h("span", { class: "big" }, `${right} rigtige`)),
    results.length ? h("ul", { class: "result-list" }, ...results.map((r) => h("li", {}, h("span", {}, r.word), h("span", {}, r.result === "right" ? "Rigtigt" : "Sprunget over")))) : null,
    h("button", { class: "btn big", onclick: () => go("intro", {
      scores: { ...game.scores, [holder]: (game.scores[holder] || 0) + right }, turn: game.turn + 1, results: [],
    }) }, `Giv telefonen til ${game.players[(game.turn + 1) % game.players.length]}`),
    h("p", { class: "meta center" }, `Alle får en tur: ${listNames(game.players)}`));
}
