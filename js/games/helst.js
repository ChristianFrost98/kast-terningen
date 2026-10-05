// Hvad vil du helst: two options; on three, left hand or right hand.
import { h } from "../ui.js";
import { renderCards, stopCountdown } from "./cards.js";

export const defaults = {};
export const newGame = () => ({ pos: 0, phase: "card" });
export const cleanup = stopCountdown;

export function render(root, ctx) {
  renderCards(root, ctx, {
    name: "Hvad vil du helst",
    items: (data) => data.pairs,
    face: ([a, b]) => h("div", { class: "stack", style: "width:100%;gap:10px" },
      h("span", { class: "label" }, "Vil du helst"),
      h("div", { class: "helst" },
        h("span", { class: "opt" }, h("b", {}, "Venstre"), a),
        h("span", { class: "or" }, "eller"),
        h("span", { class: "opt" }, h("b", {}, "Højre"), b))),
    hint: "Læs begge muligheder højt. På tre rækker alle venstre eller højre hånd op.",
    go: "Hånden op!",
    after: "Dem i mindretal forklarer, hvorfor de har ret.",
  });
}
