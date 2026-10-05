// Fingervælgeren: everyone puts a finger on the screen. When the fingers have been still for
// a moment, the app picks one, or splits them into two teams.
import { h, mount } from "../ui.js";
import { choose } from "./fingervaelger-logic.js";
import { gameTop, chips } from "./ui.js";

export const defaults = { mode: "en" };

export function settingsView({ settings: s, redraw }) {
  return [h("section", { class: "field" }, h("h3", { style: "margin:0" }, "Hvad skal den gøre?"),
    chips([{ id: "en", label: "Vælg én" }, { id: "hold", label: "Del i to hold" }], () => s.mode, (v) => { s.mode = v; redraw(); }),
    h("p", { class: "meta" }, "Godt til at finde ud af, hvem der starter, hvem der henter, eller hvordan holdene skal være."))];
}

export const newGame = () => ({ phase: "touch" });

const COLOURS = ["#e9a53a", "#4f8fd8", "#2f8f5b", "#c2549a", "#7a5cc7", "#d8613c", "#2aa6a6", "#8a8f2a", "#5b6b7a", "#b33a3a"];
const STILL_MS = 1500;
let cleanupFns = [];
export function cleanup() { for (const f of cleanupFns) f(); cleanupFns = []; }

export function render(root, ctx) {
  cleanup();
  const mode = ctx.game.settings.mode;
  const hint = h("p", { class: "finger-hint" }, "Læg en finger hver på skærmen, og hold den stille.");
  const area = h("div", { class: "finger-area", "aria-label": "Læg fingrene her" }, hint);
  mount(root, gameTop({ name: "Fingervælgeren", onLeave: () => ctx.finish({ ask: false }) }), area);

  const fingers = new Map(); // pointerId -> { el, colour }
  let timer = null;
  let decided = false;
  let colourIdx = 0;

  const place = (f, e) => {
    const r = area.getBoundingClientRect();
    f.el.style.transform = `translate(${e.clientX - r.left}px, ${e.clientY - r.top}px)`;
  };
  const restart = () => {
    clearTimeout(timer);
    area.classList.remove("choosing");
    if (decided) return;
    hint.textContent = fingers.size < 2 ? "Læg en finger hver på skærmen, og hold den stille." : "Hold stille ...";
    if (fingers.size >= 2) {
      timer = setTimeout(() => {
        area.classList.add("choosing");
        timer = setTimeout(decide, 900);
      }, STILL_MS);
    }
  };
  const decide = () => {
    const result = choose([...fingers.keys()], mode);
    if (!result) return;
    decided = true;
    area.classList.remove("choosing");
    navigator.vibrate?.(200);
    for (const [id, f] of fingers) {
      if (mode === "hold") {
        f.el.style.setProperty("--c", result[id] === 0 ? "#e9a53a" : "#4f8fd8");
        f.el.dataset.label = result[id] === 0 ? "Hold 1" : "Hold 2";
        f.el.classList.add("picked");
      } else if (id in result) {
        f.el.classList.add("picked");
        f.el.dataset.label = "Dig!";
      } else {
        f.el.classList.add("out");
      }
    }
    hint.textContent = mode === "hold" ? "Gult hold mod blåt hold. Løft fingrene for at prøve igen." : "Løft fingrene for at prøve igen.";
  };

  const down = (e) => {
    e.preventDefault();
    if (decided) return;
    const f = { el: h("span", { class: "finger" }), colour: COLOURS[colourIdx++ % COLOURS.length] };
    f.el.style.setProperty("--c", f.colour);
    fingers.set(e.pointerId, f);
    area.append(f.el);
    place(f, e);
    // Keep getting this finger's moves even if it slides off; harmless if the browser refuses.
    try { area.setPointerCapture?.(e.pointerId); } catch { /* not capturable */ }
    restart();
  };
  const move = (e) => {
    const f = fingers.get(e.pointerId);
    if (!f) return;
    place(f, e);
  };
  const up = (e) => {
    const f = fingers.get(e.pointerId);
    if (!f) return;
    fingers.delete(e.pointerId);
    if (!decided) { f.el.remove(); restart(); return; }
    if (fingers.size === 0) {
      // Everyone lifted: clear the board for another go.
      setTimeout(() => {
        for (const el of area.querySelectorAll(".finger")) el.remove();
        decided = false;
        colourIdx = 0;
        restart();
      }, 600);
    }
  };

  area.addEventListener("pointerdown", down);
  area.addEventListener("pointermove", move);
  for (const ev of ["pointerup", "pointercancel"]) area.addEventListener(ev, up);
  const noScroll = (e) => e.preventDefault();
  area.addEventListener("touchstart", noScroll, { passive: false });
  area.addEventListener("touchmove", noScroll, { passive: false });
  cleanupFns.push(() => clearTimeout(timer));
}
