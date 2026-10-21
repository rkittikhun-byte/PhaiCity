/* PhaiCity. A modified version of micropolisJS by Graeme McCutcheon, itself adapted from Micropolis.
 * Released under the GNU GPL v3 with additional terms. See LICENSE and COPYING.
 */

// The time bar (owner, 20 Oct 2026: "แยกปุ่ม control เวลาออกมาเลย"): a glass card at the bottom left of the city with
// the date and the game's speeds, pause and 1x 2x 3x, in place of the pause on the menu rail and the speeds in the
// settings window. Each speed is the game's `speed` command (src/cityCommands.ts), so a saved or replayed city keeps it.
// P still pauses and resumes (the rail's hidden button, src/menuRail.ts). The clock's icon is the sky: the sun or the moon
// when it is clear, else the weather, whose word follows the hour (src/weather.ts; owner, 20 Oct 2026): the sky now, as
// the month's showers fall by the clock (src/showers.ts; owner, 21 Oct 2026: "rain" only while it rains), with the
// month's own character when pointed at.

import { onLanguageChange, t } from "./i18n/index";
import { clockText, sunHours } from "./dayClock";
import { type Climate, thaiSeason, type Weather } from "./weather";

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
  simulation?: { getDate(): { month: number }; rules?: { weather?: Climate } | null };
  /** The map, with the month's weather (src/weather.ts) */
  gameMap?: { weather?: Weather | null };
  /** The sky now (src/showers.ts), which the bar shows; without it, the month's */
  skyNow?: Weather | null;
}

/** The clock's icon: the sun or the moon in a clear sky, else the weather's */
export type SkyIcon = "sun" | "moon" | "cloud" | "rain" | "storm" | "fog" | "smoke";
/** Smoke from burning fields that turns a clear day's word to haze */
export const HAZE_SHOWN = 0.35;

/** The clock's icon and the weather's word (a string key) */
export function skyOf(weather: Weather | null | undefined, night: boolean): { icon: SkyIcon; word: string } {
  const kind = weather?.kind ?? "sunny";
  if (kind === "sunny") {
    if ((weather?.smoke ?? 0) >= HAZE_SHOWN) return { icon: "smoke", word: "weather.kind.smoke" };
    return night ? { icon: "moon", word: "weather.kind.clear" } : { icon: "sun", word: "weather.kind.sunny" };
  }
  return { icon: kind === "overcast" ? "cloud" : kind, word: `weather.kind.${kind}` };
}

/**
 * The weather's tooltip: the season and the sky now, the month's character (its showers), and what the month's weather
 * does to the city. monthWeather: the month's (gameMap.weather); the sky's when it is not given.
 */
export function weatherTip(weather: Weather | null | undefined, month: number, climate: Climate | undefined,
    night: boolean, monthWeather: Weather | null | undefined = weather): string {
  const kind = monthWeather?.kind ?? "sunny";
  const lines = [`${t(`weather.season.${thaiSeason(month, climate)}`)} · ${t(skyOf(weather, night).word)}`,
    t(`weather.month.${kind}`), t(`weather.effect.${kind}`)];
  if ((monthWeather?.smoke ?? 0) >= HAZE_SHOWN) lines.push(t("weather.effect.smoke"));
  return lines.join("\n");
}

/** The sky's icons, one shown at a time (css/time-controls.css) */
const SKY_ICONS = '<svg viewBox="0 0 24 24" aria-hidden="true">'
  + '<g class="sky sky-sun"><circle class="timeSun" cx="12" cy="12" r="4.5"/><path class="timeSun" d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8"/></g>'
  + '<g class="sky sky-moon"><path class="timeMoon" d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z"/></g>'
  + '<g class="sky sky-cloud"><path class="timeCloud" d="M7 18h10a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 18z"/></g>'
  + '<g class="sky sky-rain"><path class="timeCloud" d="M7 14h10a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 14z"/>'
  + '<path class="timeDrop" d="M8.5 16.5l-1 3M12.5 16.5l-1 3M16.5 16.5l-1 3"/></g>'
  + '<g class="sky sky-storm"><path class="timeCloud timeDark" d="M7 13h10a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 13z"/>'
  + '<path class="timeBolt" d="M12.8 13.5l-2.6 4.3h3l-1.8 4"/></g>'
  + '<g class="sky sky-fog"><path class="timeFog" d="M4 8h16M2.5 12h19M4 16h16M6 20h12"/></g>'
  + '<g class="sky sky-smoke"><circle class="timeSun" cx="12" cy="8.5" r="4"/><path class="timeFog" d="M3 15h18M5 19h14"/></g>'
  + '</svg>';

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
  // The clock: the sky's icon (a sun by day, a moon by night, or the weather) and the hour (src/dayClock.ts) ...
  const clock = doc.createElement("span");
  clock.className = "timeClock";
  clock.dataset.sky = "sun";
  clock.innerHTML = `${SKY_ICONS}<span class="timeHour"></span>`;
  const hour = clock.querySelector(".timeHour") as HTMLElement;
  if (game.dayClock) bar.append(clock);
  // ... and the month's weather in a word, with the season and what it does when pointed at
  const weather = doc.createElement("span");
  weather.className = "timeWeather";
  if (game.gameMap) bar.append(weather);
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
    const month = game.simulation?.getDate().month ?? 0, night = game.dayClock?.night(month) ?? false;
    if (game.dayClock) {
      const now = game.dayClock.text();
      if (hour.textContent !== now) hour.textContent = now;
      clock.classList.toggle("night", night);
      if (month !== shownMonth) {
        shownMonth = month;
        const sun = sunHours(month);
        clock.title = t("time.sun", { rise: clockText(sun.rise), set: clockText(sun.set) });
      }
    }
    // The sky now: its icon, its word, and the tooltip when the sky, the month's weather, the night or the month changes
    const monthly = game.gameMap?.weather ?? null, now = game.skyNow !== undefined ? game.skyNow : monthly;
    const sky = skyOf(now, night);
    const sign = `${sky.icon}|${sky.word}|${now?.kind}|${monthly?.kind}|${(monthly?.smoke ?? 0) >= HAZE_SHOWN}|${month}`;
    if (sign !== shownSky) {
      shownSky = sign;
      clock.dataset.sky = sky.icon;
      weather.dataset.kind = now?.kind ?? "sunny";
      weather.textContent = t(sky.word);
      weather.title = weatherTip(now, month, game.simulation?.rules?.weather, night, monthly);
      weather.setAttribute("aria-label", weather.title);
    }
  };
  let shownMonth = -1;
  let shownSky = "";
  label();
  refresh();
  onLanguageChange(() => { label(); shownMonth = -1; shownSky = ""; refresh(); });
  // P on the rail, the settings window and loading a city change the speed too, and the clock moves: look a few times
  // a second
  setInterval(refresh, 250);
  return bar;
}
