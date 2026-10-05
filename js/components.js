// Building blocks shared by the screens.
import { h } from "./ui.js";
import { icon } from "./icons.js";

/** Sticky bar at the top. back: {href, label} or null; end: an element or null. */
export function appBar({ back = null, title = "", end = null } = {}) {
  return h("div", { class: "appbar" },
    h("div", { class: "side" }, back ? h("a", { class: "iconbtn", href: back.href, "aria-label": back.label || "Tilbage" }, icon("back"), back.label || "") : null),
    h("div", { class: "bar-title" }, title),
    h("div", { class: "side end" }, end));
}
