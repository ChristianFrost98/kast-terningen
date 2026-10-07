// The start screen: Japan-bingo, all the games, and the die that picks one for you.
import { h, mount, confirmSheet } from "../ui.js";
import { createDie } from "../die.js";
import { GAMES, GROUPS } from "../games/index.js";
import { currentGame, clearGame } from "../games/state.js";
import { loadBingo } from "./bingo.js";
import { offlineStatus, whenInstalled } from "../offline.js";

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
      h("p", { class: "lead" }, "Spil til når I er sammen. Én telefon styrer spillet, I gør resten."),
      offlineLine()),
    runningMeta ? h("div", { class: "card" },
      h("span", { class: "tag" }, h("span", { class: "live-dot" }), "I gang"),
      h("h2", {}, runningMeta.name),
      h("div", { class: "row" },
        h("a", { class: "btn", href: "#/spil" }, "Fortsæt spillet"),
        h("button", { class: "btn ghost", onclick: async () => {
          if (await confirmSheet("Afslut spillet?", null, "Afslut", "Fortryd")) { clearGame(); app.refresh(); }
        } }, "Afslut"))) : null,
    bingoCard(),
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
          h("span", { class: "meta" }, g.needs ? `${g.players} spillere · ${g.needs}` : `${g.players} spillere`))))))),
    installHint());
}

function bingoCard() {
  const bingo = loadBingo();
  const claimed = bingo?.claims?.length || 0;
  return h("a", { class: "card trip-card", href: "#/bingo" },
    h("span", { class: "tag" }, "Hele turen"),
    h("h2", {}, "Japan-bingo"),
    h("p", { class: "muted small", style: "margin:0" }, bingo
      ? `${claimed} af 25 felter er taget${bingo.boardNo > 1 ? ` på plade ${bingo.boardNo}` : ""}. Se stillingen.`
      : "Se det først, og få pointene. Én plade til hele rejsen."));
}

/** "Klar til brug uden net" once every file is on the phone. */
function offlineLine() {
  const line = h("p", { class: "offline-status", hidden: true });
  let tries = 0;
  const update = async () => {
    const status = await offlineStatus().catch(() => null);
    if (!status || !line.isConnected) return;
    tries += 1;
    line.hidden = false;
    line.replaceChildren(...(status === "ready"
      ? [h("span", { class: "check", "aria-hidden": "true" }, "✓"), "Klar til brug uden net"]
      : ["Gør klar til brug uden net ..."]));
    if (status !== "ready" && tries < 40) whenInstalled().then(() => setTimeout(update, 1500));
  };
  update();
  return line;
}

function installHint() {
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if (standalone) return null;
  return h("footer", {}, "Læg appen på hjemmeskærmen, så åbner den som en rigtig app og virker uden netværk. På iPhone: tryk Del og så Føj til hjemmeskærm.");
}
