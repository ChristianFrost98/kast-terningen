// Shared engine for question games on one phone: a card, a 3-2-1 countdown, everyone answers
// at once with their hands, next card. Used by "Hvem af os" and "Hvad vil du helst".
import { h, mount } from "../ui.js";
import { seededShuffle } from "./rng.js";
import { gameTop } from "./ui.js";

let countdown = null;
export const stopCountdown = () => { if (countdown) { clearInterval(countdown); countdown = null; } };

/**
 * spec: { name, items(data, game) -> array, face(item) -> node, hint, after,
 *         countdown: false for plain cards, go: label after the countdown, below(game) -> node }
 */
export function renderCards(root, ctx, spec) {
  stopCountdown();
  const { game, data } = ctx;
  const deck = seededShuffle(spec.items(data, game), game.seed);
  const item = deck[game.pos % deck.length];
  const top = gameTop({ name: spec.name, onLeave: () => ctx.finish(), right: `${(game.pos % deck.length) + 1}/${deck.length}` });
  const next = () => { ctx.save({ pos: game.pos + 1, phase: "card" }); ctx.redraw(); };
  const card = h("div", { class: "game-card", style: "min-height:260px;justify-content:center" }, spec.face(item));

  if (spec.countdown === false) {
    mount(root, top, card,
      spec.below?.(game) || null,
      h("p", { class: "center" }, spec.hint),
      h("button", { class: "btn big", onclick: next }, "Næste"));
    return;
  }

  if (game.phase === "shown") {
    mount(root, top, card,
      h("p", { class: "center" }, spec.after),
      h("button", { class: "btn big", onclick: next }, "Næste"));
    return;
  }

  const count = h("span", { class: "big" });
  const start = () => {
    let n = 3;
    card.replaceChildren(count);
    count.textContent = String(n);
    countdown = setInterval(() => {
      n -= 1;
      if (n > 0) { count.textContent = String(n); return; }
      stopCountdown();
      navigator.vibrate?.(150);
      ctx.save({ phase: "shown" });
      mount(root, top,
        h("div", { class: "game-card", style: "min-height:260px;justify-content:center" }, h("span", { class: "big" }, spec.go), spec.face(item)),
        h("p", { class: "center" }, spec.after),
        h("button", { class: "btn big", onclick: next }, "Næste"));
    }, 800);
  };

  mount(root, top,
    card,
    h("p", { class: "center" }, spec.hint),
    h("button", { class: "btn big", onclick: start }, "3, 2, 1"),
    h("button", { class: "btn ghost", onclick: next }, "Spring over"));
}
