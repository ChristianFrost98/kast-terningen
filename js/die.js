// The die: nine pip slots, a shake animation and a quick flicker of faces while rolling.
import { h } from "./ui.js";

const PIPS = { 1: [4], 2: [0, 8], 3: [0, 4, 8], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

export function createDie({ onRoll, label = "Slå med terningen" } = {}) {
  const el = h("div", { class: "die", role: "button", tabindex: "0", "aria-label": label });
  for (let i = 0; i < 9; i++) el.append(h("span", { class: "pip" }));
  const show = (n) => [...el.children].forEach((p, i) => p.classList.toggle("on", PIPS[n].includes(i)));
  show(5);

  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  let busy = false;

  // Resolves after the animation, so the caller can reveal the result at the right moment.
  function roll() {
    if (busy) return Promise.resolve();
    busy = true;
    el.classList.remove("rolling");
    void el.offsetWidth;
    el.classList.add("rolling");
    return new Promise((resolve) => {
      if (reduced) { show(1 + Math.floor(Math.random() * 6)); busy = false; resolve(); return; }
      let ticks = 0;
      const iv = setInterval(() => {
        show(1 + Math.floor(Math.random() * 6));
        if (++ticks > 5) { clearInterval(iv); busy = false; resolve(); }
      }, 90);
    });
  }

  if (onRoll) {
    el.addEventListener("click", onRoll);
    el.addEventListener("keydown", (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onRoll(); } });
  }
  return { el, roll, show };
}
