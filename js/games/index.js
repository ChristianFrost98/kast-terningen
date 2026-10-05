// All games in the app. Each game is a module in this folder exporting:
//   defaults                  its settings with default values (an object, or a function returning one)
//   settingsView(ctx)         extra settings on the setup screen (optional)
//   newGame({ players, settings, data, seed })  the starting state
//   render(root, ctx)         the game screen
// and gets a line here. `data` is a JSON file in data/games/.

const cache = new Map();
function load(file) {
  if (!file) return Promise.resolve(null);
  if (!cache.has(file)) cache.set(file, fetch(`data/games/${file}`).then((r) => { if (!r.ok) throw new Error(file); return r.json(); }));
  return cache.get(file);
}

const game = (id, meta) => ({ id, data: () => load(meta.file), module: () => import(`./${id}.js`), usesPlayers: true, ...meta });

/** Sections on the start screen, in order. */
export const GROUPS = [
  { id: "roller", name: "Hemmelige roller", hint: "Bluf, mistænk og afslør. Kan spilles på hver sin telefon." },
  { id: "hold", name: "Hold mod hold", hint: "Point, timer og lidt konkurrence." },
  { id: "hurtig", name: "Hurtigt og fjollet", hint: "Kom i gang på ti sekunder." },
  { id: "snak", name: "Snak og papir", hint: "Til en roligere stund." },
];

export const GAMES = Object.fromEntries([
  game("imposter", { group: "roller", name: "Imposter", tagline: "Alle får det samme ord. Undtagen én.", minPlayers: 3, players: "3-12", phones: "Én eller flere telefoner", file: "imposter.json" }),
  game("varulv", { group: "roller", name: "Varulv", tagline: "Hemmelige roller, en fortæller og en landsby i panik.", minPlayers: 6, players: "6-16", phones: "Flere telefoner eller én", file: null }),
  game("musikquiz", { group: "hold", name: "Musikquiz", tagline: "Værtens Spotify spiller. Alle gætter sangen.", minPlayers: 2, players: "2-12", phones: "Én telefon og Spotify Premium", file: null }),
  game("spionen", { group: "roller", name: "Spionen", tagline: "Alle kender stedet. Undtagen spionen.", minPlayers: 3, players: "3-12", phones: "Én eller flere telefoner", file: "spionen.json" }),
  game("quiz", { group: "hold", name: "Quiz", tagline: "Svære temaquizzer og en blandet. Med eller uden svarmuligheder.", minPlayers: 2, players: "2-12", phones: "Én telefon", file: "quiz.json" }),
  game("tabu", { group: "hold", name: "Tabu", tagline: "Forklar ordet uden de forbudte ord.", minPlayers: 4, players: "4-12", phones: "Én telefon", file: "tabu.json" }),
  game("paa-panden", { group: "hurtig", name: "På panden", tagline: "Telefonen på panden. De andre forklarer.", minPlayers: 2, players: "2-12", phones: "Én telefon", file: "paa-panden.json" }),
  game("tegn-og-gaet", { group: "hold", name: "Tegn og gæt", tagline: "Tegn ordet. Dit hold gætter.", minPlayers: 4, players: "4-12", phones: "Én telefon og papir", file: "tegn-og-gaet.json" }),
  game("bomben", { group: "hurtig", name: "Bomben", tagline: "Sig noget, send den videre, før den springer.", minPlayers: 3, players: "3-12", phones: "Én telefon", file: "bomben.json" }),
  game("hvem-af-os", { group: "hurtig", name: "Hvem af os", tagline: "På tre peger alle på den, der passer bedst.", minPlayers: 3, players: "3+", phones: "Én telefon", file: "hvem-af-os.json", usesPlayers: false }),
  game("kategorier", { group: "snak", name: "Kategorier", tagline: "Ét bogstav, seks kategorier, et ur.", minPlayers: 2, players: "2+", phones: "Én telefon og papir", file: "kategorier.json", usesPlayers: false }),
  game("jeg-har-aldrig", { group: "hurtig", name: "Jeg har aldrig", tagline: "Fem fingre op. Har du gjort det, ryger en.", minPlayers: 3, players: "3+", phones: "Én telefon", file: "jeg-har-aldrig.json", usesPlayers: false }),
  game("snakkekort", { group: "snak", name: "Snakkekort", tagline: "Gode spørgsmål til en god snak.", minPlayers: 2, players: "2+", phones: "Én telefon", file: "snakkekort.json" }),
  game("helst", { group: "hurtig", name: "Hvad vil du helst", tagline: "To valg. Alle svarer på én gang.", minPlayers: 2, players: "2+", phones: "Én telefon", file: "helst.json", usesPlayers: false }),
  game("fingervaelger", { group: "hurtig", name: "Fingervælgeren", tagline: "Alle lægger en finger. Appen vælger.", minPlayers: 2, players: "2-10", phones: "Én telefon", file: null, usesPlayers: false }),
].map((g) => [g.id, g]));
