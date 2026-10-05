// The QR code a host shows so the others can join a game, plus the same link via the share sheet.
import { h, toast } from "./ui.js";
import { qrSvg } from "./qr.js";
import { gamePayload, sendLink, shareLink } from "./share.js";
import { myName } from "./prefs.js";

export const linkBase = () => `${location.origin}${location.pathname}`;

/** The QR code for a game, with a "send as link" button for those who can't scan. */
export async function joinCode(game, gameName) {
  const url = await shareLink(gamePayload(game, myName() || "En ven"), linkBase());
  let code;
  try { code = qrSvg(url, { level: url.length > 600 ? "L" : "M" }); } catch { code = null; }
  const send = async () => {
    const result = await sendLink({ title: gameName, text: `Vær med i ${gameName}`, url });
    if (result === "copied") toast("Linket er kopieret.");
    if (result === "failed") toast("Linket kunne ikke deles.");
  };
  return h("div", { class: "stack" },
    code ? h("div", { class: "qr-box", "aria-label": "QR-kode" }, code) : h("p", {}, "Koden blev for stor. Send et link i stedet."),
    h("button", { class: "linkbtn", onclick: send }, "Send som link i stedet"));
}
