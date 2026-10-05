// Fingervælgeren: everyone puts a finger on the screen; pick one finger, or split them into teams.

/** ids: the touching fingers. mode "en" picks one; "hold" gives each finger team 0 or 1. */
export function choose(ids, mode, rnd = Math.random) {
  if (ids.length < 2) return null;
  const shuffled = [...ids];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  if (mode === "hold") return Object.fromEntries(shuffled.map((id, i) => [id, i % 2]));
  return { [shuffled[0]]: 0 };
}
