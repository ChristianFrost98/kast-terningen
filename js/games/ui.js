// Shared pieces of the game screen.
import { h } from "../ui.js";

/** Choice chips for a setting. options: [{id, label}]. */
export function chips(options, selected, pick) {
  return h("div", { class: "chips" }, ...options.map((o) => h("button", {
    class: "chip", type: "button", "aria-pressed": String(selected() === o.id), onclick: () => pick(o.id),
  }, o.label)));
}

/** "Hver sin telefon" or "Én telefon" for games that can do both. Sets settings.mode. */
export function modeTiles(settings, redraw) {
  const tile = (mode, title, hint) => h("button", { class: "tile", type: "button", "aria-pressed": String(settings.mode === mode),
    onclick: () => { settings.mode = mode; redraw(); } }, title, h("span", { class: "meta" }, hint));
  return h("section", { class: "field" }, h("h3", { style: "margin:0" }, "Hvordan spiller I?"),
    h("div", { class: "tiles" },
      tile("multi", "Hver sin telefon", "Alle scanner én QR-kode"),
      tile("single", "Én telefon", "Den går på omgang")));
}

/** Top bar in game mode: leave on the left, game name in the middle, extra on the right. */
export function gameTop({ name, onLeave, right = null }) {
  return h("div", { class: "game-top" },
    h("button", { type: "button", onclick: onLeave }, "Afslut"),
    h("span", { class: "name" }, name),
    h("span", { class: "round" }, right || ""));
}

/**
 * A card that shows its secret only while a finger (or the space bar) is held on it,
 * so the people next to you can't read it over your shoulder.
 */
export function holdToReveal({ prompt = "Hold fingeren her for at se", secret, onSeen }) {
  const card = h("div", { class: "game-card reveal", role: "button", tabindex: "0", "aria-label": prompt });
  const cover = () => card.replaceChildren(
    h("span", { class: "finger", "aria-hidden": "true" }, "☝"),
    h("span", { class: "hold" }, prompt));
  let seen = false;
  const show = (e) => {
    e?.preventDefault?.();
    const { node, imposter } = secret();
    card.classList.toggle("imposter", Boolean(imposter));
    card.replaceChildren(node);
    if (!seen) { seen = true; onSeen?.(); }
  };
  const hide = () => { card.classList.remove("imposter"); cover(); };
  card.addEventListener("pointerdown", show);
  for (const ev of ["pointerup", "pointerleave", "pointercancel"]) card.addEventListener(ev, hide);
  card.addEventListener("contextmenu", (e) => e.preventDefault());
  card.addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") show(e); });
  card.addEventListener("keyup", (e) => { if (e.key === " " || e.key === "Enter") hide(); });
  cover();
  return card;
}

/** 125000 -> "2:05". Rounds up, so a fresh 2-minute timer shows 2:00, not 1:59. */
export function fmtClock(ms) {
  const total = Math.ceil(Math.max(0, ms) / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function enterGameMode() { document.body.classList.add("game-mode"); }
export function leaveGameMode() { document.body.classList.remove("game-mode"); }
