/**
 * Deck-builder end-to-end.
 *
 * Guest: build a complete legal deck through the catalog UI (Legend → Champion →
 * Main Deck → Battlefields → Runes), check counts/issues/stats/full art, export the
 * decklist, reload (local draft survives) and use "Play in Simulator" to land in the
 * lobby with the deck loaded from its deck code.
 *
 * Signed-in (atlas/1234): import the fixture deck in the builder, save it, reopen it
 * from /decks/<savedDeckId>, and play it through the lobby's ?savedDeckId= path.
 *
 * Screenshots land in apps/play/.verify/b27/ at 1920, 1440, 1000 and 390.
 *
 * Run (start realtime on 2009 and play on 3150 first):
 *   PLAY_URL=http://localhost:3150 REALTIME_URL=http://localhost:2009 \
 *     node apps/play/e2e/decks.mjs
 */
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";

import {
  PLAY_URL,
  assert,
  launchBrowser,
  newPage,
  pageErrorsFor,
  readDeckFixture,
  run,
  signInAccount,
  step,
  waitFor,
} from "./lib.mjs";

const VERIFY_DIR = resolve(import.meta.dirname, "../.verify/b27");

const LEGEND = "Kai'Sa, Daughter of the Void";
const CHAMPION = "Kai'Sa, Evolutionary";
const MAIN = [
  ["Ahri, Inquisitive", 3],
  ["Akali, Brash", 3],
  ["Akali, Deadly Weapon", 3],
  ["Amateur Demolitionist", 3],
  ["Angle Shot", 3],
  ["Annie, Fiery", 3],
  ["Antagonistic Apparatus", 3],
  ["Applied Researchers", 3],
  ["Apprentice Mage", 3],
  ["Arena Kingpin", 3],
  ["Armed Assailant", 3],
  ["Aspiring Engineer", 3],
  ["Blazing Scorcher", 3],
];
const BATTLEFIELDS = ["Abandoned Hall", "Altar of Blood", "Altar to Unity"];
const RUNES = [
  ["Fury Rune", 6],
  ["Mind Rune", 6],
];

async function shot(page, name) {
  await mkdir(VERIFY_DIR, { recursive: true });
  await page.screenshot({ path: resolve(VERIFY_DIR, name), fullPage: false });
}

async function gotoNewBuilder(page) {
  await page.goto(`${PLAY_URL}/decks/new?clearDraft=1`, { waitUntil: "domcontentloaded" });
  await waitFor(
    async () =>
      (await page.getByTestId("deckbuilder-catalog-summary").innerText()).includes("58 of 58"),
    { label: "empty builder catalog", timeout: 45_000 },
  );
  await page.waitForTimeout(700);
}

async function selectTab(page, label) {
  await page.locator(`[data-catalog-tab="${label}"]`).click();
  await page.waitForTimeout(120);
}

async function addCard(page, name, times = 1) {
  const search = page.getByTestId("deckbuilder-catalog-search");
  await search.fill(name);
  await page.waitForTimeout(150);
  const button = page.getByRole("button", {
    name: `Add ${name} to the selected deck section`,
  });
  await button.waitFor({ state: "visible", timeout: 15_000 });
  for (let index = 0; index < times; index += 1) {
    await button.click();
    await page.waitForTimeout(70);
  }
}

async function sectionBadge(page, section) {
  const badge = page
    .locator(
      `[data-deck-workspace-section="${section}"] [data-deck-section-sticky-header] span.tabular-nums[aria-hidden="true"]`,
    )
    .first();
  return (await badge.innerText()).trim();
}

async function buildGuestDeck(page) {
  step("guest", "build Legend → Champion → Main Deck through the catalog");
  await addCard(page, LEGEND);
  await waitFor(
    async () =>
      (await page
        .locator('[data-catalog-tab][aria-pressed="true"]')
        .getAttribute("data-catalog-tab")) === "champion",
    { label: "auto-advance to Champion" },
  );
  assert(
    (await page.getByTestId("deckbuilder-catalog-summary").innerText()).includes("3 of 3"),
    "the Champion pool is narrowed to the three Kai'Sa champions",
  );
  await addCard(page, CHAMPION);
  await waitFor(
    async () =>
      (await page
        .locator('[data-catalog-tab][aria-pressed="true"]')
        .getAttribute("data-catalog-tab")) === "mainDeck",
    { label: "auto-advance to Main Deck" },
  );

  for (const [name, count] of MAIN) {
    await addCard(page, name, count);
  }
  assert((await sectionBadge(page, "mainDeck")) === "39/39", "Main Deck reaches 39/39");

  step("guest", "fill Battlefields and Runes");
  await selectTab(page, "battlefields");
  for (const name of BATTLEFIELDS) await addCard(page, name);
  await selectTab(page, "runes");
  for (const [name, count] of RUNES) await addCard(page, name, count);

  assert((await sectionBadge(page, "legend")) === "1/1", "Legend is complete");
  assert((await sectionBadge(page, "champion")) === "1/1", "Champion is complete");
  assert((await sectionBadge(page, "battlefields")) === "3/3", "Battlefields are complete");
  assert((await sectionBadge(page, "runes")) === "12/12", "Runes are complete");
  assert((await sectionBadge(page, "sideboard")) === "0/10", "Sideboard stays empty");

  await waitFor(
    async () => (await page.locator('button[aria-label*="validation issue"]').count()) === 0,
    { label: "validation issues to clear" },
  );
  await waitFor(
    async () => !(await page.getByRole("button", { name: "Play in Simulator" }).isDisabled()),
    { label: "Play in Simulator to enable" },
  );
}

async function statsAndFullArt(page) {
  step("guest", "check Stats and Full Art views");
  await page.getByRole("tab", { name: "Stats" }).click();
  const stats = page.locator('[role="tabpanel"]');
  await waitFor(async () => (await stats.innerText()).includes("Avg Energy"), {
    label: "stats view",
  });
  const statsText = await stats.innerText();
  assert(
    statsText.includes("Main Deck") && statsText.includes("Avg Might"),
    "stats summary renders",
  );
  assert(/energy curve/i.test(statsText) && /keywords/i.test(statsText), "stats charts render");
  await shot(page, "decks-stats-1920.png");

  await page.getByRole("tab", { name: "Full Art" }).click();
  await waitFor(async () => (await page.locator("[data-deck-full-art-card]").count()) >= 20, {
    label: "full-art tiles",
  });
  await page
    .waitForFunction(
      () =>
        [...document.querySelectorAll("[data-deck-full-art-card] img")]
          .slice(0, 15)
          .every((image) => image.complete && image.naturalWidth > 0),
      undefined,
      { timeout: 20_000 },
    )
    .catch(() => {});
  await page.waitForTimeout(250);
  await shot(page, "decks-fullart-1920.png");
  await page.getByRole("tab", { name: "List" }).click();
}

async function popoverScreenshots(page) {
  await page.getByRole("button", { name: "Filter cards" }).click();
  await page.waitForTimeout(250);
  await shot(page, "decks-filter-1920.png");
  await page.keyboard.press("Escape");
  await page.getByTestId("deckbuilder-catalog-view-options").click();
  await page.waitForTimeout(250);
  await shot(page, "decks-view-1920.png");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Export deck" }).click();
  await page.waitForTimeout(200);
  await shot(page, "decks-export-1920.png");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Import deck" }).click();
  const dialog = page.getByRole("dialog", { name: "Import Deck" });
  await dialog.waitFor({ state: "visible" });
  await shot(page, "decks-import-1920.png");
  await dialog.getByRole("button", { name: "Use Deck Code" }).click();
  await page.waitForTimeout(200);
  await shot(page, "decks-import-code-1920.png");
  await page.keyboard.press("Escape");
  await page
    .getByRole("button", { name: `View details for ${LEGEND}` })
    .first()
    .click();
  await page.getByRole("dialog", { name: `${LEGEND} card details` }).waitFor({ state: "visible" });
  await page.waitForTimeout(250);
  await shot(page, "decks-detail-1920.png");
  await page.getByRole("button", { name: "Close card details" }).click();
}

async function exportDecklist(page) {
  step("guest", "export the decklist through the export menu");
  await page
    .context()
    .grantPermissions(["clipboard-read", "clipboard-write"], { origin: PLAY_URL });
  await page.getByRole("button", { name: "Export deck" }).click();
  await page.getByRole("button", { name: "Copy decklist" }).click();
  await waitFor(
    async () => {
      const text = await page.evaluate(() => navigator.clipboard.readText());
      return text.includes("MainDeck:");
    },
    { label: "decklist on the clipboard" },
  );
  const copied = await page.evaluate(() => navigator.clipboard.readText());
  assert(copied.includes("Legend:") && copied.includes("Champion:"), "export has every header");
  assert(
    copied.includes("Runes:") && copied.includes("Sideboard:"),
    "export includes runes/sideboard",
  );
  assert(!/\[[A-Z]{2,4}-/.test(copied), "user-facing decklist omits card codes");
}

async function reloadDraft(page) {
  step("guest", "reload and verify the local draft survives");
  await page.reload({ waitUntil: "domcontentloaded" });
  await waitFor(
    async () => (await page.locator('[data-deck-entry-section="legend"]').count()) > 0,
    {
      label: "restored legend row",
    },
  );
  assert((await sectionBadge(page, "mainDeck")) === "39/39", "draft still has 39 main-deck cards");
  const draft = await page.evaluate(() => {
    const raw = localStorage.getItem("riftatlas_deckbuilder_draft_v1");
    return raw ? JSON.parse(raw) : null;
  });
  assert(draft?.version === 5, "draft is stored in the v5 shape");
  assert(draft?.linkedSavedDeckId === null, "guest draft is not linked to a saved deck");
  assert((draft?.deckSections?.runes?.length ?? 0) >= 2, "draft persists the rune section");
}

async function viewportScreenshots(page) {
  step("visual", "capture 1920 / 1440 / 1000 / 390");
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.waitForTimeout(700);
  await shot(page, "decks-filled-1920.png");
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.waitForTimeout(300);
  await shot(page, "decks-filled-1440.png");
  await page.setViewportSize({ width: 1000, height: 1000 });
  await page.waitForTimeout(300);
  await shot(page, "decks-filled-1000.png");
  await page.locator('[data-testid="mobile-deck-drawer-toggle"]').click();
  await page.waitForTimeout(350);
  await shot(page, "decks-drawer-1000.png");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
  await shot(page, "decks-drawer-390.png");
  await page.setViewportSize({ width: 1600, height: 1000 });
  await page.waitForTimeout(250);
}

async function guestPlay(page) {
  step("guest", "Play in Simulator loads the deck code in the lobby");
  await page.getByRole("button", { name: "Play in Simulator" }).click();
  await page.waitForURL((url) => url.pathname === "/" && !url.searchParams.has("deckCode"), {
    timeout: 45_000,
  });
  await waitFor(async () => (await page.locator("body").innerText()).includes("Deck loaded."), {
    label: "lobby deck-loaded toast",
  });
  const body = await page.locator("body").innerText();
  assert(/Kai'Sa/i.test(body), "the lobby shows the imported legend");
  await shot(page, "decks-lobby-guest.png");
}

async function signedInSave(browser) {
  step("atlas", "save a deck in the builder and reopen it from /decks/<id>");
  const { page, context } = await newPage(browser, "decks-atlas");
  try {
    await page.setViewportSize({ width: 1920, height: 1080 });
    await signInAccount(page);
    await gotoNewBuilder(page);
    const fixture = await readDeckFixture();
    await page.getByRole("button", { name: "Import deck" }).click();
    const dialog = page.getByRole("dialog", { name: "Import Deck" });
    await dialog.waitFor({ state: "visible" });
    await dialog.locator("#deck-import-textarea").fill(fixture);
    await waitFor(async () => (await dialog.innerText()).includes("1/1 legend"), {
      label: "import validation counts",
    });
    await dialog.getByRole("button", { name: "Import Deck" }).click();
    await dialog.waitFor({ state: "hidden" });

    const name = `E2E Builder ${Date.now()}`;
    await page.locator("#deck-name-input").fill(name);
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await waitFor(async () => /\/decks\/[^/]+$/.test(page.url()), {
      label: "saved deck route",
      timeout: 30_000,
    });
    const deckId = page.url().split("/decks/")[1];
    assert(Boolean(deckId), "save returned a deck id");
    await waitFor(
      async () =>
        (await page.locator("[data-deck-workspace-header]").innerText()).includes("Saved"),
      { label: "Saved status" },
    );
    await shot(page, "decks-saved-1920.png");

    await page.reload({ waitUntil: "domcontentloaded" });
    await waitFor(async () => (await page.locator("#deck-name-input").inputValue()) === name, {
      label: "reopened saved deck name",
      timeout: 30_000,
    });
    assert((await sectionBadge(page, "mainDeck")) === "39/39", "reopened deck has the saved list");
    assert((await sectionBadge(page, "runes")) === "12/12", "reopened deck keeps runes");

    await page.getByRole("button", { name: "Play in Simulator" }).click();
    await page.waitForURL((url) => url.pathname === "/" && !url.searchParams.has("savedDeckId"), {
      timeout: 45_000,
    });
    await waitFor(async () => (await page.locator("body").innerText()).includes("Deck loaded."), {
      label: "lobby loaded the saved deck",
    });
    const body = await page.locator("body").innerText();
    assert(/Kai'Sa/i.test(body), "lobby shows the saved deck identity");
    assert(pageErrorsFor(page).length === 0, "the signed-in builder has no page errors");
    await shot(page, "decks-lobby-saved.png");
    console.log(`[atlas] saved deck ${deckId} and loaded it in the lobby`);
  } finally {
    await context.close().catch(() => {});
  }
}

const browser = await launchBrowser();
const guest = await newPage(browser, "decks-guest");

await run(
  "decks",
  async () => {
    await guest.page.setViewportSize({ width: 1920, height: 1080 });
    await gotoNewBuilder(guest.page);
    await shot(guest.page, "decks-empty-1920.png");
    await guest.page.locator('button[aria-label*="validation issue"]').first().click();
    await guest.page.waitForTimeout(200);
    await shot(guest.page, "decks-issues-1920.png");
    await guest.page.keyboard.press("Escape");
    await buildGuestDeck(guest.page);
    await popoverScreenshots(guest.page);
    await statsAndFullArt(guest.page);
    await exportDecklist(guest.page);
    await reloadDraft(guest.page);
    await viewportScreenshots(guest.page);
    await guestPlay(guest.page);
    assert(pageErrorsFor(guest.page).length === 0, "the guest builder has no page errors");
    await signedInSave(browser);
    console.log(`[visual] screenshots written to ${VERIFY_DIR}`);
  },
  [guest.page],
  {
    cleanup: async () => {
      await guest.context.close().catch(() => {});
      await browser.close().catch(() => {});
    },
  },
);
