// Entry point: routes between the hub, game setup, the game itself and game links,
// and registers the service worker.
import { h, mount } from "./ui.js";
import { hubView } from "./views/hub.js";
import { gamePlayView, gameSetupView } from "./views/game.js";
import { joinView } from "./views/join.js";
import { handleRedirect } from "./spotify.js";

const root = document.getElementById("app");

const app = {
  go(hash) {
    if (location.hash === hash) render();
    else location.hash = hash;
  },
  refresh() { render(); },
};

async function show(route, param, extra) {
  if (route === "spil" && param === "ny" && extra) await gameSetupView(root, app, extra);
  else if (route === "spil") await gamePlayView(root, app);
  else if (route === "delt" && param) await joinView(root, app, param);
  else hubView(root, app);
}

let rendering = Promise.resolve();
function render() {
  rendering = rendering.then(async () => {
    document.body.classList.remove("has-actionbar", "game-mode");
    const [, route = "", param, extra] = (location.hash || "#/").split("/");
    const run = async () => {
      try {
        await show(route, param, extra);
      } catch (error) {
        console.error(error);
        mount(root,
          h("h1", { class: "page-title", style: "margin-top:24px" }, "Hov"),
          h("p", { class: "muted" }, "Noget gik galt her."),
          h("a", { class: "btn", href: "#/" }, "Til forsiden"));
      }
      window.scrollTo(0, 0);
    };
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (document.startViewTransition && !reduced && document.visibilityState === "visible") {
      // A transition can be skipped (fast navigation, hidden tab); that's fine, the screen is still drawn.
      const transition = document.startViewTransition(run);
      transition.ready.catch(() => {});
      transition.finished.catch(() => {});
      await transition.updateCallbackDone.catch(() => {});
    } else {
      await run();
    }
    const heading = root.querySelector("h1")?.textContent;
    document.title = route && heading ? `${heading} · Kast terningen` : "Kast terningen";
  });
  return rendering;
}

window.addEventListener("hashchange", render);
// Coming back from Spotify's login: finish it before showing anything.
const spotify = await handleRedirect().catch(() => ({ error: "network" }));
if (spotify?.error) sessionStorage.setItem("kt-spotify-error", spotify.error);
render();

if ("serviceWorker" in navigator && location.protocol !== "file:") {
  navigator.serviceWorker.register("sw.js").catch(() => {});
}
