/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The time bar (owner, 20 Oct 2026: "แยกปุ่ม control เวลาออกมาเลย"): a glass card at the bottom left of the city with
// the date and the game's speeds, pause and 1x 2x 3x, in place of the pause on the menu rail and the speeds in the
// settings window. Each speed is the game's `speed` command (src/cityCommands.ts), so a saved or replayed city keeps it.
// P still pauses and resumes (the rail's hidden button, src/menuRail.ts).

import { onLanguageChange, t } from "./i18n/index";
import { clockText, sunHours } from "./dayClock";

/** The simulation's speeds (src/simulation.js Simulation.SPEED_*): paused, slow, medium, fast */
export const TIME_SPEEDS = [0, 1, 2, 3] as const;
export type TimeSpeed = typeof TIME_SPEEDS[number];
const LABELS: Readonly<Record<TimeSpeed, string>> = { 0: "", 1: "1×", 2: "2×", 3: "3×" };

/** What the bar needs of the game (src/game.js) */
export interface TimeGame {
  isPaused: boolean;
  defaultSpeed: number;
  applyCommand(command: { type: "speed"; speed: number }): unknown;
  /** The time of day (src/dayClock.ts), and the calendar's month for its sunrise and sunset */
  dayClock?: { text(): string; night(month: number): boolean };
  simulation?: { getDate(): { month: number } };
}

/** The speed the game runs at now: 0 while paused */
export function currentSpeed(game: TimeGame): TimeSpeed {
  if (game.isPaused) return 0;
  return (TIME_SPEEDS as readonly number[]).includes(game.defaultSpeed) ? game.defaultSpeed as TimeSpeed : 2;
}

/** Runs the game at a speed, or pauses it (0), keeping the rail's pause button in step for the P key */
export function setSpeed(game: TimeGame, speed: TimeSpeed, doc: Document = document): void {
  if (speed === 0) {
    game.isPaused = true;
  } else {
    game.isPaused = false;
    game.defaultSpeed = speed;
  }
  game.applyCommand({ type: "speed", speed });
  // The rail's button records with its class whether the game is paused (src/inputStatus.js speedChangeHandler)
  doc.getElementById("pauseRequest")?.classList.toggle("paused", game.isPaused);
}

/** Puts the time bar into the page once, and keeps its date and its pressed button up to date. */
export function installTimeControls(game: TimeGame, doc: Document = document): HTMLElement | null {
  if (doc.getElementById("timeBar")) return null;
  const host = doc.getElementById("canvasContainer")?.parentElement ?? doc.body;
  const bar = doc.createElement("div");
  bar.id = "timeBar";
  bar.setAttribute("role", "toolbar");
  // The clock: a sun by day, a moon by night, and the hour (src/dayClock.ts)
  const clock = doc.createElement("span");
  clock.className = "timeClock";
  clock.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle class="timeSun" cx="12" cy="12" r="4.5"/>'
    + '<path class="timeSun" d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/>'
    + '<path class="timeMoon" d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"/></svg><span class="timeHour"></span>';
  const hour = clock.querySelector(".timeHour") as HTMLElement;
  if (game.dayClock) bar.append(clock);
  const date = doc.createElement("span");
  date.className = "timeDate";
  bar.append(date);
  const buttons = new Map<TimeSpeed, HTMLButtonElement>();
  for (const speed of TIME_SPEEDS) {
    const button = doc.createElement("button");
    button.type = "button";
    button.className = "timeButton";
    button.dataset.speed = String(speed);
    if (speed === 0) {
      button.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="timePause" d="M9 6v12M15 6v12"/></svg>';
    } else {
      button.textContent = LABELS[speed];
    }
    button.addEventListener("click", () => {
      // The pause button pauses, and pressed again goes on at the speed before
      setSpeed(game, speed === 0 && game.isPaused ? currentSpeed({ ...game, isPaused: false }) : speed, doc);
      refresh();
    });
    bar.append(button);
    buttons.set(speed, button);
  }
  host.append(bar);

  let shown = -1;
  const label = (): void => {
    bar.setAttribute("aria-label", t("time.bar"));
    for (const [speed, button] of buttons) {
      const name = t(`time.speed.${speed}`);
      button.title = name;
      button.setAttribute("aria-label", name);
    }
  };
  const refresh = (): void => {
    const speed = currentSpeed(game);
    if (speed !== shown) {
      shown = speed;
      for (const [s, button] of buttons) {
        button.classList.toggle("selected", s === speed);
        button.setAttribute("aria-pressed", String(s === speed));
      }
      bar.classList.toggle("paused", speed === 0);
    }
    const source = doc.getElementById("date");
    const text = source?.textContent ?? "";
    if (date.textContent !== text) date.textContent = text;
    if (game.dayClock) {
      const month = game.simulation?.getDate().month ?? 0, now = game.dayClock.text();
      if (hour.textContent !== now) hour.textContent = now;
      clock.classList.toggle("night", game.dayClock.night(month));
      if (month !== shownMonth) {
        shownMonth = month;
        const sun = sunHours(month);
        clock.title = t("time.sun", { rise: clockText(sun.rise), set: clockText(sun.set) });
      }
    }
  };
  let shownMonth = -1;
  label();
  refresh();
  onLanguageChange(() => { label(); shownMonth = -1; refresh(); });
  // P on the rail, the settings window and loading a city change the speed too, and the clock moves: look a few times
  // a second
  setInterval(refresh, 250);
  return bar;
}
