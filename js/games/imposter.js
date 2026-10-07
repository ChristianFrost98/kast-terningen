// Imposter on screen. The phone goes round the table, and each player holds a finger on it to see their word.
import { h, mount, confirmSheet, listNames } from "../ui.js";
import { dealRound, roleFor, wordPool } from "./imposter-logic.js";
import { gameTop, holdToReveal, chips } from "./ui.js";

export const defaults = { category: "blandet", imposters: 1, hint: true };

export function settingsView({ settings: s, players, data, redraw }) {
  return [
    data ? h("section", { class: "field" }, h("h3", { style: "margin:0" }, "Kategori"),
      chips([{ id: "blandet", label: "Blandet" }, ...data.categories.map((c) => ({ id: c.id, label: c.name }))],
        () => s.category, (id) => { s.category = id; redraw(); })) : null,
    players.length >= 6 ? h("section", { class: "field" }, h("h3", { style: "margin:0" }, "Antal imposters"),
      chips([{ id: 1, label: "Én" }, { id: 2, label: "To" }], () => s.imposters, (id) => { s.imposters = id; redraw(); })) : null,
    h("label", { class: "row" }, h("input", { type: "checkbox", checked: s.hint, onchange: (e) => { s.hint = e.target.checked; } }),
      "Imposteren får kategorien som hjælp"),
  ];
}

export function newGame() {
  return { round: 1, log: [], phase: "pass", seat: 0 };
}

export function render(root, ctx) {
  const { game, data } = ctx;
  const players = game.players;
  const words = wordPool(data, game.settings.category);
  const deal = dealRound({ seed: game.seed, round: game.round, playerCount: players.length, words, imposters: game.settings.imposters });
  const top = gameTop({ name: "Imposter", onLeave: () => ctx.finish(), right: `Runde ${game.round}` });
  const go = (phase, extra = {}) => { ctx.save({ phase, ...extra }); ctx.redraw(); };

  const starter = players[deal.starter];
  const reveal = () => go("revealed", { log: logRound(game, deal) });
  const askReveal = async () => { if (await confirmSheet("Har I stemt?", "Når I har peget på jeres mistænkte, afslører I imposteren.", "Afslør", "Ikke endnu")) reveal(); };
  const nextRound = () => go("pass", { round: game.round + 1, seat: 0 });
  const secretFor = (i) => () => {
    const role = roleFor(deal, i, { hint: game.settings.hint });
    return role.imposter
      ? { imposter: true, node: h("div", { class: "stack", style: "align-items:center" },
          h("span", { class: "label" }, "Du er"), h("span", { class: "big" }, "Imposter"),
          role.category ? h("span", {}, `Kategori: ${role.category}`) : h("span", {}, "Bluf dig igennem"),
          deal.imposters.length > 1 ? h("span", { class: "meta" }, "Der er to imposters i denne runde") : null) }
      : { imposter: false, node: h("div", { class: "stack", style: "align-items:center" },
          h("span", { class: "label" }, role.category), h("span", { class: "big" }, role.word)) };
  };

  if (game.phase === "revealed") {
    const names = deal.imposters.map((i) => players[i]);
    mount(root, top,
      h("div", { class: "game-card" },
        h("span", { class: "label" }, names.length > 1 ? "Imposterne var" : "Imposteren var"),
        h("span", { class: "big" }, listNames(names)),
        h("span", {}, `Ordet var ${deal.word}`)),
      h("button", { class: "btn big", onclick: nextRound }, "Næste runde"),
      h("button", { class: "btn ghost", onclick: () => ctx.finish() }, "Afslut spillet"));
    return;
  }

  // Hand the phone to each player in turn.
  const seat = game.seat || 0;
  if (seat < players.length) {
    let seen = false;
    const next = h("button", { class: "btn big", disabled: true, onclick: () => go("pass", { seat: seat + 1 }) },
      seat === players.length - 1 ? "Skjul. Alle har set" : "Skjul og giv videre");
    mount(root, top,
      h("p", { class: "meta center" }, `${seat + 1} af ${players.length}`),
      h("h1", { class: "page-title center" }, `Giv telefonen til ${players[seat]}`),
      holdToReveal({ prompt: `${players[seat]}: hold fingeren her`, secret: secretFor(seat), onSeen: () => { if (!seen) { seen = true; next.disabled = false; } } }),
      next);
    return;
  }
  mount(root, top,
    h("h1", { class: "page-title" }, "Alle har set deres ord"),
    h("div", { class: "game-card" }, h("span", { class: "label" }, "Først siger"), h("span", { class: "big" }, starter),
      h("span", {}, "ét ord, der passer. Så går det rundt.")),
    h("button", { class: "btn big", onclick: askReveal }, "Afslør imposteren"));
}

function logRound(game, deal) {
  const log = (game.log || []).filter((r) => r.round !== deal.round);
  log.push({ round: deal.round, word: deal.word, imposters: deal.imposters.map((i) => game.players[i]) });
  return log.sort((a, b) => a.round - b.round);
}
