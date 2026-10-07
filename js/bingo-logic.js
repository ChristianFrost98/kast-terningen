// Japan-bingo: a 5x5 board of things to spot on the trip. Whoever spots a thing first claims it
// for its points, and whoever completes a row, column or diagonal gets a bonus.

export const SIZE = 5;
export const LINE_BONUS = 3;
/** How many items of each point value a board gets, so every board is about as hard. */
const MIX = { 1: 10, 2: 9, 3: 6 };

/** Every row, column and the two diagonals, as lists of cell indexes. */
export const LINES = [
  ...Array.from({ length: SIZE }, (_, r) => Array.from({ length: SIZE }, (_, c) => r * SIZE + c)),
  ...Array.from({ length: SIZE }, (_, c) => Array.from({ length: SIZE }, (_, r) => r * SIZE + c)),
  Array.from({ length: SIZE }, (_, i) => i * SIZE + i),
  Array.from({ length: SIZE }, (_, i) => i * SIZE + (SIZE - 1 - i)),
];

/** 25 item ids: a fixed mix of point values in random places. Avoids `exclude` when it can. */
export function newBoard(items, rnd = Math.random, exclude = []) {
  const shuffle = (list) => {
    const copy = [...list];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  };
  const picked = Object.entries(MIX).flatMap(([points, count]) => {
    const pool = shuffle(items.filter((i) => i.points === Number(points)));
    // Fresh items first, then ones from earlier boards if there aren't enough.
    const fresh = pool.filter((i) => !exclude.includes(i.id));
    return [...fresh, ...pool.filter((i) => exclude.includes(i.id))].slice(0, count);
  });
  return shuffle(picked).map((i) => i.id);
}

/** An unused item with the same points as the one in `cell`, or null. */
export function swapCandidate(board, cell, items, rnd = Math.random) {
  const current = items.find((i) => i.id === board[cell]);
  const options = items.filter((i) => i.points === current?.points && !board.includes(i.id));
  return options.length ? options[Math.floor(rnd() * options.length)].id : null;
}

/**
 * Scores for a board. claims is the claim history in order: [{ cell, by }], by = player index.
 * The player whose claim completes a line gets the bonus for it.
 */
export function scoreBoard({ board, claims, items, players }) {
  const byId = new Map(items.map((i) => [i.id, i]));
  const owner = new Map();
  const points = players.map(() => 0);
  const lines = [];
  for (const { cell, by } of claims) {
    if (owner.has(cell) || !(by >= 0 && by < players.length)) continue;
    owner.set(cell, by);
    points[by] += byId.get(board[cell])?.points || 0;
    LINES.forEach((line, n) => {
      if (line.includes(cell) && line.every((c) => owner.has(c))) {
        lines.push({ line: n, by });
        points[by] += LINE_BONUS;
      }
    });
  }
  return { owner, points, lines };
}

/** Totals for the whole trip: earlier boards plus this one, by name, highest first. */
export function standings(state, items) {
  const { points } = scoreBoard({ ...state, items });
  const totals = new Map(state.players.map((name, i) => [name, (state.past?.[name] || 0) + points[i]]));
  return [...totals].map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
}
