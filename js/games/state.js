// The game being played on this phone, kept in localStorage so a reload or a locked
// screen doesn't lose it. One game at a time.

const KEY = "kt-game";

export function currentGame() {
  try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch { return null; }
}

export function saveGame(game) {
  try { localStorage.setItem(KEY, JSON.stringify(game)); } catch { /* storage unavailable */ }
  return game;
}

export function clearGame() {
  try { localStorage.removeItem(KEY); } catch { /* storage unavailable */ }
}
