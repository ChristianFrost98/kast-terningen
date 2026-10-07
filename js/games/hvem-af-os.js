// Hvem af os: a question, a countdown, and everyone points at once.
import { h } from "../ui.js";
import { deckDefaults, deckSettings, pickDeck, renderCards, stopCountdown } from "./cards.js";

export const defaults = deckDefaults;
export const settingsView = deckSettings;
export const newGame = () => ({ pos: 0, phase: "card" });
export const cleanup = stopCountdown;

export function render(root, ctx) {
  renderCards(root, ctx, {
    name: "Hvem af os",
    items: (data, game) => pickDeck(data.questions, data.rejse, game.settings.deck),
    face: (q) => h("span", { style: "font:700 clamp(1.5rem,7vw,2.1rem)/1.2 var(--display)" }, q),
    hint: "Læs spørgsmålet højt. Tryk, og på tre peger alle på én.",
    go: "Peg!",
    after: "Den med flest fingre på sig forklarer sig.",
  });
}
