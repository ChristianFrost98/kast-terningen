// Tegn og gæt: two teams, one phone, paper and a pen. The drawer peeks at the word, the
// timer runs, the team guesses from the drawing.
import { h, mount, listNames } from "../ui.js";
import { newSeed, seededShuffle } from "./rng.js";
import { explainer, makeTeams, winner } from "./tabu-logic.js";
import { gameTop, holdToReveal, chips } from "./ui.js";

export const defaults = () => ({ level: "blandet", seconds: 60, turnsPerTeam: 3, teamSeed: newSeed() });

export function settingsView({ settings: s, players, redraw }) {
  const teams = makeTeams(players, s.teamSeed);
  return [
    h("p", { class: "capture" }, "I skal bruge papir og en blyant."),
    players.length >= 4 ? h("section", { class: "field" }, h("h3", { style: "margin:0" }, "Holdene"),
      h("div", { class: "score-row" }, ...teams.map((t, i) => h("div", { class: "card", style: "padding:14px" },
        h("span", { class: "tag" }, `Hold ${i + 1}`), h("span", {}, listNames(t))))),
      h("button", { class: "btn small ghost", type: "button", onclick: () => { s.teamSeed = newSeed(); redraw(); } }, "Bland holdene")) : null,
    h("section", { class: "field" }, h("h3", { style: "margin:0" }, "Sværhed"),
      chips([{ id: "let", label: "Let" }, { id: "mellem", label: "Mellem" }, { id: "svaer", label: "Svær" }, { id: "blandet", label: "Blandet" }], () => s.level, (v) => { s.level = v; redraw(); })),
    h("section", { class: "field" }, h("h3", { style: "margin:0" }, "Tid pr. tegning"),
      chips([60, 90, 120].map((v) => ({ id: v, label: `${v} sek.` })), () => s.seconds, (v) => { s.seconds = v; redraw(); })),
    h("section", { class: "field" }, h("h3", { style: "margin:0" }, "Tegninger pr. hold"),
      chips([2, 3, 4].map((v) => ({ id: v, label: String(v) })), () => s.turnsPerTeam, (v) => { s.turnsPerTeam = v; redraw(); })),
  ];
}

export function newGame({ players, settings }) {
  return { teams: makeTeams(players, settings.teamSeed), scores: [0, 0], turn: 0, phase: "intro", history: [] };
}

let ticker = null;
export function cleanup() { if (ticker) { clearInterval(ticker); ticker = null; } }

export function render(root, ctx) {
  cleanup();
  const { game, data } = ctx;
  const s = game.settings;
  const words = s.level === "blandet" ? [...data.words.let, ...data.words.mellem, ...data.words.svaer] : data.words[s.level];
  const word = seededShuffle(words, game.seed)[game.turn % words.length];
  const total = s.turnsPerTeam * 2;
  const team = game.turn % 2;
  const drawer = explainer(game.teams[team], Math.floor(game.turn / 2));
  const top = gameTop({ name: "Tegn og gæt", onLeave: () => ctx.finish(), right: game.phase === "end" ? "" : `Tur ${Math.min(game.turn + 1, total)}/${total}` });
  const go = (phase, extra = {}) => { ctx.save({ phase, ...extra }); ctx.redraw(); };
  const scores = () => h("div", { class: "score-row" }, ...game.teams.map((t, i) => h("div", { class: `score${winner(game.scores) === i ? " leading" : ""}` },
    h("span", {}, `Hold ${i + 1}`), h("b", {}, String(game.scores[i])), h("span", { class: "meta" }, listNames(t)))));
  const finishTurn = (guessed) => {
    cleanup();
    const sc = [...game.scores];
    if (guessed) sc[team] += 1;
    const turn = game.turn + 1;
    go(turn >= total ? "end" : "intro", { scores: sc, turn, history: [...game.history, { team, drawer, word, guessed }], lastWord: word, lastGuessed: guessed });
  };

  if (game.phase === "intro") {
    mount(root, top,
      scores(),
      game.lastWord ? h("p", { class: "center" }, `Sidste ord var ${game.lastWord}${game.lastGuessed ? ", og det blev gættet." : "."}`) : null,
      h("div", { class: "game-card" },
        h("span", { class: "label" }, `Hold ${team + 1} tegner`),
        h("span", { class: "big" }, drawer),
        h("span", {}, `Giv telefonen til ${drawer}. Kun ${drawer} må se ordet.`)),
      h("button", { class: "btn big", onclick: () => go("peek") }, `Jeg er ${drawer}`));
    return;
  }

  if (game.phase === "peek") {
    mount(root, top,
      holdToReveal({ prompt: "Hold fingeren her for at se ordet", secret: () => ({ node: h("div", { class: "stack", style: "align-items:center" }, h("span", { class: "label" }, "Tegn"), h("span", { class: "big" }, word)) }) }),
      h("p", { class: "center" }, "Ingen bogstaver, tal eller lyde. Kun tegning."),
      h("button", { class: "btn big", onclick: () => go("draw", { endsAt: Date.now() + s.seconds * 1000 }) }, "Start tiden"));
    return;
  }

  if (game.phase === "draw") {
    const bar = h("span");
    const left = h("div", { class: "timer-text" });
    mount(root, top,
      h("div", { class: "timer" }, bar), left,
      h("p", { class: "center" }, `Hold ${team + 1} gætter, ${drawer} tegner.`),
      holdToReveal({ prompt: "Glemt ordet? Hold her", secret: () => ({ node: h("span", { class: "big" }, word) }) }),
      h("button", { class: "btn big", onclick: () => finishTurn(true) }, "Gættet!"),
      h("button", { class: "btn ghost", onclick: () => finishTurn(false) }, "Vi giver op"));
    const tick = () => {
      const ms = Math.max(0, game.endsAt - Date.now());
      bar.style.transform = `scaleX(${ms / (s.seconds * 1000)})`;
      left.textContent = String(Math.ceil(ms / 1000));
      if (!ms) { navigator.vibrate?.([300, 100, 300]); finishTurn(false); }
    };
    tick();
    ticker = setInterval(() => { if (location.hash !== "#/spil") { cleanup(); return; } tick(); }, 200);
    return;
  }

  const w = winner(game.scores);
  mount(root, top,
    h("div", { class: "game-card" },
      h("span", { class: "label" }, w === null ? "Uafgjort" : "Vinderne"),
      h("span", { class: "big" }, w === null ? `${game.scores[0]} mod ${game.scores[1]}` : listNames(game.teams[w]))),
    scores(),
    h("button", { class: "btn big", onclick: () => go("intro", { scores: [0, 0], turn: 0, history: [], seed: newSeed(), lastWord: null }) }, "Spil igen"),
    h("button", { class: "btn ghost", onclick: () => ctx.finish({ ask: false }) }, "Afslut spillet"));
}
