// Bomben: a category, a hidden fuse, and the phone goes round. Whoever holds it when it
// goes off loses the round. One phone; the sound comes from Web Audio (no files).
import { h, mount } from "../ui.js";
import { seededShuffle } from "./rng.js";
import { gameTop, chips } from "./ui.js";

const FUSES = { kort: [10, 25], mellem: [20, 45], lang: [30, 70] };

export const defaults = { fuse: "mellem" };

export function settingsView({ settings: s, redraw }) {
  return [h("section", { class: "field" }, h("h3", { style: "margin:0" }, "Luntens længde"),
    chips([{ id: "kort", label: "Kort" }, { id: "mellem", label: "Mellem" }, { id: "lang", label: "Lang" }], () => s.fuse, (v) => { s.fuse = v; redraw(); }),
    h("p", { class: "meta" }, "Ingen ved, hvornår den springer. Kun cirka hvor længe."))];
}

export const newGame = () => ({ round: 1, pos: 0, losses: {}, phase: "ready" });

let timer = null;
let audio = null;
export function cleanup() { if (timer) { clearTimeout(timer); timer = null; } }

function sound() {
  try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); } catch { audio = null; }
  return audio;
}
function tick(ctxA, pitch = 900) {
  if (!ctxA) return;
  const o = ctxA.createOscillator(), g = ctxA.createGain();
  o.frequency.value = pitch; g.gain.setValueAtTime(0.25, ctxA.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctxA.currentTime + 0.05);
  o.connect(g).connect(ctxA.destination); o.start(); o.stop(ctxA.currentTime + 0.06);
}
function boom(ctxA) {
  if (!ctxA) return;
  const len = ctxA.sampleRate * 0.8, buf = ctxA.createBuffer(1, len, ctxA.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.5);
  const src = ctxA.createBufferSource(), g = ctxA.createGain();
  src.buffer = buf; g.gain.value = 0.9; src.connect(g).connect(ctxA.destination); src.start();
}

export function render(root, ctx) {
  cleanup();
  const { game, data } = ctx;
  const deck = seededShuffle(data.categories, game.seed);
  const category = deck[game.pos % deck.length];
  const top = gameTop({ name: "Bomben", onLeave: () => ctx.finish(), right: `Runde ${game.round}` });
  const go = (phase, extra = {}) => { ctx.save({ phase, ...extra }); ctx.redraw(); };
  const board = () => {
    const rows = game.players.map((p) => [p, game.losses[p] || 0]).sort((a, b) => b[1] - a[1]);
    return rows.some(([, n]) => n) ? h("ul", { class: "result-list" }, ...rows.map(([p, n]) => h("li", {}, h("span", {}, p), h("span", {}, n === 1 ? "1 bombe" : `${n} bomber`)))) : null;
  };

  if (game.phase === "ready") {
    mount(root, top,
      h("div", { class: "game-card" }, h("span", { class: "bomb", "aria-hidden": "true" }, "💣"),
        h("span", {}, "Den, der holder telefonen, siger noget i kategorien og sender den videre. Ingen gentagelser.")),
      board(),
      h("button", { class: "btn big", onclick: () => { sound()?.resume?.(); go("ticking"); } }, "Tænd lunten"));
    return;
  }

  if (game.phase === "ticking") {
    const [min, max] = FUSES[game.settings.fuse] || FUSES.mellem;
    const total = (min + Math.random() * (max - min)) * 1000;
    const started = Date.now();
    const a = sound();
    const loop = () => {
      const elapsed = Date.now() - started;
      if (elapsed >= total) {
        boom(a);
        navigator.vibrate?.([400, 100, 400]);
        go("boom");
        return;
      }
      const left = 1 - elapsed / total;
      tick(a, left < 0.25 ? 1300 : 900);
      timer = setTimeout(loop, left < 0.25 ? 220 : left < 0.5 ? 420 : 650);
    };
    mount(root, top,
      h("div", { class: "game-card", style: "min-height:300px;justify-content:center" },
        h("span", { class: "label" }, "Kategori"),
        h("span", { class: "big" }, category),
        h("span", { class: "bomb ticking", "aria-hidden": "true" }, "💣")),
      h("p", { class: "center" }, "Sig noget, og send telefonen videre!"),
      h("button", { class: "btn ghost", onclick: () => { ctx.save({ pos: game.pos + 1 }); root.querySelector(".game-card .big").textContent = deck[(game.pos) % deck.length]; } }, "Ny kategori"));
    loop();
    return;
  }

  // Boom: who was holding it?
  mount(root, top,
    h("div", { class: "game-card boom" }, h("span", { class: "big" }, "BOOM!"), h("span", {}, "Hvem holdt bomben?")),
    h("div", { class: "stack" }, ...game.players.map((p) => h("button", { class: "btn", onclick: () => {
      go("ready", { losses: { ...game.losses, [p]: (game.losses[p] || 0) + 1 }, round: game.round + 1, pos: game.pos + 1 });
    } }, p))),
    h("button", { class: "linkbtn", onclick: () => go("ready", { round: game.round + 1, pos: game.pos + 1 }) }, "Ingen taber denne gang"));
}
