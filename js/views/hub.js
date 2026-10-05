// The start screen: all the games, and the die that picks one for you.
import { h, mount, confirmSheet } from "../ui.js";
import { createDie } from "../die.js";
import { GAMES, GROUPS } from "../games/index.js";
import { currentGame, clearGame } from "../games/state.js";

export function hubView(root, app) {
  const running = currentGame();
  const runningMeta = running && GAMES[running.game];
  const games = Object.values(GAMES);

  const die = createDie({
    label: "Lad terningen vælge et spil",
    onRoll: async () => {
      await die.roll();
      app.go(`#/spil/ny/${games[Math.floor(Math.random() * games.length)].id}`);
    },
  });

  mount(root,
    h("header", { style: "padding-top:max(24px, env(safe-area-inset-top))" },
      h("h1", { class: "page-title" }, "Kast terningen"),
      h("p", { class: "lead" }, "Spil til når I er sammen. Telefonen styrer spillet, I gør resten.")),
    runningMeta ? h("div", { class: "card" },
      h("span", { class: "tag" }, h("span", { class: "live-dot" }), "I gang"),
      h("h2", {}, runningMeta.name),
      h("div", { class: "row" },
        h("a", { class: "btn", href: "#/spil" }, "Fortsæt spillet"),
        h("button", { class: "btn ghost", onclick: async () => {
          if (await confirmSheet("Afslut spillet?", null, "Afslut", "Fortryd")) { clearGame(); app.refresh(); }
        } }, "Afslut"))) : null,
    h("div", { class: "card", style: "flex-direction:row;align-items:center;gap:18px" },
      die.el,
      h("div", { class: "stack", style: "gap:4px" },
        h("h2", {}, "Kan I ikke vælge?"),
        h("p", { class: "muted small" }, "Tryk på terningen, så vælger den et spil."))),
    ...GROUPS.map((group) => h("section", { class: "stack", style: "gap:10px" },
      h("div", {}, h("h3", { style: "margin:0" }, group.name), h("p", { class: "meta" }, group.hint)),
      h("ul", { class: "game-grid" }, ...games.filter((g) => g.group === group.id).map((g) => h("li", {},
        h("a", { class: "game-tile", href: `#/spil/ny/${g.id}` },
          h("span", { class: "name" }, g.name),
          h("span", { class: "tagline" }, g.tagline),
          h("span", { class: "meta" }, `${g.players} spillere · ${g.phones}`))))))),
    installHint());
}

function installHint() {
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if (standalone) return null;
  return h("footer", {}, "Læg appen på hjemmeskærmen, så åbner den som en rigtig app og virker uden netværk. På iPhone: tryk Del og så Føj til hjemmeskærm.");
}
