/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// Opens each card of the game (the dock's groups, the tool levels, the ruler's house, the menu windows) at three
// viewport sizes and checks that every button can be clicked: its centre is on screen and elementFromPoint there gives
// the button itself, not another panel; and that each window stays inside the screen and clear of the tools dock and
// the time bar (owner, 24 Oct 2026: "card ก็อยู่ต่ำเกิน คลิกไม่ได้ก็มี"). Needs a dev server and Playwright, so it is not
// part of Jest:
//   npm run dev -- --port 8147      (in one terminal)
//   node scripts/checkCardsReach.mjs [http://localhost:8147]
// Muted, headless, and it changes nothing in the project. Exit code 1 when a card fails.

import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const base = process.argv[2] ?? "http://localhost:8080";
const SIZES = [[1440, 765], [1280, 720], [1024, 700]];

/** Runs in the page: what is wrong with the cards now. */
function inspect() {
  const problems = [];
  const vw = window.innerWidth, vh = window.innerHeight;
  const rect = (selector) => {
    const el = document.querySelector(selector);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0 ? r : null;
  };
  const shown = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return false;
    for (let up = el; up; up = up.parentElement) {
      const style = getComputedStyle(up);
      if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0 || up.hidden) return false;
    }
    return true;
  };
  const name = (el) => el.id ? `#${el.id}` : `${el.tagName.toLowerCase()}${el.dataset.tool ? `[${el.dataset.tool}]` : ""}:${(el.textContent || el.value || "").trim().slice(0, 24)}`;
  const cards = [...document.querySelectorAll(".modal, #toolTray, #toolLevels, #notifications, #newsLog, .newsList")].filter(shown);
  const dock = rect("#controls"), timeBar = rect("#timeBar");
  const dockEl = document.querySelector("#controls"), timeEl = document.querySelector("#timeBar");
  for (const card of cards) {
    const r = card.getBoundingClientRect();
    if (r.left < 0 || r.top < 0 || r.right > vw + 0.5 || r.bottom > vh + 0.5) problems.push(`${name(card)} crosses the screen edge (${Math.round(r.left)},${Math.round(r.top)},${Math.round(r.right)},${Math.round(r.bottom)})`);
    for (const [label, other, el] of [["the dock", dock, dockEl], ["the time bar", timeBar, timeEl]]) {
      if (!other || card === el || card.contains(el) || el.contains(card)) continue;
      if (r.left < other.right - 1 && r.right > other.left + 1 && r.top < other.bottom - 1 && r.bottom > other.top + 1) {
        problems.push(`${name(card)} overlaps ${label}`);
      }
    }
  }
  const clickable = [...document.querySelectorAll("button, input[type=submit], input[type=button], input[type=checkbox], select, a[href], [role=button], .toolButton")];
  for (const el of clickable) {
    if (!shown(el) || el.disabled || el.closest("[inert]")) continue;
    // Only the cards' own buttons, and the dock's
    if (!el.closest(".modal, #toolTray, #toolLevels, #notifications, #controls, #miscButtons, #timeBar")) continue;
    el.scrollIntoView({ block: "nearest", inline: "nearest" });
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    if (x < 0 || y < 0 || x > vw || y > vh) { problems.push(`${name(el)} is off screen`); continue; }
    const hit = document.elementFromPoint(x, y);
    if (!hit || !(el === hit || el.contains(hit) || hit.contains(el) && hit.tagName === "LABEL")) {
      problems.push(`${name(el)} at ${Math.round(x)},${Math.round(y)} is under ${name(hit ?? document.body)}`);
    }
  }
  return problems;
}

async function newCity(browser, [w, h]) {
  const page = await browser.newPage({ viewport: { width: w, height: h } });
  page.on("pageerror", (e) => console.log("page error:", e.message));
  await page.addInitScript(() => { try { localStorage.setItem("phaicity.muted", "1"); } catch (e) { /* none */ } });
  await page.goto(`${base}/index.html?khonkaen&view=2d`);
  await page.waitForSelector("#controls", { state: "visible", timeout: 60000 });
  await page.waitForTimeout(6000);
  return page;
}

async function dockGroup(page, index) {
  const [w, h] = [page.viewportSize().width, page.viewportSize().height];
  await page.mouse.move(w / 2, h - 20);
  await page.waitForTimeout(400);
  const groups = await page.$$("#toolCategories button");
  if (!groups[index]) return false;
  await groups[index].click();
  await page.waitForTimeout(700);
  return true;
}

async function main() {
  const browser = await chromium.launch({ args: ["--mute-audio"] });
  let failed = 0;
  for (const size of SIZES) {
    const page = await newCity(browser, size);
    const report = async (label) => {
      const problems = await page.evaluate(inspect);
      console.log(`${size.join("x")} ${label}: ${problems.length ? "FAIL" : "ok"}`);
      for (const problem of problems) console.log(`   ${problem}`);
      failed += problems.length;
    };
    await report("start");
    // The dock's seven groups, each with its card of tools
    for (let i = 0; i < 7; i++) {
      if (await dockGroup(page, i)) await report(`dock group ${i}`);
    }
    // The ruler's house: build it beside a road, then its card, levels and window
    await page.evaluate(() => window.scrollTo(0, 0));
    await dockGroup(page, 0);
    await page.click("#toolTray [data-tool=ruler_house]");
    await page.mouse.click(size[0] * 0.2, size[1] * 0.465);
    await page.waitForTimeout(1500);
    await report("house card");
    const wings = await page.$("#toolTray [data-tool=ruler_house_wings]");
    if (wings && await wings.isVisible()) {
      await wings.click({ timeout: 3000 });
      await page.waitForTimeout(800);
      await report("house window");
      await page.keyboard.press("Escape");
    }
    // The menu windows
    for (const id of ["settingsRequest", "registerRequest", "budgetRequest", "evalRequest", "mapRequest", "disasterRequest", "cityRequest"]) {
      const button = await page.$(`#${id}`);
      if (!button || !(await button.isVisible())) continue;
      await button.click({ force: true });
      await page.waitForTimeout(700);
      await report(id);
      await page.keyboard.press("Escape");
      await page.mouse.click(size[0] / 2, size[1] / 3);
      await page.waitForTimeout(400);
    }
    await page.click("#newsLogButton", { force: true }).catch(() => {});
    await page.waitForTimeout(600);
    await report("news list");
    await page.close();
  }
  await browser.close();
  console.log(failed ? `${failed} problem(s)` : "all cards reachable");
  process.exit(failed ? 1 : 0);
}

main();
