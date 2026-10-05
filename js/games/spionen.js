// Spionen on screen. Like Imposter: one QR code for everyone, or one phone passed round.
// Each player sees the location and their role; the spy sees the list of possible locations.
import { h, mount, confirmSheet, listNames } from "../ui.js";
import { joinCode } from "../invite.js";
import { myName } from "../prefs.js";
import { dealSpy } from "./spionen-logic.js";
import { gameTop, holdToReveal, modeTiles, chips, fmtClock } from "./ui.js";

export const defaults = { mode: "multi", spies: 1, minutes: 8 };

export function settingsView({ settings: s, players, redraw }) {
  return [
    modeTiles(s, redraw),
    players.length >= 7 ? h("section", { class: "field" }, h("h3", { style: "margin:0" }, "Antal spioner"),
      chips([{ id: 1, label: "Én" }, { id: 2, label: "To" }], () => s.spies, (v) => { s.spies = v; redraw(); })) : null,
    h("section", { class: "field" }, h("h3", { style: "margin:0" }, "Tid pr. runde"),
      chips([5, 8, 10].map((v) => ({ id: v, label: `${v} min.` })), () => s.minutes, (v) => { s.minutes = v; redraw(); })),
  ];
}

export function newGame({ players, settings }) {
  return { round: 1, me: players.indexOf(myName()), phase: settings.mode === "multi" ? "invite" : "pass", seat: 0, endsAt: null };
}

export const join = () => ({ round: 1, me: -1, phase: "who", endsAt: null });

let ticker = null;
export function cleanup() { if (ticker) { clearInterval(ticker); ticker = null; } }

export async function render(root, ctx) {
  cleanup();
  const { game, data } = ctx;
  const players = game.players;
  const deal = dealSpy({ seed: game.seed, round: game.round, playerCount: players.length, locations: data.locations, spies: game.settings.spies });
  const top = gameTop({ name: "Spionen", onLeave: () => ctx.finish(), right: `Runde ${game.round}` });
  const go = (phase, extra = {}) => { ctx.save({ phase, ...extra }); ctx.redraw(); };
  const placeList = () => h("details", { class: "places" },
    h("summary", {}, `Alle mulige steder (${data.locations.length})`),
    h("p", { class: "small" }, data.locations.map((l) => l.name).join(" · ")));

  if (game.phase === "invite") {
    mount(root, top,
      h("h1", { class: "page-title" }, "Scan for at være med"),
      h("p", {}, "Åbn kameraet, scan koden, og tryk på dit navn. Det er kun nødvendigt én gang pr. spil."),
      await joinCode(game, "Spionen"),
      h("p", { class: "meta center" }, listNames(players)),
      h("button", { class: "btn big", onclick: () => go(game.me >= 0 ? "round" : "who") }, "Alle er med"));
    return;
  }

  if (game.phase === "who" || (game.settings.mode === "multi" && !(game.me >= 0))) {
    mount(root, top,
      h("h1", { class: "page-title" }, "Hvem er du?"),
      h("p", {}, "Tryk på dit eget navn."),
      h("div", { class: "stack" }, ...players.map((name, i) => h("button", { class: "btn big", onclick: () => go("round", { me: i }) }, name))));
    return;
  }

  const secretFor = (i) => () => (deal.roles[i] === null
    ? { imposter: true, node: h("div", { class: "stack", style: "align-items:center" },
        h("span", { class: "label" }, "Du er"), h("span", { class: "big" }, "Spionen"),
        h("span", {}, "Lyt efter, hvor I er. Gæt stedet, før de finder dig."),
        deal.spies.length > 1 ? h("span", { class: "meta" }, "Der er to spioner i denne runde") : null) }
    : { imposter: false, node: h("div", { class: "stack", style: "align-items:center" },
        h("span", { class: "label" }, "I er på"), h("span", { class: "big" }, deal.location.name),
        h("span", { class: "label" }, "Din rolle"), h("span", { style: "font-weight:600" }, deal.roles[i])) });

  const reveal = async () => { if (await confirmSheet("Afslør spionen?", "Har spionen gættet, eller har I stemt?", "Afslør", "Ikke endnu")) go("revealed"); };
  const nextRound = () => go(game.settings.mode === "multi" ? "round" : "pass", { round: game.round + 1, seat: 0, endsAt: null });
  const timer = () => {
    const text = h("span", { class: "timer-text" });
    const box = h("div", { class: "stack", style: "align-items:center;gap:6px" }, text,
      game.endsAt ? null : h("button", { class: "btn small ghost", onclick: () => go(game.phase, { endsAt: Date.now() + game.settings.minutes * 60000 }) }, `Start ${game.settings.minutes} minutter`));
    const tick = () => {
      if (!game.endsAt) { text.textContent = fmtClock(game.settings.minutes * 60000); return; }
      const ms = Math.max(0, game.endsAt - Date.now());
      text.textContent = ms ? fmtClock(ms) : "Tiden er gået. Stem!";
      if (!ms) { cleanup(); navigator.vibrate?.([300, 100, 300]); }
    };
    tick();
    if (game.endsAt) ticker = setInterval(() => { if (location.hash !== "#/spil") { cleanup(); return; } tick(); }, 500);
    return box;
  };

  if (game.phase === "revealed") {
    const names = deal.spies.map((i) => players[i]);
    mount(root, top,
      h("div", { class: "game-card" },
        h("span", { class: "label" }, names.length > 1 ? "Spionerne var" : "Spionen var"),
        h("span", { class: "big" }, listNames(names)),
        h("span", {}, `I var på ${deal.location.name}`)),
      h("button", { class: "btn big", onclick: nextRound }, "Næste runde"),
      h("button", { class: "btn ghost", onclick: () => ctx.finish() }, "Afslut spillet"));
    return;
  }

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
      h("div", { class: "game-card" }, h("span", { class: "label" }, "Første spørgsmål stilles af"), h("span", { class: "big" }, players[deal.starter]),
        h("span", {}, "Spørg én om noget, der har med stedet at gøre. Den, der svarer, spørger den næste.")),
      timer(),
      h("button", { class: "btn big", onclick: reveal }, "Afslør spionen"),
      placeList());
    return;
  }

  const mine = game.me;
  mount(root, top,
    h("p", { class: "center" }, `Du er ${players[mine]} · `, h("b", {}, `${players[deal.starter]} spørger først`)),
    holdToReveal({ secret: secretFor(mine) }),
    timer(),
    h("button", { class: "btn big", onclick: reveal }, "Afslør spionen"),
    h("div", { class: "stepper", "aria-label": "Runde" },
      h("button", { type: "button", "aria-label": "Forrige runde", onclick: () => game.round > 1 && go("round", { round: game.round - 1, endsAt: null }) }, "‹"),
      h("span", {}, `Runde ${game.round}`),
      h("button", { type: "button", "aria-label": "Næste runde", onclick: () => go("round", { round: game.round + 1, endsAt: null }) }, "›")),
    placeList(),
    game.host ? h("button", { class: "linkbtn", onclick: () => go("invite") }, "Vis QR-koden igen") : null);
}
