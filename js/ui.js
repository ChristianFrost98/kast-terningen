// Tiny DOM helpers. h("div", {class: "card"}, "text", child) builds elements without innerHTML,
// so text from the library or from users is never parsed as HTML.

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs || {})) {
    if (value === null || value === undefined || value === false) continue;
    if (key.startsWith("on") && typeof value === "function") el.addEventListener(key.slice(2), value);
    else if (key === "class") el.className = value;
    else if (value === true) el.setAttribute(key, "");
    else el.setAttribute(key, String(value));
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const child of children.flat(Infinity)) {
    if (child === null || child === undefined || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
}

export function mount(root, ...children) {
  root.replaceChildren();
  append(root, children);
}

export function toast(message, ms = 2400) {
  const el = h("div", { class: "toast", role: "status" }, message);
  document.body.append(el);
  setTimeout(() => el.remove(), ms);
}

// A bottom sheet built on <dialog>. Resolves with the value passed to close(), or null if dismissed.
export function sheet(build) {
  return new Promise((resolve) => {
    const dialog = h("dialog");
    let result = null;
    const close = (value = null) => { result = value; dialog.close(); };
    dialog.append(build(close));
    dialog.addEventListener("close", () => { dialog.remove(); resolve(result); });
    // Close on a tap on the backdrop, but not on the sheet's own padding (which also targets the dialog).
    dialog.addEventListener("click", (e) => {
      if (e.target !== dialog) return;
      const r = dialog.getBoundingClientRect();
      if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) close(null);
    });
    document.body.append(dialog);
    dialog.showModal();
  });
}

export function confirmSheet(title, text, yes = "Ja", no = "Fortryd") {
  return sheet((close) => h("div", { class: "stack" },
    h("h2", {}, title),
    text ? h("p", { class: "muted" }, text) : null,
    h("div", { class: "row" },
      h("button", { class: "btn", onclick: () => close(true) }, yes),
      h("button", { class: "btn ghost", onclick: () => close(false) }, no)),
  ));
}

// "Mads", "Mads og Jonas", "Mads, Jonas og Ida"
export function listNames(names) {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} og ${names.at(-1)}`;
}
