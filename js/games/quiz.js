// Quiz: one phone, one person reads the question aloud. Pick one or more quizzes (a mixed
// one and harder themed ones), play each for themselves or in two teams, and choose whether
// the four options are shown. Hidden options make every question a lot harder.
import { h, mount, listNames } from "../ui.js";
import { seededShuffle } from "./rng.js";
import { makeTeams } from "./tabu-logic.js";
import { gameTop, chips } from "./ui.js";

export const defaults = { mode: "hver", count: 20, packs: [], options: "vis" };

const LEVEL = { normal: "Almindelig", svaer: "Svær" };

/** The packs in play: the chosen ones, or every hard pack if none are chosen. */
export function chosenPacks(data, picked) {
  if (picked.length) return data.packs.filter((p) => picked.includes(p.id));
  const hard = data.packs.filter((p) => p.level === "svaer");
  return hard.length ? hard : data.packs;
}

export function settingsView({ settings: s, data, redraw }) {
  if (!data) return [];
  const active = new Set(chosenPacks(data, s.packs).map((p) => p.id));
  const toggle = (id) => {
    const now = [...active];
    s.packs = now.includes(id) ? now.filter((x) => x !== id) : [...now, id];
    if (!s.packs.length) s.packs = [];
    redraw();
  };
  const total = chosenPacks(data, s.packs).reduce((n, p) => n + p.questions.length, 0);
  return [
    h("section", { class: "field" }, h("h3", { style: "margin:0" }, "Quizzer"),
      h("div", { class: "chips" }, ...data.packs.map((p) => h("button", {
        class: "chip", type: "button", "aria-pressed": String(active.has(p.id)), onclick: () => toggle(p.id),
      }, p.level === "svaer" ? `${p.name} · svær` : p.name))),
      h("p", { class: "meta" }, `${total} spørgsmål i spil.`)),
    h("section", { class: "field" }, h("h3", { style: "margin:0" }, "Svarmuligheder"),
      chips([{ id: "vis", label: "Vis fire muligheder" }, { id: "skjul", label: "Skjul dem (sværere)" }], () => s.options, (v) => { s.options = v; redraw(); }),
      h("p", { class: "meta" }, s.options === "skjul" ? "I svarer frit. Mulighederne kan vises på det enkelte spørgsmål, hvis ingen aner det." : "Læs alle fire muligheder højt.")),
    h("section", { class: "field" }, h("h3", { style: "margin:0" }, "Hvordan spiller I?"),
      chips([{ id: "hver", label: "Hver for sig" }, { id: "hold", label: "To hold" }], () => s.mode, (v) => { s.mode = v; redraw(); })),
    h("section", { class: "field" }, h("h3", { style: "margin:0" }, "Antal spørgsmål"),
      chips([10, 20, 30].map((v) => ({ id: v, label: String(v) })), () => s.count, (v) => { s.count = v; redraw(); })),
  ];
}

export function newGame({ players, settings, data, seed }) {
  const pool = chosenPacks(data, settings.packs).flatMap((p) => p.questions.map((_, i) => [p.id, i]));
  const order = seededShuffle(pool, seed).slice(0, settings.count);
  const sides = settings.mode === "hold"
    ? makeTeams(players, seed).map((t, i) => ({ id: `hold${i + 1}`, label: `Hold ${i + 1}`, members: t }))
    : players.map((p) => ({ id: p, label: p, members: [p] }));
  return { order, pos: 0, phase: "question", sides, scores: {}, correct: [], showOptions: false };
}

function lookup(data, [packId, i]) {
  const pack = data.packs.find((p) => p.id === packId);
  const q = pack?.questions[i];
  return q ? { ...q, label: q.category || pack.name, level: pack.level } : null;
}

export function render(root, ctx) {
  const { game, data } = ctx;
  const q = game.order[game.pos] ? lookup(data, game.order[game.pos]) : null;
  const go = (phase, extra = {}) => { ctx.save({ phase, ...extra }); ctx.redraw(); };
  const board = () => {
    const rows = game.sides.map((s) => [s, game.scores[s.id] || 0]).sort((a, b) => b[1] - a[1]);
    return h("ul", { class: "result-list" }, ...rows.map(([s, n]) => h("li", {}, h("span", {}, s.members.length > 1 ? `${s.label}: ${listNames(s.members)}` : s.label), h("span", {}, `${n} point`))));
  };

  if (!q || game.phase === "end") {
    const best = Math.max(0, ...game.sides.map((s) => game.scores[s.id] || 0));
    const winners = game.sides.filter((s) => (game.scores[s.id] || 0) === best && best > 0);
    mount(root, gameTop({ name: "Quiz", onLeave: () => ctx.finish({ ask: false }) }),
      h("div", { class: "game-card" }, h("span", { class: "label" }, winners.length > 1 ? "Delt sejr" : "Vinder"),
        h("span", { class: "big" }, winners.length ? listNames(winners.map((w) => w.label)) : "Ingen point"),
        h("span", {}, `${best} af ${game.order.length} rigtige`)),
      board(),
      h("button", { class: "btn big", onclick: () => ctx.finish({ ask: false }) }, "Afslut"));
    return;
  }

  const top = gameTop({ name: "Quiz", onLeave: () => ctx.finish(), right: `${game.pos + 1}/${game.order.length}` });
  const shown = game.phase === "answer";
  const hideOptions = game.settings.options === "skjul" && !game.showOptions && !shown;
  const options = hideOptions ? null : h("ol", { class: "options" }, ...q.options.map((o, i) => h("li", {
    class: shown ? (i === q.answer ? "right" : "wrong") : "",
  }, h("b", {}, "ABCD"[i]), o)));
  const label = h("span", { class: "label" }, q.level === "svaer" ? `${q.label} · svær` : q.label);

  if (!shown) {
    mount(root, top,
      h("div", { class: "game-card", style: "align-items:stretch;text-align:left" },
        label,
        h("span", { style: "font:700 clamp(1.3rem,6vw,1.7rem)/1.25 var(--display)" }, q.q),
        options),
      h("p", { class: "center" }, hideOptions ? "Alle svarer frit, før I viser svaret." : "Læs spørgsmålet og svarene højt. Alle svarer, før I viser svaret."),
      h("button", { class: "btn big", onclick: () => go("answer") }, "Vis svaret"),
      hideOptions ? h("button", { class: "btn ghost", onclick: () => go("question", { showOptions: true }) }, "Ingen aner det. Vis mulighederne") : null);
    return;
  }

  const toggle = (id) => { const c = game.correct || []; ctx.save({ correct: c.includes(id) ? c.filter((x) => x !== id) : [...c, id] }); ctx.redraw(); };
  const next = () => {
    const scores = { ...game.scores };
    for (const id of game.correct || []) scores[id] = (scores[id] || 0) + 1;
    const pos = game.pos + 1;
    go(pos >= game.order.length ? "end" : "question", { scores, pos, correct: [], showOptions: false });
  };
  mount(root, top,
    h("div", { class: "game-card", style: "align-items:stretch;text-align:left" },
      label,
      h("span", { style: "font:700 1.15rem/1.3 var(--display)" }, q.q),
      h("span", { class: "answer" }, q.options[q.answer]),
      options),
    h("section", { class: "field" }, h("h3", { style: "margin:0;color:inherit" }, "Hvem svarede rigtigt?"),
      h("div", { class: "chips" }, ...game.sides.map((s) => h("button", { class: "chip", type: "button", "aria-pressed": String((game.correct || []).includes(s.id)), onclick: () => toggle(s.id) }, s.label)))),
    h("button", { class: "btn big", onclick: next }, game.pos + 1 >= game.order.length ? "Se resultatet" : "Næste spørgsmål"),
    board());
}
