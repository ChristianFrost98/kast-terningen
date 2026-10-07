// Setting up a game (#/spil/ny/<id>) and playing it (#/spil).
import { h, mount, confirmSheet, toast } from "../ui.js";
import { appBar } from "../components.js";
import { GAMES } from "../games/index.js";
import { currentGame, clearGame, saveGame } from "../games/state.js";
import { newSeed } from "../games/rng.js";
import { enterGameMode, leaveGameMode } from "../games/ui.js";
import { forgetPlayer, newId, recentPlayers, rememberPlayers } from "../prefs.js";

export async function gameSetupView(root, app, gameId) {
  leaveGameMode();
  const meta = GAMES[gameId];
  if (!meta) { app.go("#/"); return; }
  const [data, module] = await Promise.all([meta.data().catch(() => null), meta.module()]);
  const state = {
    players: [],
    settings: typeof module.defaults === "function" ? module.defaults() : structuredClone(module.defaults || {}),
  };
  // Pre-pick the people from your last game.
  const last = recentPlayers();
  for (const n of last.slice(0, 8)) if (!state.players.includes(n)) state.players.push(n);

  function draw() {
    const n = state.players.length;
    const ready = module.canStart ? module.canStart(state.settings) : { ok: true };
    const enough = (!meta.usesPlayers || n >= meta.minPlayers) && ready.ok;
    const chip = (label, on, onclick) => h("button", { class: "chip", type: "button", "aria-pressed": String(on), onclick }, label);
    const names = [...new Set([...state.players, ...recentPlayers()])];

    const players = meta.usesPlayers ? h("section", { class: "field" },
      h("h3", { style: "margin:0" }, `Hvem spiller? (${n})`),
      h("div", { class: "chips" }, ...names.map((name) => chip(name, state.players.includes(name), () => {
        state.players = state.players.includes(name) ? state.players.filter((p) => p !== name) : [...state.players, name];
        draw();
      }))),
      h("form", { class: "inline-form", onsubmit: (e) => {
        e.preventDefault();
        const added = e.target.elements.name.value.split(",").map((s) => s.trim()).filter(Boolean);
        for (const v of added) if (!state.players.includes(v)) state.players.push(v);
        draw();
        root.querySelector('input[name="name"]')?.focus();
      } },
        h("input", { type: "text", name: "name", placeholder: "Tilføj en spiller", "aria-label": "Tilføj en spiller", autocomplete: "off" }),
        h("button", { class: "btn small ghost", type: "submit" }, "Tilføj")),
      !meta.usesPlayers || n >= meta.minPlayers ? null : h("p", { class: "meta" }, `${meta.name} kræver mindst ${meta.minPlayers} spillere.`),
      recentPlayers().length ? h("button", { class: "linkbtn small", type: "button", onclick: () => {
        for (const p of recentPlayers()) if (!state.players.includes(p)) forgetPlayer(p);
        draw();
      } }, "Ryd navne, der ikke er valgt") : null) : null;

    mount(root,
      appBar({ back: { href: "#/", label: "Spil" } }),
      h("header", {}, h("h1", { class: "page-title" }, meta.name), h("p", { class: "lead" }, meta.tagline)),
      meta.file && !data ? h("p", { class: "capture" }, "Spillets ord kunne ikke hentes. Prøv igen med netværk.") : null,
      players,
      ...(module.settingsView?.({ settings: state.settings, players: state.players, data, redraw: draw }) || []),
      h("div", { class: "actionbar" }, h("div", { class: "inner" },
        ready.ok ? null : h("span", { class: "meta", style: "flex:1" }, ready.reason),
        h("button", { class: "btn", disabled: !enough || (meta.file && !data), onclick: start }, "Start spillet"))));
    document.body.classList.add("has-actionbar");
  }

  async function start(e) {
    const button = e?.currentTarget;
    if (button) { button.disabled = true; button.textContent = "Starter ..."; }
    if (meta.usesPlayers) rememberPlayers(state.players);
    const seed = newSeed();
    const base = { id: newId(), game: gameId, seed, players: [...state.players], settings: state.settings,
      startedAt: new Date().toISOString() };
    try {
      // newGame may load things first (the music quiz fetches the playlist).
      saveGame({ ...base, ...(await module.newGame({ players: base.players, settings: state.settings, data, seed })) });
      app.go("#/spil");
    } catch (error) {
      toast(error.message || "Spillet kunne ikke starte.");
      draw();
    }
  }

  draw();
}

export async function gamePlayView(root, app) {
  const game = currentGame();
  const meta = game && GAMES[game.game];
  if (!meta) { leaveGameMode(); app.go("#/"); return; }
  let data, module;
  try {
    [data, module] = await Promise.all([meta.data(), meta.module()]);
  } catch {
    mount(root, appBar({ back: { href: "#/", label: "Spil" } }), h("h1", { class: "page-title" }, "Hov"),
      h("p", {}, "Spillet kunne ikke hentes. Prøv igen med netværk."));
    return;
  }
  enterGameMode();
  const ctx = {
    app, data, meta, game,
    save(next) { Object.assign(game, next); saveGame(game); },
    redraw() { module.render(root, ctx); },
    async finish({ ask = true } = {}) {
      if (ask && !(await confirmSheet("Afslut spillet?", null, "Afslut", "Spil videre"))) return;
      module.cleanup?.();
      clearGame();
      leaveGameMode();
      app.go("#/");
    },
  };
  module.render(root, ctx);
}
