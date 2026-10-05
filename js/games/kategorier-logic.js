// Kategorier: a letter and a handful of categories per round. Pure and seeded, so a round
// can be shown again after a reload.
import { hashString, seededShuffle } from "./rng.js";

// Letters with plenty of Danish words; C, Q, W, X, Y, Z, Æ, Ø and Å are left out.
export const LETTERS = [..."ABDEFGHIJKLMNOPRSTUV"];

export function roundFor({ seed, round, categories, count = 6 }) {
  const letters = seededShuffle(LETTERS, seed);
  const letter = letters[(round - 1) % letters.length];
  // Each round takes the next slice of one shuffled deck, so categories don't repeat early.
  const deck = seededShuffle(categories, hashString(`${seed}:kategorier`));
  const start = ((round - 1) * count) % deck.length;
  const picked = [...deck, ...deck].slice(start, start + count);
  return { round, letter, categories: picked };
}
