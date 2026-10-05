// Jeg har aldrig, without drinking: everyone holds up five fingers and lowers one if they
// HAVE done it. First with no fingers left has the best stories.
import { h } from "../ui.js";
import { renderCards, stopCountdown } from "./cards.js";

export const defaults = {};
export const newGame = () => ({ pos: 0, phase: "card" });
export const cleanup = stopCountdown;

export function render(root, ctx) {
  renderCards(root, ctx, {
    name: "Jeg har aldrig",
    countdown: false,
    items: (data) => data.statements,
    face: (s) => h("span", { style: "font:700 clamp(1.5rem,7vw,2.1rem)/1.2 var(--display)" }, s),
    hint: "Alle starter med fem fingre oppe. Har du gjort det, tager du en finger ned og fortæller historien, hvis du vil.",
  });
}
