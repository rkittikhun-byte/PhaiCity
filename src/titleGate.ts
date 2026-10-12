/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The title page before the opening story (owner, 12 Oct 2026): the name, a flag for each language, "sound on", and
// one big "Enter the game" button. Browsers keep a page silent until the player clicks or presses a key, so that
// click (or Enter) is what lets the music start at once. Signing in with LINE or Google will join this page when the
// server is up (docs/server/SERVER_SPEC.md); the sign-in round trip reloads the page, so this button stays the click
// that starts the sound.

import { audio } from "./audio/index";
import { getLanguage, type Language, onLanguageChange, setLanguage, t } from "./i18n/index";
import { FLAGS } from "./languageFlag";
import { show } from "./motion";

const LANGUAGES: Language[] = ["th", "en"];
/** How long the title page takes to go (css/style.css, "#titleGate.leaving"), and its words to sink away. */
const LEAVE_MS = 1400;
const SINK_MS = 800;

/** Shows the title page and resolves when the player enters the game. */
export function showTitleGate(doc: Document = document): Promise<void> {
  return new Promise((resolve) => {
    const gate = doc.createElement("div");
    gate.id = "titleGate";
    gate.setAttribute("role", "dialog");
    gate.setAttribute("aria-modal", "true");

    const brand = doc.createElement("h1");
    brand.className = "gateBrand";
    brand.textContent = "PhaiCity";
    const tagline = doc.createElement("p");
    tagline.className = "gateTagline";

    const languages = doc.createElement("div");
    languages.className = "gateLanguages";
    languages.setAttribute("role", "group");
    const choices = LANGUAGES.map((language) => {
      const choice = doc.createElement("button");
      choice.type = "button";
      choice.className = "gateLanguage";
      choice.dataset.lang = language;
      choice.addEventListener("click", () => setLanguage(language));
      languages.appendChild(choice);
      return choice;
    });

    const soundLabel = doc.createElement("label");
    soundLabel.className = "gateSound";
    const soundBox = doc.createElement("input");
    soundBox.type = "checkbox";
    soundBox.checked = !audio.settings.muted;
    const soundText = doc.createElement("span");
    soundLabel.append(soundBox, soundText);

    const enter = doc.createElement("button");
    enter.type = "button";
    enter.className = "gateEnter";
    const hint = doc.createElement("p");
    hint.className = "gateHint";

    const panel = doc.createElement("div");
    panel.className = "gatePanel";
    panel.append(brand, tagline, languages, soundLabel, enter, hint);
    gate.appendChild(panel);
    doc.body.appendChild(gate);

    const render = (): void => {
      tagline.textContent = t("gate.tagline");
      languages.setAttribute("aria-label", t("gate.language"));
      for (const choice of choices) {
        const language = choice.dataset.lang as Language;
        choice.innerHTML = `${FLAGS[language]}<span>${t(`lang.${language}`)}</span>`;
        choice.classList.toggle("current", language === getLanguage());
        choice.setAttribute("aria-pressed", String(language === getLanguage()));
      }
      soundText.textContent = t("gate.sound");
      enter.textContent = t("gate.enter");
      hint.textContent = t("gate.hint");
    };
    render();
    const stopLanguage = onLanguageChange(render);

    let done = false;
    const go = (): void => {
      if (done) return;
      done = true;
      // This click or key is the one browsers wait for: the sound starts now, or stays off if unticked
      audio.unlock();
      audio.setMuted(!soundBox.checked);
      if (soundBox.checked) audio.play("ui.click");
      doc.removeEventListener("keydown", onKey, true);
      stopLanguage();
      doc.body.classList.remove("gateOpen");
      // Its words and buttons sink and fade, then the dark behind them clears (owner, 12 Oct 2026); the story starts
      // underneath meanwhile
      gate.classList.add("leaving");
      window.setTimeout(() => gate.remove(), LEAVE_MS);
      // The start screen comes out once the words have sunk away
      window.setTimeout(resolve, SINK_MS);
    };
    const onKey = (event: KeyboardEvent): void => {
      if (event.key !== "Enter" || event.target === soundBox) return;
      event.preventDefault();
      event.stopPropagation();
      go();
    };
    enter.addEventListener("click", go);
    doc.addEventListener("keydown", onKey, true);
    doc.body.classList.add("gateOpen");
    show(gate);
    enter.focus();
  });
}
