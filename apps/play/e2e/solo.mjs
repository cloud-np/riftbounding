/**
 * Solo end-to-end: account sign-in → deck import → Solo Room → setup by clicking →
 * play a unit from hand to base → move it to a battlefield → end turn → chat →
 * settings. Then the same lobby/setup/play path as a guest.
 *
 * Run: node apps/play/e2e/solo.mjs
 */
import {
  assert,
  completeSetup,
  continueAsGuest,
  controlledPlayerIds,
  createSoloRoom,
  endTurn,
  handCounts,
  importDeck,
  launchBrowser,
  matchLogEntryCount,
  matchLogText,
  moveBaseUnitToBattlefield,
  newPage,
  openSettings,
  phase,
  playUnitFromHandToBase,
  run,
  screenshot,
  sendChat,
  signInAccount,
  startMatch,
  step,
  turnNumber,
  viewerId,
  waitFor,
  waitForGame,
} from "./lib.mjs";

const browser = await launchBrowser();
const account = await newPage(browser, "solo-account");
const guest = await newPage(browser, "solo-guest");

const cleanup = async () => {
  await account.context.close().catch(() => {});
  await guest.context.close().catch(() => {});
  await browser.close().catch(() => {});
};

async function soloRun(label, page, { signIn }) {
  step(label, "sign in and import the fixture deck");
  await signIn();
  await importDeck(page);

  step(label, "create a Solo Room from the lobby");
  const roomCode = await createSoloRoom(page);
  step(label, `room ${roomCode}`);

  step(label, "start the match");
  await startMatch(page);
  await waitForGame(page);

  step(label, "complete setup by clicking the real overlays");
  await completeSetup(page, { label, twoSeats: true, timeout: 180_000 });
  await waitFor(async () => (await phase(page)) === "in_game", {
    label: `${label}: in_game`,
  });
  assert((await phase(page)) === "in_game", "setup finished in_game");

  const seats = await controlledPlayerIds(page);
  assert(seats.length === 2, `the solo client controls both seats (${seats.join(",")})`);
  const view = await viewerId(page);
  assert(seats.includes(view), `viewer ${view} is one of the controlled seats`);

  await waitFor(async () => (await handCounts(page)).some((count) => count > 0), {
    label: `${label}: a hand is dealt`,
  });
  const initialCounts = await handCounts(page);
  assert(
    initialCounts.length === 2,
    `two public hand counts are visible (${initialCounts.join(",")})`,
  );
  const startTurn = await turnNumber(page);
  assert(startTurn === 1, `the match starts on turn 1 (data-turn=${startTurn})`);

  step(label, "play a unit from hand to base with a real drag");
  const unit = await playUnitFromHandToBase(page, { label });
  const logAfterPlay = await matchLogText(page);
  assert(logAfterPlay.includes(unit.name), `the match log records playing ${unit.name}`);
  const entriesAfterPlay = await matchLogEntryCount(page);
  assert(entriesAfterPlay > 0, "the match log has entries after playing a card");

  step(label, "move the unit from base to the battlefield");
  await moveBaseUnitToBattlefield(page, unit.name, { label });
  const logAfterMove = await matchLogText(page);
  assert(
    logAfterMove.includes(unit.name) && /battlefield/i.test(logAfterMove),
    "the match log records the move to a battlefield",
  );
  assert(
    (await matchLogEntryCount(page)) > entriesAfterPlay,
    "the match log advanced after the move",
  );

  step(label, "end the turn");
  const turn = await endTurn(page);
  assert(
    turn.afterTurn > turn.beforeTurn,
    `turn counter advanced (${turn.beforeTurn} → ${turn.afterTurn})`,
  );
  assert(turn.afterGroups > turn.beforeGroups, "a new match-log turn group appeared");
  assert((await phase(page)) === "in_game", "the game stays in_game after ending the turn");

  step(label, "send a chat message");
  await sendChat(page, `solo hello ${Date.now()}`, { label });

  step(label, "open game settings");
  await openSettings(page, { label });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);

  await screenshot(page, `${label}-game.png`);

  return { roomCode, unit: unit.name, turn };
}

await run(
  "solo",
  async () => {
    const accountRun = await soloRun("solo/account", account.page, {
      signIn: () => signInAccount(account.page, "atlas", "1234"),
    });
    console.log(
      `[solo/account] room=${accountRun.roomCode} unit=${accountRun.unit} turns=${accountRun.turn.beforeTurn}->${accountRun.turn.afterTurn}`,
    );

    const guestRun = await soloRun("solo/guest", guest.page, {
      signIn: () => continueAsGuest(guest.page, "Solo Guest B18"),
    });
    console.log(`[solo/guest] room=${guestRun.roomCode} unit=${guestRun.unit}`);
  },
  [account.page, guest.page],
  { cleanup, labels: ["solo/account", "solo/guest"] },
);
