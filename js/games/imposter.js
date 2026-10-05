// Imposter on screen. Multi-phone: everyone scans one QR code, picks their name, and each
// phone works out its own role from the seed. One phone: it goes round the table.
import { h, mount, confirmSheet, listNames } from "../ui.js";
import { joinCode } from "../invite.js";
import { myName } from "../prefs.js";
import { dealRound, roleFor, wordPool } from "./imposter-logic.js";
import { gameTop, holdToReveal, modeTiles, chips } from "./ui.js";

export const defaults = { category: "blandet", imposters: 1, hint: true, mode: "multi" };

export function settingsView({ settings: s, players, data, redraw }) {
  return [
    modeTiles(s, redraw),
    data ? h("section", { class: "field" }, h("h3", { style: "margin:0" }, "Kategori"),
      chips([{ id: "blandet", label: "Blandet" }, ...data.categories.map((c) => ({ id: c.id, label: c.name }))],
        () => s.category, (id) => { s.category = id; redraw(); })) : null,
    players.length >= 6 ? h("section", { class: "field" }, h("h3", { style: "margin:0" }, "Antal imposters"),
      chips([{ id: 1, label: "Én" }, { id: 2, label: "To" }], () => s.imposters, (id) => { s.imposters = id; redraw(); })) : null,
    h("label", { class: "row" }, h("input", { type: "checkbox", checked: s.hint, onchange: (e) => { s.hint = e.target.checked; } }),
      "Imposteren får kategorien som hjælp"),
  ];
}

/** A guest who scanned the host's code starts by picking their name. */
export function join() {
  return { round: 1, me: -1, log: [], phase: "who" };
}

export function newGame({ players, settings }) {
  return { round: 1, me: players.indexOf(myName()), log: [], phase: settings.mode === "multi" ? "invite" : "pass", seat: 0 };
}

export async function render(root, ctx) {
  const { game, data } = ctx;
  const players = game.players;
  const words = wordPool(data, game.settings.category);
  const deal = dealRound({ seed: game.seed, round: game.round, playerCount: players.length, words, imposters: game.settings.imposters });
  const top = gameTop({ name: "Imposter", onLeave: () => ctx.finish(), right: `Runde ${game.round}` });
  const outdated = game.dataVersion && data.version !== game.dataVersion
    ? h("p", { class: "capture" }, "Jeres apps har forskellige ordlister. Opdater appen, ellers får I forskellige ord.") : null;

  const go = (phase, extra = {}) => { ctx.save({ phase, ...extra }); ctx.redraw(); };

  // Host shows the code; everyone scans it with the camera.
  if (game.phase === "invite") {
    mount(root, top,
      h("h1", { class: "page-title" }, "Scan for at være med"),
      h("p", {}, "Åbn kameraet, scan koden, og tryk på dit navn. Det er kun nødvendigt én gang pr. spil."),
      await joinCode(game, "Imposter"),
      h("p", { class: "meta center" }, listNames(players)),
      h("button", { class: "btn big", onclick: () => go(game.me >= 0 ? "round" : "who") }, "Alle er med"));
    return;
  }

  // Which player is this phone?
  if (game.phase === "who" || (game.settings.mode === "multi" && !(game.me >= 0))) {
    mount(root, top,
      h("h1", { class: "page-title" }, "Hvem er du?"),
      h("p", {}, "Tryk på dit eget navn. Så viser telefonen kun dit ord."),
      h("div", { class: "stack" }, ...players.map((name, i) => h("button", { class: "btn big", onclick: () => go("round", { me: i }) }, name))),
      outdated);
    return;
  }

  const starter = players[deal.starter];
  const reveal = () => go("revealed", { log: logRound(game, deal) });
  const askReveal = async () => { if (await confirmSheet("Har I stemt?", "Når I har peget på jeres mistænkte, afslører I imposteren.", "Afslør", "Ikke endnu")) reveal(); };
  const nextRound = () => go(game.settings.mode === "multi" ? "round" : "pass", { round: game.round + 1, seat: 0 });
  const secretFor = (i) => () => {
    const role = roleFor(deal, i, { hint: game.settings.hint });
    return role.imposter
      ? { imposter: true, node: h("div", { class: "stack", style: "align-items:center" },
          h("span", { class: "label" }, "Du er"), h("span", { class: "big" }, "Imposter"),
          role.category ? h("span", {}, `Kategori: ${role.category}`) : h("span", {}, "Bluf dig igennem"),
          deal.imposters.length > 1 ? h("span", { class: "meta" }, "Der er to imposters i denne runde") : null) }
      : { imposter: false, node: h("div", { class: "stack", style: "align-items:center" },
          h("span", { class: "label" }, role.category), h("span", { class: "big" }, role.word)) };
  };

  if (game.phase === "revealed") {
    const names = deal.imposters.map((i) => players[i]);
    mount(root, top,
      h("div", { class: "game-card" },
        h("span", { class: "label" }, names.length > 1 ? "Imposterne var" : "Imposteren var"),
        h("span", { class: "big" }, listNames(names)),
        h("span", {}, `Ordet var ${deal.word}`)),
      h("button", { class: "btn big", onclick: nextRound }, "Næste runde"),
      h("button", { class: "btn ghost", onclick: () => ctx.finish() }, "Afslut spillet"));
    return;
  }

  // One phone: hand it to each player in turn.
  if (game.settings.mode === "single" && game.phase === "pass") {
    const seat = game.seat || 0;
    if (seat < players.length) {
      let seen = false;
      const next = h("button", { class: "btn big", disabled: true, onclick: () => go("pass", { seat: seat + 1 }) },
        seat === players.length - 1 ? "Skjul. Alle har set" : "Skjul og giv videre");
      mount(root, top,
        h("p", { class: "meta center" }, `${seat + 1} af ${players.length}`),
        h("h1", { class: "page-title center" }, `Giv telefonen til ${players[seat]}`),
        holdToReveal({ prompt: `${players[seat]}: hold fingeren her`, secret: secretFor(seat), onSeen: () => { if (!seen) { seen = true; next.disabled = false; } } }),
        next);
      return;
    }
    mount(root, top,
      h("h1", { class: "page-title" }, "Alle har set deres ord"),
      h("div", { class: "game-card" }, h("span", { class: "label" }, "Først siger"), h("span", { class: "big" }, starter),
        h("span", {}, "ét ord, der passer. Så går det rundt.")),
      h("button", { class: "btn big", onclick: askReveal }, "Afslør imposteren"));
    return;
  }

  // Multi-phone round: this phone shows only its own role.
  const mine = game.me;
  mount(root, top,
    outdated,
    h("p", { class: "center" }, `Du er ${players[mine]} · `, h("b", {}, `${starter} starter`)),
    holdToReveal({ secret: secretFor(mine) }),
    h("p", { class: "meta center" }, "Sig på skift ét ord, der passer. Stem om imposteren, når alle har sagt noget."),
    h("button", { class: "btn big", onclick: askReveal }, "Afslør imposteren"),
    h("div", { class: "stepper", "aria-label": "Runde" },
      h("button", { type: "button", "aria-label": "Forrige runde", onclick: () => game.round > 1 && go("round", { round: game.round - 1 }) }, "‹"),
      h("span", {}, `Runde ${game.round}`),
      h("button", { type: "button", "aria-label": "Næste runde", onclick: () => go("round", { round: game.round + 1 }) }, "›")),
    h("p", { class: "meta center" }, "Alle telefoner skal være på samme runde."),
    game.host ? h("button", { class: "linkbtn", onclick: () => go("invite") }, "Vis QR-koden igen") : null);
}

function logRound(game, deal) {
  const log = (game.log || []).filter((r) => r.round !== deal.round);
  log.push({ round: deal.round, word: deal.word, imposters: deal.imposters.map((i) => game.players[i]) });
  return log.sort((a, b) => a.round - b.round);
}
