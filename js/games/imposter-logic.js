// Imposter: everyone but the imposter(s) gets the same word. Pure functions: every phone
// computes the same round from the seed, the round number and the list of players.
import { hashString, mulberry32, seededShuffle } from "./rng.js";

/** Words to play with: one category, or all of them ("blandet"). */
export function wordPool(data, categoryId = "blandet") {
  const cats = data.categories.filter((c) => categoryId === "blandet" || c.id === categoryId);
  return cats.flatMap((c) => c.words.map((word) => ({ word, category: c.name })));
}

/** How many imposters fit the group: 1, or 2 from six players if asked for. */
export function imposterCount(players, wanted = 1) {
  return players >= 6 ? Math.min(wanted, 2) : 1;
}

/**
 * The round as every phone sees it.
 * Words come from one shuffled deck per game, so they don't repeat until the deck runs out.
 * The starter is never an imposter: the first word should give the group something to go on.
 */
export function dealRound({ seed, round, playerCount, words, imposters = 1 }) {
  if (playerCount < 3) throw new Error("Imposter kræver mindst tre spillere");
  const deck = seededShuffle(words, seed);
  const { word, category } = deck[(round - 1) % deck.length];
  const rng = mulberry32(hashString(`${seed}:${round}`));
  const order = seededShuffle([...Array(playerCount).keys()], Math.floor(rng() * 4294967296));
  const count = imposterCount(playerCount, imposters);
  const imposterIdx = order.slice(0, count).sort((a, b) => a - b);
  const others = order.slice(count);
  const starter = others[Math.floor(rng() * others.length)];
  return { round, word, category, imposters: imposterIdx, starter };
}

/** What one player sees. */
export function roleFor(deal, playerIndex, { hint = true } = {}) {
  const imposter = deal.imposters.includes(playerIndex);
  return imposter
    ? { imposter: true, word: null, category: hint ? deal.category : null }
    : { imposter: false, word: deal.word, category: deal.category };
}
