/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The About page (about.html): how to play and every credit, in Thai or English like the game.
// Each credits group opens its full list on request, read from the project's own credits files.

import { parseMarkdown, renderMarkdown } from "./creditsMarkdown";
import { applyTranslations, getLanguage, onLanguageChange, setLanguage, t } from "./i18n/index";

function showTitle(): void {
  document.title = t("about.meta.title");
}

// "Fire: what it does" → the name before the first colon in bold
function boldTerms(): void {
  document.querySelectorAll<HTMLElement>(".aboutTerms li").forEach((item) => {
    const text = item.textContent ?? "";
    const colon = text.indexOf(": ");
    if (colon < 1) return;
    const term = document.createElement("strong");
    term.textContent = text.slice(0, colon + 1);
    item.replaceChildren(term, document.createTextNode(text.slice(colon + 1)));
  });
}

function refresh(): void {
  showTitle();
  boldTerms();
}

async function loadCredits(details: HTMLDetailsElement): Promise<void> {
  const body = details.querySelector<HTMLElement>(".creditsBody");
  if (!body || details.dataset.state === "loading" || details.dataset.state === "loaded") return;
  details.dataset.state = "loading";
  body.textContent = t("about.credits.loading");
  try {
    const response = await fetch(details.dataset.credits as string);
    if (!response.ok) throw new Error(`${response.status}`);
    body.replaceChildren(renderMarkdown(parseMarkdown(await response.text()), document));
    details.dataset.state = "loaded";
  } catch {
    body.textContent = t("about.credits.load_failed");
    delete details.dataset.state; // Opening it again tries again
  }
}

applyTranslations();
refresh();
onLanguageChange(refresh);

document.getElementById("languageToggle")?.addEventListener("click", () => {
  setLanguage(getLanguage() === "th" ? "en" : "th");
});

document.querySelectorAll<HTMLDetailsElement>("details[data-credits]").forEach((details) => {
  details.addEventListener("toggle", () => {
    if (details.open) void loadCredits(details);
  });
});
