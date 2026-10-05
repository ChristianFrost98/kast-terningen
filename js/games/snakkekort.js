// Snakkekort: good questions for a good talk. Players take turns answering first.
import { h } from "../ui.js";
import { renderCards, stopCountdown } from "./cards.js";
import { chips } from "./ui.js";

export const defaults = { deck: "blandet" };

export function settingsView({ settings: s, data, redraw }) {
  return data ? [h("section", { class: "field" }, h("h3", { style: "margin:0" }, "Bunke"),
    chips([{ id: "blandet", label: "Blandet" }, ...data.decks.map((d) => ({ id: d.id, label: d.name }))], () => s.deck, (v) => { s.deck = v; redraw(); }))] : [];
}

export const newGame = () => ({ pos: 0, phase: "card" });
export const cleanup = stopCountdown;

export function render(root, ctx) {
  renderCards(root, ctx, {
    name: "Snakkekort",
    countdown: false,
    items: (data, game) => (game.settings.deck === "blandet" ? data.decks.flatMap((d) => d.questions) : data.decks.find((d) => d.id === game.settings.deck)?.questions || []),
    face: (q) => h("span", { style: "font:700 clamp(1.4rem,6.5vw,1.9rem)/1.25 var(--display)" }, q),
    below: (game) => h("p", { class: "center" }, h("b", {}, `${game.players[game.pos % game.players.length]} svarer først`)),
    hint: "Tag den tid, I har brug for. Det er okay at springe over.",
  });
}
