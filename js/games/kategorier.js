// Kategorier (like Stop / Scattergories): a letter, six categories and a timer. Everyone
// writes on paper; the app keeps time and shows the scoring rules.
import { h, mount } from "../ui.js";
import { roundFor } from "./kategorier-logic.js";
import { gameTop, chips, fmtClock } from "./ui.js";

export const defaults = { seconds: 120, count: 6 };

export function settingsView({ settings: s, redraw }) {
  return [
    h("p", { class: "capture" }, "Alle skal have papir og en blyant."),
    h("section", { class: "field" }, h("h3", { style: "margin:0" }, "Tid pr. runde"),
      chips([90, 120, 180].map((v) => ({ id: v, label: v >= 120 ? `${v / 60} min.` : `${v} sek.` })), () => s.seconds, (v) => { s.seconds = v; redraw(); })),
    h("section", { class: "field" }, h("h3", { style: "margin:0" }, "Kategorier pr. runde"),
      chips([5, 6, 8].map((v) => ({ id: v, label: String(v) })), () => s.count, (v) => { s.count = v; redraw(); })),
  ];
}

export const newGame = () => ({ round: 1, phase: "ready" });

let ticker = null;
export function cleanup() { if (ticker) { clearInterval(ticker); ticker = null; } }

export function render(root, ctx) {
  cleanup();
  const { game, data } = ctx;
  const s = game.settings;
  const r = roundFor({ seed: game.seed, round: game.round, categories: data.categories, count: s.count });
  const top = gameTop({ name: "Kategorier", onLeave: () => ctx.finish(), right: `Runde ${game.round}` });
  const go = (phase, extra = {}) => { ctx.save({ phase, ...extra }); ctx.redraw(); };
  const list = () => h("ol", { class: "cat-list" }, ...r.categories.map((c) => h("li", {}, c)));

  if (game.phase === "ready") {
    mount(root, top,
      h("div", { class: "game-card", style: "min-height:220px;justify-content:center" },
        h("span", { class: "label" }, `Runde ${game.round}`),
        h("span", { class: "big" }, "?"),
        h("span", {}, `Skriv tallene 1-${s.count} på jeres papir. Bogstavet vises, når I trykker start.`)),
      h("button", { class: "btn big", onclick: () => go("write", { endsAt: Date.now() + s.seconds * 1000 }) }, "Start runden"));
    return;
  }

  if (game.phase === "write") {
    const bar = h("span");
    const left = h("div", { class: "timer-text" });
    mount(root, top,
      h("div", { class: "timer" }, bar), left,
      h("div", { class: "game-card", style: "align-items:stretch;text-align:left" },
        h("div", { class: "letter" }, r.letter),
        list()),
      h("button", { class: "btn ghost", onclick: () => go("score") }, "Vi er færdige"));
    const tick = () => {
      const ms = Math.max(0, game.endsAt - Date.now());
      bar.style.transform = `scaleX(${ms / (s.seconds * 1000)})`;
      left.textContent = fmtClock(ms);
      if (!ms) { cleanup(); navigator.vibrate?.([300, 100, 300]); go("score"); }
    };
    tick();
    ticker = setInterval(() => { if (location.hash !== "#/spil") { cleanup(); return; } tick(); }, 250);
    return;
  }

  mount(root, top,
    h("h1", { class: "page-title" }, "Blyanterne ned!"),
    h("div", { class: "game-card", style: "align-items:stretch;text-align:left" },
      h("div", { class: "letter" }, r.letter), list()),
    h("ul", { class: "result-list" },
      h("li", {}, h("span", {}, "Svar, som ingen andre har"), h("span", {}, "2 point")),
      h("li", {}, h("span", {}, "Samme svar som en anden"), h("span", {}, "1 point")),
      h("li", {}, h("span", {}, "Intet svar eller forkert bogstav"), h("span", {}, "0 point"))),
    h("p", { class: "center" }, "Læs svarene op kategori for kategori. Er I uenige, stemmer I."),
    h("button", { class: "btn big", onclick: () => go("ready", { round: game.round + 1 }) }, "Næste runde"));
}
