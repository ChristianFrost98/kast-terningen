// Spionen (like Spyfall): everyone but the spy gets the same location and a role there.
// Pure: every phone deals the same round from the seed, the round and the number of players.
import { hashString, mulberry32, seededShuffle } from "./rng.js";

/** One spy, or two from seven players if asked for. */
export const spyCount = (players, wanted = 1) => (players >= 7 ? Math.min(wanted, 2) : 1);

export function dealSpy({ seed, round, playerCount, locations, spies = 1 }) {
  if (playerCount < 3) throw new Error("Spionen kræver mindst tre spillere");
  const deck = seededShuffle(locations, seed);
  const location = deck[(round - 1) % deck.length];
  const rng = mulberry32(hashString(`${seed}:spy:${round}`));
  const order = seededShuffle([...Array(playerCount).keys()], Math.floor(rng() * 4294967296));
  const spyIdx = order.slice(0, spyCount(playerCount, spies)).sort((a, b) => a - b);
  const roles = seededShuffle(location.roles, hashString(`${seed}:roles:${round}`));
  let next = 0;
  const assigned = [...Array(playerCount).keys()].map((i) => (spyIdx.includes(i) ? null : roles[next++ % roles.length]));
  const others = order.slice(spyIdx.length);
  return { round, location: { id: location.id, name: location.name }, spies: spyIdx, roles: assigned, starter: others[Math.floor(rng() * others.length)] };
}
