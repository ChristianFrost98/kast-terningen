// Japan-bingo (#/bingo): one board for the whole trip. Lives in its own key in localStorage,
// so it survives the other games being started and finished in between.
import { h, mount, sheet, confirmSheet, toast } from "../ui.js";
import { appBar } from "../components.js";
import { newBoard, scoreBoard, standings, swapCandidate, LINE_BONUS, LINES } from "../bingo-logic.js";
import { recentPlayers, rememberPlayers } from "../prefs.js";

const KEY = "kt-bingo";
const COLORS = 6; // --p0 .. --p5 in app.css

export function loadBingo() {
  try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; }
}
function saveBingo(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { toast("Bingoen kunne ikke gemmes på telefonen."); }
}
function clearBingo() {
  try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
}

let items = null;
async function loadItems() {
  if (!items) items = fetch("data/games/bingo.json").then((r) => { if (!r.ok) throw new Error("bingo"); return r.json(); }).then((d) => d.items);
  return items.catch((e) => { items = null; throw e; });
}

export async function bingoView(root, app) {
  let list;
  try {
    list = await loadItems();
  } catch {
    mount(root, appBar({ back: { href: "#/", label: "Spil" } }), h("h1", { class: "page-title" }, "Hov"),
      h("p", {}, "Bingopladen kunne ikke hentes. Prøv igen med netværk."));
    return;
  }
  const state = loadBingo();
  if (!state) setup(root, app, list);
  else board(root, app, list, state);
}

function setup(root, app, list) {
  const picked = recentPlayers().slice(0, 4);
  const draw = () => {
    const names = [...new Set([...picked, ...recentPlayers()])];
    mount(root,
      appBar({ back: { href: "#/", label: "Spil" } }),
      h("header", {}, h("h1", { class: "page-title" }, "Japan-bingo"),
        h("p", { class: "lead" }, "Én plade til hele turen. Den, der ser tingen først, får pointene.")),
      h("div", { class: "card" },
        h("h2", {}, "Sådan spiller I"),
        h("ul", { class: "bingo-rules" },
          h("li", {}, "Pladen har 25 ting, I kan se eller prøve i Japan. Jo sjældnere, jo flere point."),
          h("li", {}, "Ser du noget? Tryk på feltet, og vælg dit navn. Den første får det."),
          h("li", {}, `Fuldender du en række, en kolonne eller en diagonal, får du ${LINE_BONUS} point ekstra.`),
          h("li", {}, "Er pladen brugt op, tager I en ny. Pointene tæller videre."))),
      h("section", { class: "field" },
        h("h3", { style: "margin:0" }, `Hvem er med? (${picked.length})`),
        h("div", { class: "chips" }, ...names.map((name) => h("button", { class: "chip", type: "button", "aria-pressed": String(picked.includes(name)),
          onclick: () => { const i = picked.indexOf(name); if (i >= 0) picked.splice(i, 1); else picked.push(name); draw(); } }, name))),
        h("form", { class: "inline-form", onsubmit: (e) => {
          e.preventDefault();
          for (const v of e.target.elements.name.value.split(",").map((s) => s.trim()).filter(Boolean)) if (!picked.includes(v)) picked.push(v);
          draw();
          root.querySelector('input[name="name"]')?.focus();
        } },
          h("input", { type: "text", name: "name", placeholder: "Tilføj en spiller", "aria-label": "Tilføj en spiller", autocomplete: "off" }),
          h("button", { class: "btn small ghost", type: "submit" }, "Tilføj"))),
      h("div", { class: "actionbar" }, h("div", { class: "inner" },
        picked.length < 2 ? h("span", { class: "meta", style: "flex:1" }, "I skal være mindst to.") : null,
        h("button", { class: "btn", disabled: picked.length < 2, onclick: () => {
          rememberPlayers(picked);
          const state = { players: [...picked], board: newBoard(list), claims: [], past: {}, boardNo: 1, startedAt: new Date().toISOString() };
          saveBingo(state);
          app.refresh();
        } }, "Lav pladen"))));
    document.body.classList.add("has-actionbar");
  };
  draw();
}

function board(root, app, list, state) {
  const byId = new Map(list.map((i) => [i.id, i]));
  const { owner, lines } = scoreBoard({ ...state, items: list });
  const table = standings(state, list);
  const lineCells = new Set(lines.flatMap((l) => LINES[l.line]));
  const color = (by) => `var(--p${by % COLORS})`;
  const full = owner.size === state.board.length;
  const save = (next) => { Object.assign(state, next); saveBingo(state); board(root, app, list, state); };

  const open = async (cell) => {
    const item = byId.get(state.board[cell]);
    if (!item) return;
    const by = owner.get(cell);
    const choice = await sheet((close) => h("div", { class: "stack" },
      h("span", { class: "tag" }, `${item.points} point`),
      h("h2", {}, item.short),
      h("p", {}, item.text),
      by === undefined
        ? h("div", { class: "stack", style: "gap:8px" },
            h("h3", { style: "margin:6px 0 0" }, "Hvem fik den først?"),
            h("div", { class: "bingo-who" }, ...state.players.map((name, i) => h("button", { class: "btn", style: `background:${color(i)};border-color:${color(i)};color:#fff`,
              onclick: () => close({ claim: i }) }, name))),
            h("button", { class: "linkbtn", onclick: () => close({ swap: true }) }, "Kan I ikke nå den? Byt den ud"))
        : h("div", { class: "stack", style: "gap:8px" },
            h("p", { class: "capture" }, h("b", {}, state.players[by]), " fik den."),
            h("button", { class: "btn ghost", onclick: () => close({ unclaim: true }) }, "Fjern, det var en fejl")),
      h("button", { class: "btn ghost", onclick: () => close(null) }, "Luk")));
    if (!choice) return;
    if (choice.claim !== undefined) {
      const before = lines.length;
      save({ claims: [...state.claims, { cell, by: choice.claim, at: Date.now() }] });
      const after = scoreBoard({ ...state, items: list }).lines.length;
      navigator.vibrate?.(after > before ? [120, 60, 120, 60, 240] : 60);
      toast(after > before ? `Bingo! ${state.players[choice.claim]} får ${LINE_BONUS} point ekstra.` : `${item.points} til ${state.players[choice.claim]}`);
    } else if (choice.unclaim) {
      save({ claims: state.claims.filter((c) => c.cell !== cell) });
    } else if (choice.swap) {
      const next = swapCandidate(state.board, cell, list);
      if (!next) { toast("Der er ikke flere ting at bytte med."); return; }
      const swapped = [...state.board];
      swapped[cell] = next;
      save({ board: swapped });
      toast(`Byttet ud med ${byId.get(next).short}`);
    }
  };

  const newPlate = async () => {
    if (!(await confirmSheet("Ny plade?", "I får 25 nye ting. Pointene fra denne plade tæller med i stillingen.", "Ny plade", "Fortryd"))) return;
    const { points } = scoreBoard({ ...state, items: list });
    const past = { ...state.past };
    state.players.forEach((name, i) => { past[name] = (past[name] || 0) + points[i]; });
    save({ board: newBoard(list, Math.random, state.board), claims: [], past, boardNo: (state.boardNo || 1) + 1 });
  };
  const restart = async () => {
    if (!(await confirmSheet("Start forfra?", "Pladen og alle point bliver slettet.", "Slet og start forfra", "Fortryd"))) return;
    clearBingo();
    app.refresh();
  };

  const leader = table[0];
  mount(root,
    appBar({ back: { href: "#/", label: "Spil" }, title: state.boardNo > 1 ? `Plade ${state.boardNo}` : "" }),
    h("header", {}, h("h1", { class: "page-title" }, "Japan-bingo"),
      h("p", { class: "lead" }, "Tryk på det, I ser. Den første får pointene.")),
    h("ol", { class: "bingo-scores" }, ...table.map((row) => {
      const i = state.players.indexOf(row.name);
      return h("li", { class: row === leader && row.total > 0 ? "leading" : null },
        h("span", { class: "dot", style: `background:${color(i)}` }), h("span", { class: "who" }, row.name), h("b", {}, String(row.total)));
    })),
    full ? h("div", { class: "card" },
      h("span", { class: "tag" }, "Pladen er fuld"),
      h("h2", {}, `${leader.name} fører med ${leader.total} point`),
      h("button", { class: "btn", onclick: newPlate }, "Tag en ny plade")) : null,
    h("div", { class: "bingo-grid", role: "grid", "aria-label": "Bingoplade" }, ...state.board.map((id, cell) => {
      const item = byId.get(id);
      const by = owner.get(cell);
      const claimed = by !== undefined;
      return h("button", {
        type: "button",
        class: `bingo-cell${claimed ? " claimed" : ""}${lineCells.has(cell) ? " line" : ""}`,
        style: claimed ? `--who:${color(by)}` : null,
        "aria-label": `${item?.short || "?"}, ${item?.points || 0} point${claimed ? `, ${state.players[by]} har den` : ""}`,
        onclick: () => open(cell),
      },
        h("span", { class: "label" }, item?.short || "?"),
        claimed ? h("span", { class: "by" }, state.players[by]) : h("span", { class: "pts", "aria-hidden": "true" }, "●".repeat(item?.points || 0)));
    })),
    h("p", { class: "meta center" }, `● = 1 point. Fuld række, kolonne eller diagonal: +${LINE_BONUS}.`),
    full ? null : h("button", { class: "btn ghost", onclick: newPlate }, "Ny plade"),
    h("button", { class: "linkbtn", onclick: restart }, "Start forfra med nye spillere"));
}
