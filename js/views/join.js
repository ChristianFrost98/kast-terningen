// Opening a game link or scanning a host's QR code.
import { h, mount, toast } from "../ui.js";
import { appBar } from "../components.js";
import { decodeShare } from "../share.js";
import { GAMES } from "../games/index.js";
import { currentGame, saveGame } from "../games/state.js";

export async function joinView(root, app, code) {
  let data;
  try {
    data = await decodeShare(code);
  } catch {
    mount(root, appBar({ back: { href: "#/", label: "Spil" } }),
      h("h1", { class: "page-title" }, "Linket virker ikke"),
      h("p", { class: "muted" }, "Det er måske blevet klippet over undervejs. Prøv at scanne koden igen."));
    return;
  }
  const g = data.game;
  const meta = GAMES[g.game];
  if (!meta) { toast("Det spil kender din app ikke endnu. Opdater appen."); app.go("#/"); return; }
  const module = await meta.module();
  const known = currentGame();
  // Scanning the same game again keeps your name and round; a new game starts fresh.
  if (!known || known.id !== g.id) saveGame({ ...g, host: false, ...(module.join?.(g) || {}) });
  app.go("#/spil");
}
