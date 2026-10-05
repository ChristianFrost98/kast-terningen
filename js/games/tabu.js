// Tabu on one phone: the explainer holds it, the team guesses, the other team watches for
// forbidden words. Points: right +1, skip 0, tabu -1.
import { h, mount, listNames } from "../ui.js";
import { seededShuffle, newSeed } from "./rng.js";
import { explainer, makeTeams, turnScore, winner } from "./tabu-logic.js";
import { gameTop, chips } from "./ui.js";

export const defaults = () => ({ seconds: 60, turnsPerTeam: 3, teamSeed: newSeed() });

export function settingsView({ settings: s, players, redraw }) {
  const teams = makeTeams(players, s.teamSeed);
  return [
    players.length >= 4 ? h("section", { class: "field" }, h("h3", { style: "margin:0" }, "Holdene"),
      h("div", { class: "score-row" }, ...teams.map((t, i) => h("div", { class: "card", style: "padding:14px" },
        h("span", { class: "tag" }, `Hold ${i + 1}`), h("span", {}, listNames(t))))),
      h("button", { class: "btn small ghost", type: "button", onclick: () => { s.teamSeed = newSeed(); redraw(); } }, "Bland holdene")) : null,
    h("section", { class: "field" }, h("h3", { style: "margin:0" }, "Tid pr. tur"),
      chips([60, 90, 120].map((v) => ({ id: v, label: `${v} sek.` })), () => s.seconds, (v) => { s.seconds = v; redraw(); })),
    h("section", { class: "field" }, h("h3", { style: "margin:0" }, "Ture pr. hold"),
      chips([2, 3, 4].map((v) => ({ id: v, label: String(v) })), () => s.turnsPerTeam, (v) => { s.turnsPerTeam = v; redraw(); })),
  ];
}

export function newGame({ players, settings }) {
  return { teams: makeTeams(players, settings.teamSeed), scores: [0, 0], turn: 0, deckPos: 0, history: [], phase: "intro" };
}

export function cleanup() { stopTicker(); }

let ticker = null;
const stopTicker = () => { if (ticker) { clearInterval(ticker); ticker = null; } };

export function render(root, ctx) {
  stopTicker();
  const { game, data } = ctx;
  const deck = seededShuffle(data.cards, game.seed);
  const totalTurns = game.settings.turnsPerTeam * 2;
  const team = game.turn % 2;
  const teamTurn = Math.floor(game.turn / 2);
  const who = explainer(game.teams[team], teamTurn);
  const top = gameTop({
    name: "Tabu",
    onLeave: () => ctx.finish(),
    right: game.phase === "end" ? "" : `Tur ${Math.min(game.turn + 1, totalTurns)}/${totalTurns}`,
  });
  const go = (phase, extra = {}) => { ctx.save({ phase, ...extra }); ctx.redraw(); };
  const scores = () => h("div", { class: "score-row" }, ...game.teams.map((t, i) => h("div", { class: `score${winner(game.scores) === i ? " leading" : ""}` },
    h("span", {}, `Hold ${i + 1}`), h("b", {}, String(game.scores[i])), h("span", { class: "meta" }, listNames(t)))));

  if (game.phase === "intro") {
    mount(root, top,
      scores(),
      h("div", { class: "game-card" },
        h("span", { class: "label" }, `Hold ${team + 1} forklarer`),
        h("span", { class: "big" }, who),
        h("span", {}, `Giv telefonen til ${who}. Det andet hold holder øje med de forbudte ord.`)),
      h("button", { class: "btn big", onclick: () => go("play", { results: [], endsAt: Date.now() + game.settings.seconds * 1000 }) },
        `Start ${game.settings.seconds} sekunder`));
    return;
  }

  if (game.phase === "play") {
    const card = deck[game.deckPos % deck.length];
    const bar = h("span");
    const text = h("div", { class: "timer-text", "aria-live": "off" });
    const tick = () => {
      const left = Math.max(0, game.endsAt - Date.now());
      bar.style.transform = `scaleX(${left / (game.settings.seconds * 1000)})`;
      text.textContent = `${Math.ceil(left / 1000)}`;
      if (left <= 0) {
        stopTicker();
        navigator.vibrate?.([300, 100, 300]);
        go("summary");
      }
    };
    const mark = (result) => {
      ctx.save({ results: [...(game.results || []), { word: card.word, result }], deckPos: game.deckPos + 1 });
      ctx.redraw();
    };
    mount(root, top,
      h("div", { class: "timer" }, bar), text,
      h("div", { class: "game-card" },
        h("span", { class: "big" }, card.word),
        h("ul", { class: "taboo-list" }, ...card.taboo.map((t) => h("li", {}, t)))),
      h("button", { class: "btn big", onclick: () => mark("right") }, "Rigtigt"),
      h("div", { class: "game-actions" },
        h("button", { class: "btn ghost", onclick: () => mark("skip") }, "Spring over"),
        h("button", { class: "btn ghost", onclick: () => mark("taboo") }, "Tabu!")),
      h("p", { class: "meta center" }, `${(game.results || []).filter((r) => r.result === "right").length} rigtige indtil nu`));
    tick();
    ticker = setInterval(() => {
      if (location.hash !== "#/spil") { stopTicker(); return; }
      tick();
    }, 200);
    return;
  }

  if (game.phase === "summary") {
    const results = game.results || [];
    const points = turnScore(results);
    const label = { right: "Rigtigt", skip: "Sprunget over", taboo: "Tabu" };
    const next = () => {
      const scoresNow = [...game.scores];
      scoresNow[team] += points;
      const turn = game.turn + 1;
      const history = [...(game.history || []), { team, explainer: who, points, results }];
      go(turn >= totalTurns ? "end" : "intro", { scores: scoresNow, turn, history, results: [] });
    };
    mount(root, top,
      h("h1", { class: "page-title" }, "Tiden er gået"),
      h("div", { class: "game-card" },
        h("span", { class: "label" }, `Hold ${team + 1} · ${who}`),
        h("span", { class: "big" }, `${points > 0 ? "+" : ""}${points} point`)),
      results.length ? h("ul", { class: "result-list" }, ...results.map((r) => h("li", {}, h("span", {}, r.word), h("span", {}, label[r.result])))) : null,
      h("button", { class: "btn big", onclick: next }, game.turn + 1 >= totalTurns ? "Se resultatet" : "Næste hold"));
    return;
  }

  // End of the game.
  const w = winner(game.scores);
  mount(root, top,
    h("div", { class: "game-card" },
      h("span", { class: "label" }, w === null ? "Uafgjort" : "Vinderne"),
      h("span", { class: "big" }, w === null ? `${game.scores[0]} mod ${game.scores[1]}` : listNames(game.teams[w]))),
    scores(),
    h("button", { class: "btn big", onclick: () => go("intro", { scores: [0, 0], turn: 0, history: [], seed: newSeed(), deckPos: 0 }) }, "Spil igen"),
    h("button", { class: "btn ghost", onclick: () => ctx.finish() }, "Afslut spillet"));
}
