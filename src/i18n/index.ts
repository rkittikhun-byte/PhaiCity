/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Bilingual UI: Thai (default) and English. Strings live in strings.ts, generated from
// docs/i18n/UI_STRINGS.md (npm run i18n:import). Static HTML opts in with:
//   data-i18n="key"                      replaces the element's text
//   data-i18n-value / -title / -placeholder="key"   sets that attribute
//   data-i18n-template="key"             mixed content: the string's {name} placeholders are filled by the
//                                        descendants marked data-i18n-slot="name", and <br> becomes a line break.
//                                        Slots are moved, not copied, so code that updates them by id keeps working.

import { STRINGS } from "./strings";

export type Language = "th" | "en";
export type Params = Record<string, string | number>;

export const LANGUAGES: Language[] = ["th", "en"];
const DEFAULT_LANGUAGE: Language = "th";
const STORAGE_KEY = "phaicity.language";
const BUDDHIST_ERA_OFFSET = 543;
const TEMPLATE_TOKEN = /(\{\w+\}|<br\s*\/?>)/;

const ATTRIBUTE_BINDINGS: Array<[string, string]> = [
  ["data-i18n-value", "value"],
  ["data-i18n-title", "title"],
  ["data-i18n-placeholder", "placeholder"],
];

const listeners = new Set<(language: Language) => void>();

function loadLanguage(): Language {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "en" || stored === "th" ? stored : DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

let current: Language = typeof window === "undefined" ? DEFAULT_LANGUAGE : loadLanguage();

export function getLanguage(): Language {
  return current;
}

// Unknown keys fall back to the key itself, so a missing translation is visible but never crashes.
// Placeholders such as {pct} are filled from params; placeholders without a value are left as they are.
export function t(key: string, params?: Params): string {
  const entry = STRINGS[key];
  const text = entry ? entry[current] || entry.en || key : key;
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (token, name: string) => (name in params ? String(params[name]) : token));
}

export function hasKey(key: string): boolean {
  return key in STRINGS;
}

// Thai shows Buddhist-era years (พ.ศ. = ค.ศ. + 543); English keeps the Gregorian year.
export function formatYear(year: number): string {
  return String(current === "th" ? year + BUDDHIST_ERA_OFFSET : year);
}

// The city's money is shown in baht in both languages: ฿1500, -฿200.
export function formatMoney(amount: number): string {
  return `${amount < 0 ? "-" : ""}฿${Math.abs(amount)}`;
}

function applyTemplate(element: HTMLElement): void {
  const slots = new Map<string, Element>();
  element.querySelectorAll("[data-i18n-slot]").forEach((slot) => {
    slots.set(slot.getAttribute("data-i18n-slot") as string, slot);
  });

  const nodes: Node[] = [];
  for (const part of t(element.dataset.i18nTemplate as string).split(TEMPLATE_TOKEN)) {
    if (part === "") continue;
    const slot = part.startsWith("{") ? slots.get(part.slice(1, -1)) : undefined;
    if (slot) nodes.push(slot);
    else if (/^<br/.test(part)) nodes.push(document.createElement("br"));
    else nodes.push(document.createTextNode(part));
  }
  element.replaceChildren(...nodes);
}

export function applyTranslations(root: ParentNode = document): void {
  root.querySelectorAll<HTMLElement>("[data-i18n-template]").forEach(applyTemplate);
  root.querySelectorAll<HTMLElement>("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n as string);
  });
  for (const [attribute, target] of ATTRIBUTE_BINDINGS) {
    root.querySelectorAll<HTMLElement>(`[${attribute}]`).forEach((element) => {
      element.setAttribute(target, t(element.getAttribute(attribute) as string));
    });
  }
  if (typeof document !== "undefined") document.documentElement.lang = current;
}

export function setLanguage(language: Language): void {
  if (language === current) return;
  current = language;
  try {
    window.localStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Private windows may refuse storage; the choice then lasts for this page only.
  }
  if (typeof document !== "undefined") applyTranslations();
  listeners.forEach((listener) => listener(language));
}

export function onLanguageChange(listener: (language: Language) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
