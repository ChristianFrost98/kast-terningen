// Varulv (Werewolf): which roles a village of a given size gets, who gets which, and
// who has won. Pure: every phone computes the same deal from the seed and the game number.
import { hashString, seededShuffle } from "./rng.js";

export const ROLES = {
  varulv: { name: "Varulv", team: "ulve", text: "Om natten vågner du sammen med de andre varulve, og I vælger et offer. Om dagen lader du som om, du er en helt almindelig landsbyboer." },
  seer: { name: "Seeren", team: "landsby", text: "Om natten peger du på én person. Fortælleren viser dig med tommelfingeren, om personen er varulv." },
  laege: { name: "Lægen", team: "landsby", text: "Om natten peger du på én, der bliver reddet, hvis varulvene vælger dem. Det må gerne være dig selv." },
  borger: { name: "Landsbyboer", team: "landsby", text: "Du sover om natten. Om dagen skal du finde varulvene og få dem stemt ud." },
};

/** Werewolves for a village: 1 up to 6 players, 2 up to 10, then 3. */
export const wolvesFor = (n) => (n <= 6 ? 1 : n <= 10 ? 2 : 3);

/** The roles in play, before shuffling. */
export function roleList(n, { wolves = wolvesFor(n), seer = true, doctor = n >= 6 } = {}) {
  if (n < 5) throw new Error("Varulv kræver mindst fem spillere ud over fortælleren");
  const roles = Array(Math.min(wolves, n - 2)).fill("varulv");
  if (seer) roles.push("seer");
  if (doctor) roles.push("laege");
  while (roles.length < n) roles.push("borger");
  return roles;
}

/** Each player's role for game number `gameNo` (1, 2, ...). Index in the result = index in the roster. */
export function deal(seed, gameNo, n, options = {}) {
  return seededShuffle(roleList(n, options), hashString(`${seed}:varulv:${gameNo}`));
}

/** "ulve", "landsby" or null while the game goes on. alive: booleans per player. */
export function winnerOf(roles, alive) {
  const wolves = roles.filter((r, i) => alive[i] && r === "varulv").length;
  const others = roles.filter((r, i) => alive[i] && r !== "varulv").length;
  if (wolves === 0) return "landsby";
  if (wolves >= others) return "ulve";
  return null;
}

/** The narrator's script for one night, with only the roles that are in play. */
export function nightSteps(roles) {
  const steps = [
    "Alle lukker øjnene. Hold dem lukkede, til jeg siger til.",
    "Varulve, åbn øjnene og se hinanden. Peg sammen og lydløst på jeres offer. Varulve, luk øjnene.",
  ];
  if (roles.includes("seer")) steps.push("Seer, åbn øjnene. Peg på én, du vil vide noget om. (Vis tommelfinger op, hvis det er en varulv, ellers ned.) Seer, luk øjnene.");
  if (roles.includes("laege")) steps.push("Læge, åbn øjnene. Peg på én, du vil redde i nat. Læge, luk øjnene.");
  steps.push("Alle åbner øjnene. Fortæl, hvem varulvene tog, medmindre lægen reddede dem. Den, der er taget, er ude og må ikke sige mere.");
  steps.push("Det er dag. Diskutér, hvem der er varulv, og stem på tre. Den med flest stemmer er ude og viser sit kort. Markér de døde nedenfor.");
  return steps;
}
