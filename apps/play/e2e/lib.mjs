/**
 * Shared Playwright helpers for the end-to-end suites.
 *
 * Everything here drives the product the way a person does: lobby buttons, setup
 * overlays, HTML5 drag & drop, chat, settings. No `window.__riftDebug` calls.
 *
 * URLs are configurable (see ./README.md):
 *   PLAY_URL          play app origin            (default http://localhost:3070)
 *   REALTIME_URL      realtime worker origin     (default http://localhost:2001)
 *                     (must equal the play app's NEXT_PUBLIC_REALTIME_HOST)
 */
import { createRequire } from "node:module";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const playwright = require("../../../.recon/tools-browser/node_modules/playwright");

const HERE = dirname(fileURLToPath(import.meta.url));

export const PLAY_URL = (process.env.PLAY_URL ?? "http://localhost:3070").replace(/\/+$/, "");
export const REALTIME_URL = (process.env.REALTIME_URL ?? "http://localhost:2001").replace(
  /\/+$/,
  "",
);
export const DECK_FIXTURE = resolve(HERE, "fixtures/atlas-standard.txt");
export const CARD_TYPES_FIXTURE = resolve(HERE, "fixtures/card-types.json");
export const ARTIFACT_DIR = resolve(HERE, "artifacts");

const VIEWPORT = { width: 1600, height: 1000 };

/* ------------------------------------------------------------------ logging */

export function log(message) {
  console.log(message);
}

export function step(label, message) {
  console.log(`[${label}] ${message}`);
}

/* ------------------------------------------------------------------ browser */

export async function launchBrowser() {
  return playwright.chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
    headless: process.env.HEADLESS !== "false",
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
}

const pageErrors = new WeakMap();

export async function newPage(browser, label = "page") {
  const context = await browser.newContext({
    viewport: VIEWPORT,
    ...(process.env.E2E_TOUCH === "true" ? { hasTouch: true } : {}),
  });
  const page = await context.newPage();
  const errors = [];
  pageErrors.set(page, errors);
  page.on("pageerror", (error) => {
    errors.push(error.message);
    console.error(`[${label} pageerror]`, error.message.split("\n")[0]?.slice(0, 300));
  });
  page.on("console", (message) => {
    if (message.type() === "error") {
      const text = message.text();
      // Static asset / card image 404s are expected offline; compile errors are not.
      if (/^Failed to load resource/.test(text)) return;
      if (/Error:|SyntaxError|ReferenceError|TypeError/.test(text)) {
        errors.push(text.split("\n")[0]?.slice(0, 300) ?? text);
      }
    }
  });
  return { context, page };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function pageErrorsFor(page) {
  return [...(pageErrors.get(page) ?? [])];
}

/* ------------------------------------------------------------------ fixtures */

export async function readDeckFixture() {
  return readFile(DECK_FIXTURE, "utf8");
}

let cardTypesPromise = null;
export async function cardTypes() {
  if (!cardTypesPromise) {
    cardTypesPromise = readFile(CARD_TYPES_FIXTURE, "utf8").then(
      (raw) => new Map(Object.entries(JSON.parse(raw))),
    );
  }
  return cardTypesPromise;
}

/* ------------------------------------------------------------------ accounts / lobby */

export async function signInAccount(page, username = "atlas", password = "1234") {
  await page.goto(PLAY_URL, { waitUntil: "domcontentloaded" });
  await page.getByRole("link", { name: "Sign in" }).first().click();
  const dialog = page.locator("[data-account-dialog]");
  await dialog.waitFor({ state: "visible" });
  await page.getByTestId("account-email").fill(username.includes("@") ? username : `${username}@local.test`);
  await page.getByTestId("account-email-continue").click();
  await page.getByTestId("account-password").fill(password);
  await page.getByTestId("account-submit").click();
  await page
    .locator('[data-testid="simulator-guest-account"]')
    .filter({ hasText: username })
    .waitFor({ state: "visible", timeout: 20_000 });
  await dialog.waitFor({ state: "hidden", timeout: 20_000 }).catch(() => {});
}

export async function continueAsGuest(page, name = "E2E Guest") {
  await page.goto(PLAY_URL, { waitUntil: "domcontentloaded" });
  await page.getByRole("link", { name: "Sign in" }).first().click();
  const dialog = page.locator("[data-account-dialog]");
  await dialog.waitFor({ state: "visible" });
  await page.getByTestId("account-email").fill(`${name.toLowerCase().replace(/[^a-z0-9]+/g, ".")}@guest.local`);
  await page.getByTestId("account-email-continue").click();
  await dialog.getByPlaceholder("Display name").fill(name);
  await dialog.getByRole("button", { name: "Continue as guest" }).click();
  await page
    .locator('[data-testid="simulator-guest-account"]')
    .filter({ hasText: name })
    .waitFor({ state: "visible", timeout: 20_000 });
  await dialog.waitFor({ state: "hidden", timeout: 20_000 }).catch(() => {});
}

export async function importDeck(page, deckText) {
  const raw = deckText ?? (await readDeckFixture());
  await page.getByRole("button", { name: "Import Deck" }).first().click();
  const dialog = page.getByRole("dialog", { name: "Import deck list" });
  await dialog.waitFor({ state: "visible" });
  await dialog.locator("textarea").fill(raw);
  const submit = dialog.getByRole("button", { name: "Import Deck" });
  await waitFor(async () => (await submit.isEnabled()) || false, {
    label: "import dialog to accept the fixture deck",
  });
  await submit.click();
  await dialog.waitFor({ state: "hidden" });
}

export async function createSoloRoom(page) {
  await page.getByRole("button", { name: "Solo Room" }).click();
  await page.locator("[data-lobby-room-console]").waitFor({ state: "visible", timeout: 30_000 });
  return roomCodeFrom(page);
}

export async function hostRoom(page) {
  await page.getByRole("button", { name: "Host Room" }).click();
  await page.locator("[data-lobby-room-console]").waitFor({ state: "visible", timeout: 30_000 });
  return roomCodeFrom(page);
}

export async function joinRoom(page, code) {
  await page.locator("#join-code").fill(code);
  await page.getByRole("button", { name: "Join / Spectate" }).click();
  await page.locator("[data-lobby-room-console]").waitFor({ state: "visible", timeout: 30_000 });
}

export async function roomCodeFrom(page) {
  const code = (await page.locator(".lobby-invite-code-value").innerText()).trim();
  assert(/^[A-Z0-9]{4,10}$/.test(code), `room code looks valid (${code})`);
  return code;
}

export async function readyUp(page) {
  const button = page.getByRole("button", { name: /Ready Up/i }).first();
  if ((await button.count()) === 0) return;
  if (await button.isDisabled().catch(() => true)) return;
  await button.click();
  await waitFor(async () => (await button.isDisabled().catch(() => true)) || false, {
    label: "ready state",
    timeout: 10_000,
  }).catch(() => {});
}

export async function startMatch(page, { timeout = 60_000 } = {}) {
  const start = page.getByRole("button", { name: "Start Match" });
  await waitFor(
    async () => (await start.count()) > 0 && !(await start.isDisabled().catch(() => true)),
    { label: "Start Match to become enabled", timeout },
  );
  await start.click();
  await page.waitForURL(/\/game(\?|$)/, { timeout: 60_000 });
}

/* ------------------------------------------------------------------ /game boot */

export async function phase(page) {
  return page
    .getByTestId("game-state")
    .getAttribute("data-phase")
    .catch(() => null);
}

export async function waitForPhase(page, expected, timeout = 60_000) {
  return waitFor(async () => ((await phase(page)) === expected ? true : false), {
    label: `phase ${expected}`,
    timeout,
  });
}

export async function waitForGame(page, timeout = 60_000) {
  await page.waitForURL(/\/game(\?|$)/, { timeout });
  await page.getByTestId("game-state").waitFor({ state: "attached", timeout });
  await page.getByTestId("game-ready").waitFor({ state: "attached", timeout });
  // Wait until the runtime has joined gameplay and the authoritative room is projected.
  await waitFor(
    async () => {
      const sessionPhase = await page
        .getByTestId("game-state")
        .getAttribute("data-session-phase")
        .catch(() => null);
      const current = await phase(page);
      return (sessionPhase === "live" || current === "in_game") && !!current && current !== "lobby";
    },
    { label: "game runtime live", timeout },
  );
}

/* ------------------------------------------------------------------ setup flow */

async function isEnabled(locator) {
  if ((await locator.count()) === 0) return false;
  return locator
    .first()
    .isEnabled()
    .catch(() => false);
}

/**
 * One non-blocking setup tick. Returns "acted", "wait" or "done".
 *
 * `twoSeats` is true for the solo/goldfish client, where one browser controls
 * both seats and therefore may click the opponent row's battlefield option and
 * the "Lock In Both" mulligan button.
 */
export async function setupStep(page, { twoSeats = false, label = "setup" } = {}) {
  const current = await phase(page);
  if (current === "in_game") return "done";

  if (current === "sideboarding") {
    const both = page.getByTestId("lock-in-both-decks");
    if (await isEnabled(both)) {
      step(label, "sideboarding: lock in both decks");
      await both.click();
      return "acted";
    }
    const single = page.getByTestId("lock-in-sideboard");
    if (await isEnabled(single)) {
      step(label, "sideboarding: lock in deck");
      await single.click();
      return "acted";
    }
    return "wait";
  }

  if (current === "battlefield_pick") {
    const active = page.locator('[data-battlefield-player-id][data-battlefield-active="true"]');
    if ((await active.count()) === 0) return "wait";
    const row = active.first();
    const ownRow = (await row.locator('[data-testid^="battlefield-own-option-"]').count()) > 0;
    if (!twoSeats && !ownRow) return "wait";
    const option = row
      .locator(
        '[data-testid^="battlefield-own-option-"]:enabled, [data-testid^="battlefield-opponent-option-"]:enabled',
      )
      .first();
    if ((await option.count()) === 0) return "wait";
    const name = await option.getAttribute("data-battlefield-name");
    step(label, `battlefield_pick: choose ${name}${ownRow ? "" : " (controlled opponent seat)"}`);
    await option.click().catch(() => {});
    await sleep(150);
    return "acted";
  }

  if (current === "initiative_roll") {
    // Controlled seats auto-dispatch roll_initiative. Only use the manual
    // fallback when the stage has clearly stalled.
    const roll = page.getByTestId("initiative-roll");
    if (await isEnabled(roll)) {
      step(label, "initiative_roll: manual fallback roll");
      await roll.click().catch(() => {});
      return "acted";
    }
    return "wait";
  }

  if (current === "first_player_choice") {
    const choice = page
      .locator('[data-testid^="first-player-choice-"][data-player-relation]:enabled')
      .first();
    if ((await choice.count()) === 0) return "wait";
    const relation = await choice.getAttribute("data-player-relation");
    const optionLabel = await choice.getAttribute("aria-label");
    step(label, `first_player_choice: ${optionLabel ?? relation ?? "choose"}`);
    await choice.click().catch(() => {});
    await sleep(150);
    return "acted";
  }

  if (current === "mulligan") {
    const both = page.getByTestId("mulligan-both-submit");
    if (await isEnabled(both)) {
      step(label, "mulligan: Lock In Both · Keep both");
      await both.click();
      return "acted";
    }
    const own = page.getByTestId("mulligan-submit");
    if (await isEnabled(own)) {
      step(label, `mulligan: ${(await own.innerText()).trim()} (0 selected)`);
      await own.click();
      return "acted";
    }
    const opponent = page.getByTestId("mulligan-opponent-submit");
    if (await isEnabled(opponent)) {
      step(label, "mulligan: submit controlled opponent seat");
      await opponent.click();
      return "acted";
    }
    return "wait";
  }

  return "wait";
}

export async function completeSetup(page, options = {}) {
  const label = options.label ?? "setup";
  const timeout = options.timeout ?? 150_000;
  const deadline = Date.now() + timeout;
  let last = null;
  while (Date.now() < deadline) {
    const current = await phase(page).catch(() => null);
    if (current === "in_game") return;
    if (current && current !== last) {
      step(label, `phase ${current}`);
      last = current;
    }
    await setupStep(page, options);
    await sleep(120);
  }
  throw new Error(`[${label}] setup did not finish (phase=${await phase(page)})`);
}

/** Drive setup for several independent clients, each controlling only its own seat. */
export async function completeMultiplayerSetup(entries, { timeout = 180_000 } = {}) {
  const deadline = Date.now() + timeout;
  let last = "";
  while (Date.now() < deadline) {
    const phases = await Promise.all(entries.map((entry) => phase(entry.page).catch(() => null)));
    if (phases.every((value) => value === "in_game")) return;
    const signature = phases.map((value, index) => `${entries[index].label}:${value}`).join(" ");
    if (signature !== last) {
      log(`[mp] setup ${signature}`);
      last = signature;
    }
    for (let index = 0; index < entries.length; index += 1) {
      if (phases[index] !== "in_game") {
        await setupStep(entries[index].page, {
          twoSeats: false,
          label: entries[index].label,
        }).catch(() => {});
      }
    }
    await sleep(150);
  }
  throw new Error(
    `[mp] setup did not finish (${entries.map((entry) => `${entry.label}=${entry.page.url()}`).join(" ")})`,
  );
}

/* ------------------------------------------------------------------ game assertions */

export async function gameState(page, attribute) {
  return page.getByTestId("game-state").getAttribute(attribute);
}

export async function handCounts(page) {
  const raw = (await gameState(page, "data-hand-counts")) ?? "";
  return raw
    .split(",")
    .filter((entry) => entry.length > 0)
    .map((entry) => Number.parseInt(entry, 10));
}

export async function turnNumber(page) {
  return Number.parseInt((await gameState(page, "data-turn")) ?? "0", 10);
}

export async function viewerId(page) {
  return gameState(page, "data-viewer-id");
}

export async function controlledPlayerIds(page) {
  return ((await gameState(page, "data-controlled-player-ids")) ?? "").split(",").filter(Boolean);
}

export function matchLog(page) {
  return page.locator("[data-match-log-list]");
}

export async function matchLogText(page) {
  return matchLog(page)
    .innerText()
    .catch(() => "");
}

export async function matchLogEntryCount(page) {
  return page.locator("[data-match-log-list] li").count();
}

export async function turnGroupCount(page) {
  return page.locator('[data-match-log-group="turn"]').count();
}

export async function endTurn(page) {
  const beforeTurn = await turnNumber(page);
  const beforeGroups = await turnGroupCount(page);
  const button = page.getByRole("button", { name: "End turn" }).first();
  await button.waitFor({ state: "visible" });
  assert(!(await button.isDisabled()), "End turn is enabled");
  await button.click();
  await waitFor(
    async () => {
      const turn = await turnNumber(page);
      const groups = await turnGroupCount(page);
      return turn > beforeTurn && groups > beforeGroups;
    },
    { label: "turn counter and match-log turn group to advance", timeout: 20_000 },
  );
  return {
    beforeTurn,
    afterTurn: await turnNumber(page),
    beforeGroups,
    afterGroups: await turnGroupCount(page),
    log: await matchLogText(page),
  };
}

/* ------------------------------------------------------------------ cards & drag */

export async function handCards(page) {
  const root = page.locator('[data-drop-zone-root="hand"][data-zone-owner="self"]');
  const buttons = root.locator('button[data-board-card-visual="true"]');
  const count = await buttons.count();
  const types = await cardTypes();
  const cards = [];
  for (let index = 0; index < count; index += 1) {
    const button = buttons.nth(index);
    const name = await button
      .locator("img[alt]")
      .first()
      .getAttribute("alt")
      .catch(() => null);
    cards.push({
      index,
      id: await button.getAttribute("data-card-id"),
      name: name ?? "(unknown)",
      type: types.get(name ?? "") ?? "Unknown",
      locator: button,
    });
  }
  return cards;
}

export async function zoneCards(page, zone, owner = "self") {
  const root = page.locator(`[data-drop-zone-root="${zone}"][data-zone-owner="${owner}"]`);
  const buttons = root.locator('button[data-board-card-visual="true"]');
  const count = await buttons.count();
  const cards = [];
  for (let index = 0; index < count; index += 1) {
    const button = buttons.nth(index);
    const name = await button
      .locator("img[alt]")
      .first()
      .getAttribute("alt")
      .catch(() => null);
    cards.push({
      id: await button.getAttribute("data-card-id"),
      name: name ?? "(unknown)",
      locator: button,
    });
  }
  return cards;
}

function center(box) {
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/**
 * HTML5 drag & drop with the mouse. Chromium turns a mouse drag on a
 * `draggable` card into native dragstart/dragover/drop events, which is exactly
 * what the board listens for.
 */
export async function dragCard(page, source, target, { label = "drag", steps = 18 } = {}) {
  await source.scrollIntoViewIfNeeded().catch(() => {});
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  assert(!!sourceBox, `${label}: source card has a bounding box`);
  assert(!!targetBox, `${label}: target drop zone has a bounding box`);
  const from = center(sourceBox);
  const to = center(targetBox);

  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await sleep(120);
  await page.mouse.move(from.x + 18, from.y - 18, { steps: 4 });
  await sleep(80);
  await page.mouse.move(to.x, to.y, { steps });
  await page.mouse.move(to.x + 2, to.y + 2, { steps: 3 });
  await sleep(160);
  const dragging = await page
    .getByTestId("game-ready")
    .getAttribute("data-board-dragging")
    .catch(() => null);
  assert(
    dragging === "true",
    `${label}: native drag session started (data-board-dragging=${dragging})`,
  );
  await page.mouse.up();
  await sleep(250);
}

export async function playUnitFromHandToBase(page, { label = "play card" } = {}) {
  const cards = await handCards(page);
  const unit = cards.find((card) => card.type === "Unit");
  assert(
    !!unit,
    `${label}: a unit is in hand (found ${cards.map((card) => `${card.name} [${card.type}]`).join(", ") || "none"})`,
  );
  const before = await handCounts(page);
  const base = page.locator('[data-drop-zone-root="base"][data-zone-owner="self"]').first();
  await dragCard(page, unit.locator, base, { label: `${label}: ${unit.name} → base` });
  await waitFor(
    async () => {
      const names = (await zoneCards(page, "base")).map((card) => card.name);
      const after = await handCounts(page);
      return names.includes(unit.name) && after.join(",") !== before.join(",");
    },
    { label: `${label}: ${unit.name} to appear in base and leave hand`, timeout: 20_000 },
  );
  step(label, `played ${unit.name} from hand to base`);
  return unit;
}

export async function moveBaseUnitToBattlefield(
  page,
  cardName,
  { label = "move unit", zone = "battlefieldA" } = {},
) {
  const baseCards = await zoneCards(page, "base");
  const card = baseCards.find((entry) => entry.name === cardName);
  assert(
    !!card,
    `${label}: ${cardName} is in base (found ${baseCards.map((entry) => entry.name).join(", ")})`,
  );
  const target = page.locator(`[data-drop-zone-root="${zone}"][data-zone-owner="self"]`).first();
  await dragCard(page, card.locator, target, { label: `${label}: ${cardName} → ${zone}` });
  await waitFor(
    async () => {
      const inZone = (await zoneCards(page, zone)).map((entry) => entry.name);
      const inBase = (await zoneCards(page, "base")).map((entry) => entry.name);
      return inZone.includes(cardName) && !inBase.includes(cardName);
    },
    { label: `${label}: ${cardName} in ${zone} and out of base`, timeout: 20_000 },
  );
  step(label, `moved ${cardName} from base to ${zone}`);
  return card;
}

export async function expectCardInZone(page, zone, name, owner = "self") {
  const names = (await zoneCards(page, zone, owner)).map((card) => card.name);
  assert(names.includes(name), `${name} is in ${owner} ${zone} (found ${names.join(", ")})`);
}

/* ------------------------------------------------------------------ chat & settings */

export async function sendChat(page, text, { label = "chat" } = {}) {
  const input = page.getByTestId("chat-composer-input").locator("textarea");
  await input.waitFor({ state: "visible" });
  await input.fill(text);
  await input.press("Enter");
  await waitForChatMessage(page, text, { label });
  step(label, `sent chat message: ${text}`);
}

export async function waitForChatMessage(page, text, { label = "chat", timeout = 20_000 } = {}) {
  await waitFor(
    async () =>
      (
        await page
          .locator("[data-chat-message-list]")
          .innerText()
          .catch(() => "")
      ).includes(text),
    { label: `${label}: chat message "${text}" to appear`, timeout },
  );
}

export async function openSettings(page, { label = "settings" } = {}) {
  await page.getByTestId("game-settings-trigger").click();
  const panel = page.locator("[data-game-settings-panel]");
  await panel.waitFor({ state: "visible" });
  assert((await panel.getAttribute("role")) === "dialog", "settings panel is exposed as a dialog");
  step(label, "opened the game settings panel");
  return panel;
}

/**
 * Request a rewind from the sidebar room-action rail.
 *
 * The floating `[data-testid="rewind-last-action"]` quick control is painted
 * underneath the newer board-toggles dock in the current layout, so a pointer
 * click on it is intercepted. The sidebar Rewind control is the same user
 * feature and remains clickable; the overlap is reported by the suite.
 */
export async function requestRewind(page, { label = "rewind" } = {}) {
  const quick = page.getByTestId("rewind-last-action").first();
  if ((await quick.count()) > 0 && !(await quick.isDisabled().catch(() => true))) {
    const clickable = await quick
      .evaluate((element) => {
        const rect = element.getBoundingClientRect();
        const top = document.elementFromPoint(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
        );
        return top === element || !!top?.closest('[data-testid="rewind-last-action"]');
      })
      .catch(() => false);
    if (clickable) {
      await quick.click();
      step(label, 'clicked [data-testid="rewind-last-action"]');
      return "quick";
    }
    console.warn(
      "[e2e] APP BUG: [data-testid=rewind-last-action] is covered by another control; using the sidebar Rewind control instead.",
    );
  }

  const primary = page
    .locator(
      '[data-sidebar-slot-root="true"] [data-room-actions-override="desktop"] button[aria-label="Rewind the last action"]',
    )
    .first();
  const button = (await primary.count())
    ? primary
    : page
        .locator('[data-sidebar-slot-root="true"] button[aria-label="Rewind the last action"]')
        .last();
  await button.waitFor({ state: "visible" });
  assert(!(await button.isDisabled()), `${label}: sidebar Rewind control is enabled`);
  await button.click();
  step(label, "clicked the sidebar Rewind control");
  return "sidebar";
}

/* ------------------------------------------------------------------ leave */

/**
 * The board action rail's "Leave the room" path. Confirms the dialog and waits
 * for the player to land back in the lobby.
 */
export async function leaveRoomViaActionRail(page, { label = "leave", timeout = 30_000 } = {}) {
  const leave = page.getByRole("button", { name: "Leave the room" }).first();
  await leave.waitFor({ state: "visible" });
  await leave.click();
  const dialog = page.getByRole("dialog", { name: "Leave room?" });
  await dialog.waitFor({ state: "visible" });
  await dialog.getByRole("button", { name: "Leave", exact: true }).click();
  await page.waitForURL((url) => url.pathname === "/", { timeout });
  step(label, "left the room and returned to the lobby");
}

/* ------------------------------------------------------------------ events / errors */

export async function waitFor(fn, options = {}) {
  const timeout = options.timeout ?? 30_000;
  const interval = options.interval ?? 120;
  const started = Date.now();
  let lastError = null;
  while (Date.now() - started < timeout) {
    try {
      const value = await fn();
      if (value) return value;
    } catch (error) {
      lastError = error;
    }
    await sleep(interval);
  }
  throw new Error(
    `Timed out after ${timeout}ms${options.label ? ` waiting for ${options.label}` : ""}${
      lastError ? `: ${lastError.message}` : ""
    }`,
  );
}

export function sleep(ms) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, ms));
}

export function assert(condition, message) {
  if (!condition) throw new Error(`Assertion failed: ${message}`);
}

/* ------------------------------------------------------------------ artifacts / runner */

export async function screenshot(page, name) {
  await mkdir(ARTIFACT_DIR, { recursive: true });
  const safe = name.replace(/[^a-z0-9_.-]+/gi, "-");
  const file = resolve(ARTIFACT_DIR, safe.endsWith(".png") ? safe : `${safe}.png`);
  await page.screenshot({ path: file, fullPage: false }).catch((error) => {
    console.error(`screenshot failed: ${error.message}`);
  });
  return file;
}

/**
 * Common runner: logs elapsed time, screenshots every page on failure (into
 * e2e/artifacts/), exits non-zero on failure.
 */
export async function run(name, fn, pages = [], options = {}) {
  const started = Date.now();
  let failure = null;
  try {
    await fn();
    log(`[${name}] PASS in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  } catch (error) {
    failure = error;
    console.error(`[${name}] FAIL in ${((Date.now() - started) / 1000).toFixed(1)}s`);
    console.error(`[${name}] ${error instanceof Error ? error.message : String(error)}`);
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    for (const [index, page] of pages.entries()) {
      if (!page) continue;
      const label = options.labels?.[index] ?? `page-${index + 1}`;
      await screenshot(page, `${name}-${stamp}-${label}-failure.png`);
      const currentPhase = await phase(page).catch(() => null);
      console.error(
        `[${name}] ${label} url=${page.url()} phase=${currentPhase ?? "?"} errors=${JSON.stringify(
          pageErrorsFor(page).slice(-3),
        )}`,
      );
    }
  } finally {
    await options.cleanup?.();
  }
  await sleep(80);
  process.exit(failure ? 1 : 0);
}

/** Convenience for tests that need both the page and its context. */
export async function closeContexts(contexts) {
  for (const context of contexts) {
    await context.close().catch(() => {});
  }
}
