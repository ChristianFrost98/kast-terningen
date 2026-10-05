// Tabu on one phone: two teams take turns, the explainer holds the phone. Pure helpers.
import { seededShuffle } from "./rng.js";

/** Splits players into two teams of (nearly) equal size, shuffled by the seed. */
export function makeTeams(players, seed) {
  const shuffled = seededShuffle(players, seed);
  return [shuffled.filter((_, i) => i % 2 === 0), shuffled.filter((_, i) => i % 2 === 1)];
}

export const POINTS = { right: 1, skip: 0, taboo: -1 };

export function turnScore(results) {
  return results.reduce((sum, r) => sum + (POINTS[r.result] ?? 0), 0);
}

/** Who explains on a team's n-th turn (0-based): everyone takes their turn in order. */
export function explainer(team, teamTurn) {
  return team[teamTurn % team.length];
}

export function winner(scores) {
  if (scores[0] === scores[1]) return null;
  return scores[0] > scores[1] ? 0 : 1;
}
