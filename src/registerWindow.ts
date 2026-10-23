/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The city's register window (ทะเบียนเมือง, docs/GAME_DESIGN.md 20.3): how many homes, shops, factories, farms and
// services the city has, its households and people by age and by what they do, its jobs and who works them, the
// vehicles its households own, and a search by name; a name found opens that person's card and takes the camera to
// their home. It only reads the register (src/register/cityRegister.ts). Opened from the menu rail.

import { getLanguage, onLanguageChange, t } from "./i18n/index";
import { REGISTER_WINDOW_CLOSED } from "./messages";
import { ModalWindow } from "./modalWindow.js";
import { CityRegister } from "./register/cityRegister";
import { roleKey, vehicleKey } from "./register/registerCards";
import { AGE_BANDS, ROLES } from "./register/registerRules";

export interface RegisterWindowSource {
  register(): CityRegister;
  /** A person picked: the game opens their card and shows their home */
  openPerson(id: string): void;
}

const number = (n: number): string => n.toLocaleString("en-US");

interface RegisterWindowThis {
  source: RegisterWindowSource | null;
  _toggleDisplay(): void;
  _emitEvent(event: string, value?: unknown): void;
  render(): void;
  find(): void;
  close(): void;
}

/** A block of the window: a heading and rows of a name and a number */
function block(doc: Document, heading: string, rows: Array<[string, number]>, className = ""): HTMLElement {
  const box = doc.createElement("section");
  box.className = `registerBlock ${className}`.trim();
  const title = doc.createElement("div");
  title.className = "registerHeading";
  title.textContent = heading;
  const list = doc.createElement("dl");
  for (const [name, value] of rows) {
    const dt = doc.createElement("dt");
    dt.textContent = name;
    const dd = doc.createElement("dd");
    dd.textContent = number(value);
    list.append(dt, dd);
  }
  box.append(title, list);
  return box;
}

export const RegisterWindow = (ModalWindow as unknown as (constructor: (this: RegisterWindowThis) => void) =>
    { new(opacityLayerID: string, windowID: string): RegisterWindowThis; prototype: Record<string, unknown> })(
  function(this: RegisterWindowThis) {
    this.source = null;
    document.querySelector("#registerForm")?.addEventListener("submit", (e) => {
      e.preventDefault();
      this.close();
    });
    const search = document.querySelector<HTMLInputElement>("#registerSearch");
    let timer: number | undefined;
    search?.addEventListener("input", () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => this.find(), 200);
    });
    search?.addEventListener("keydown", (e) => {
      // (Enter searches at once rather than closing the window)
      if (e.key === "Enter") { e.preventDefault(); window.clearTimeout(timer); this.find(); }
    });
    document.querySelector("#registerResults")?.addEventListener("click", (e) => {
      const button = (e.target as HTMLElement).closest<HTMLElement>("[data-person]");
      if (!button?.dataset.person || !this.source) return;
      const id = button.dataset.person;
      this.close();
      this.source.openPerson(id);
    });
    onLanguageChange(() => this.render());
  });

RegisterWindow.prototype.render = function(this: RegisterWindowThis): void {
  const summary = document.querySelector("#registerSummary");
  if (!summary || !this.source) return;
  const register = this.source.register(), c = register.counts, doc = summary.ownerDocument;
  // What the workers do, the most first
  const jobs = new Map<string, number>();
  for (const p of register.people) if (p.job) jobs.set(p.job, (jobs.get(p.job) ?? 0) + 1);
  const topJobs = [...jobs.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  const vehicles = Object.entries(c.vehicles).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  summary.replaceChildren(
    block(doc, t("register.window.buildings"), [
      [t("register.count.homes"), c.homes], [t("register.count.shops"), c.shops], [t("register.count.factories"), c.factories],
      [t("register.count.farms"), c.farms], [t("register.count.fields"), c.fields], [t("register.count.services"), c.services],
    ]),
    block(doc, t("register.window.people"), [
      [t("register.count.households"), c.households], [t("register.count.people"), c.people],
      ...AGE_BANDS.map((band): [string, number] => [t(`register.band.${band}`), c.bands[band]]),
    ]),
    block(doc, t("register.window.doing"), ROLES.map((role): [string, number] => [t(`register.role.${role}`), c.roles[role]])),
    block(doc, t("register.window.jobs"), [
      [t("register.count.jobs"), c.jobs], [t("register.count.filled"), c.filled], [t("register.count.outside"), c.outside],
      ...topJobs.slice(0, 8).map(([job, n]): [string, number] => [t(`register.job.${job}`), n]),
    ]),
    block(doc, t("register.window.vehicles"), vehicles.length
      ? vehicles.map(([id, n]): [string, number] => [t(vehicleKey(id)), n]) : [[t("register.window.no_vehicles"), 0]]),
  );
  this.find();
};

/** The people whose name has what was typed in it */
RegisterWindow.prototype.find = function(this: RegisterWindowThis): void {
  const results = document.querySelector("#registerResults");
  const text = document.querySelector<HTMLInputElement>("#registerSearch")?.value ?? "";
  if (!results || !this.source) return;
  if (!text.trim()) { results.replaceChildren(); return; }
  const found = this.source.register().search(text, 30), language = getLanguage();
  if (!found.length) {
    const none = document.createElement("li");
    none.className = "registerNone";
    none.textContent = t("register.window.not_found");
    results.replaceChildren(none);
    return;
  }
  results.replaceChildren(...found.map((person) => {
    const item = document.createElement("li");
    const name = document.createElement("button");
    name.type = "button";
    name.dataset.person = person.id;
    name.textContent = CityRegister.nameOf(person, language);
    const about = document.createElement("span");
    about.textContent = t("register.row", { age: person.member.age, role: t(roleKey(person)) });
    item.append(name, about);
    return item;
  }));
};

RegisterWindow.prototype.open = function(this: RegisterWindowThis): void {
  this.render();
  this._toggleDisplay();
  document.querySelector<HTMLInputElement>("#registerSearch")?.focus();
};

RegisterWindow.prototype.close = function(this: RegisterWindowThis): void {
  this._toggleDisplay();
  this._emitEvent(REGISTER_WINDOW_CLOSED);
};
