// Varulv on screen. The host is the narrator: they get the code to scan, a step-by-step
// night script and the village with who is alive. Each player sees only their own role.
import { h, mount, confirmSheet, listNames } from "../ui.js";
import { joinCode } from "../invite.js";
import { myName } from "../prefs.js";
import { ROLES, deal, nightSteps, winnerOf, wolvesFor } from "./varulv-logic.js";
import { gameTop, holdToReveal, modeTiles, chips } from "./ui.js";

export const defaults = { mode: "multi", wolves: "auto", seer: true, doctor: true };

export function settingsView({ settings: s, players, redraw }) {
  const narrator = myName() || "Fortælleren";
  const roster = players.filter((p) => p !== narrator);
  return [
    h("p", { class: "capture" }, `${narrator} er fortæller og spiller ikke med. ${roster.length} spiller med${roster.length < 5 ? ", der skal være mindst fem" : ""}.`),
    modeTiles(s, redraw),
    h("section", { class: "field" }, h("h3", { style: "margin:0" }, "Antal varulve"),
      chips([{ id: "auto", label: `Automatisk (${wolvesFor(Math.max(roster.length, 5))})` }, { id: 1, label: "1" }, { id: 2, label: "2" }, { id: 3, label: "3" }],
        () => s.wolves, (v) => { s.wolves = v; redraw(); })),
    h("label", { class: "row" }, h("input", { type: "checkbox", checked: s.seer, onchange: (e) => { s.seer = e.target.checked; } }), "Med Seeren"),
    h("label", { class: "row" }, h("input", { type: "checkbox", checked: s.doctor, onchange: (e) => { s.doctor = e.target.checked; } }), "Med Lægen (fra seks spillere)"),
  ];
}

export function newGame({ players, settings }) {
  const narrator = myName() || "Fortælleren";
  settings.narrator = narrator;
  settings.roster = players.filter((p) => p !== narrator);
  return { gameNo: 1, phase: settings.mode === "multi" ? "invite" : "pass", seat: 0, step: 0, night: 1, me: -1,
    alive: settings.roster.map(() => true) };
}

/** A player who scanned the narrator's code picks their name first. */
export function join() {
  return { gameNo: 1, phase: "who", me: -1 };
}

export const minRoster = 5;

function rolesOf(game) {
  const s = game.settings;
  const n = s.roster.length;
  return deal(game.seed, game.gameNo, n, { wolves: s.wolves === "auto" ? undefined : Number(s.wolves), seer: s.seer, doctor: s.doctor && n >= 6 });
}

function roleCard(game, roles, i) {
  return () => {
    const role = ROLES[roles[i]];
    const wolves = roles.map((r, j) => (r === "varulv" && j !== i ? game.settings.roster[j] : null)).filter(Boolean);
    return {
      imposter: roles[i] === "varulv",
      node: h("div", { class: "stack", style: "align-items:center" },
        h("span", { class: "label" }, "Du er"),
        h("span", { class: "big" }, role.name),
        h("span", {}, role.text),
        roles[i] === "varulv" && wolves.length ? h("span", { class: "meta" }, `De andre varulve: ${listNames(wolves)}`) : null),
    };
  };
}

export async function render(root, ctx) {
  const { game } = ctx;
  const roster = game.settings.roster;
  if (roster.length < minRoster) {
    mount(root, gameTop({ name: "Varulv", onLeave: () => ctx.finish({ ask: false }) }),
      h("p", {}, "Der skal være mindst fem spillere ud over fortælleren."));
    return;
  }
  const roles = rolesOf(game);
  const top = gameTop({ name: "Varulv", onLeave: () => ctx.finish(), right: `Spil ${game.gameNo}` });
  const go = (phase, extra = {}) => { ctx.save({ phase, ...extra }); ctx.redraw(); };
  const stepper = () => h("div", { class: "stepper", "aria-label": "Spil" },
    h("button", { type: "button", "aria-label": "Forrige spil", onclick: () => game.gameNo > 1 && go(game.phase, { gameNo: game.gameNo - 1 }) }, "‹"),
    h("span", {}, `Spil ${game.gameNo}`),
    h("button", { type: "button", "aria-label": "Næste spil", onclick: () => go(game.phase, { gameNo: game.gameNo + 1 }) }, "›"));

  // ----- Players (guests) -----
  if (!game.host) {
    if (game.phase === "who" || !(game.me >= 0)) {
      mount(root, top,
        h("h1", { class: "page-title" }, "Hvem er du?"),
        h("p", {}, `${game.settings.narrator} er fortæller. Tryk på dit eget navn.`),
        h("div", { class: "stack" }, ...roster.map((name, i) => h("button", { class: "btn big", onclick: () => go("role", { me: i }) }, name))));
      return;
    }
    mount(root, top,
      h("p", { class: "center" }, `Du er ${roster[game.me]}`),
      holdToReveal({ prompt: "Hold fingeren her for at se din rolle", secret: roleCard(game, roles, game.me) }),
      h("p", { class: "meta center" }, `Læg telefonen væk, og følg ${game.settings.narrator}. Når fortælleren starter et nyt spil, skifter du også til næste spil her.`),
      stepper());
    return;
  }

  // ----- The narrator (host) -----
  if (game.phase === "invite") {
    mount(root, top,
      h("h1", { class: "page-title" }, "Scan for at få din rolle"),
      h("p", {}, "Alle undtagen fortælleren scanner koden og trykker på deres navn."),
      await joinCode(game, "Varulv"),
      h("p", { class: "meta center" }, listNames(roster)),
      h("button", { class: "btn big", onclick: () => go("night", { step: 0 }) }, "Alle har deres rolle"));
    return;
  }

  if (game.phase === "pass") {
    const seat = game.seat || 0;
    if (seat < roster.length) {
      let seen = false;
      const next = h("button", { class: "btn big", disabled: true, onclick: () => go("pass", { seat: seat + 1 }) }, "Skjul og giv videre");
      mount(root, top,
        h("p", { class: "meta center" }, `${seat + 1} af ${roster.length}`),
        h("h1", { class: "page-title center" }, `Giv telefonen til ${roster[seat]}`),
        holdToReveal({ prompt: `${roster[seat]}: hold fingeren her`, secret: roleCard(game, roles, seat), onSeen: () => { if (!seen) { seen = true; next.disabled = false; } } }),
        next);
      return;
    }
    mount(root, top,
      h("h1", { class: "page-title" }, `Giv telefonen til ${game.settings.narrator}`),
      h("p", {}, "Alle har set deres rolle. Fortælleren styrer resten."),
      h("button", { class: "btn big", onclick: () => go("night", { step: 0 }) }, "Jeg er fortælleren"));
    return;
  }

  // Narrator's view: the script, then the village.
  const steps = nightSteps(roles);
  const step = Math.min(game.step || 0, steps.length - 1);
  const won = winnerOf(roles, game.alive);
  const newGameRound = async () => {
    const msg = game.settings.mode === "multi" ? "Alle får nye roller. Bed de andre trykke på pilen ved Spil på deres telefon." : "Alle får nye roller, og telefonen går rundt igen.";
    if (await confirmSheet("Nyt spil?", msg, "Nyt spil", "Fortryd")) {
      go(game.settings.mode === "multi" ? "night" : "pass", { gameNo: game.gameNo + 1, alive: roster.map(() => true), step: 0, night: 1, seat: 0 });
    }
  };

  mount(root, top,
    won ? h("div", { class: "game-card" }, h("span", { class: "label" }, "Slut"),
      h("span", { class: "big" }, won === "ulve" ? "Varulvene vinder" : "Landsbyen vinder"),
      h("span", {}, `Varulvene var ${listNames(roster.filter((_, i) => roles[i] === "varulv"))}.`)) : null,
    won ? null : h("div", { class: "game-card", style: "align-items:flex-start;text-align:left" },
      h("span", { class: "label" }, `Nat ${game.night} · trin ${step + 1} af ${steps.length}`),
      h("span", { style: "font:600 1.25rem/1.35 var(--body)" }, steps[step])),
    won ? null : h("div", { class: "game-actions" },
      h("button", { class: "btn ghost", onclick: () => go("night", { step: Math.max(0, step - 1) }) }, "Tilbage"),
      h("button", { class: "btn", onclick: () => go("night", step === steps.length - 1 ? { step: 0, night: game.night + 1 } : { step: step + 1 }) },
        step === steps.length - 1 ? "Ny nat" : "Næste")),
    h("section", {}, h("h3", { style: "margin:0 0 8px;color:inherit" }, "Landsbyen (tryk på dem, der er ude)"),
      h("ul", { class: "result-list" }, ...roster.map((name, i) => h("li", {
        style: `cursor:pointer;${game.alive[i] ? "" : "opacity:.55;text-decoration:line-through"}`,
        onclick: () => { const alive = [...game.alive]; alive[i] = !alive[i]; go("night", { alive }); },
      }, h("span", {}, name), h("span", {}, ROLES[roles[i]].name))))),
    h("button", { class: won ? "btn big" : "btn ghost", onclick: newGameRound }, "Nyt spil med nye roller"),
    game.settings.mode === "multi" ? h("button", { class: "linkbtn", onclick: () => go("invite") }, "Vis QR-koden igen") : null);
}
