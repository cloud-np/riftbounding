/**
 * Multiplayer end-to-end: atlas hosts, a guest joins by code. Each browser controls
 * only its own seat through every setup prompt, then both play a card, chat both
 * ways, request/approve a rewind and leave the match.
 *
 * Run: node apps/play/e2e/multiplayer.mjs
 */
import {
  assert,
  completeMultiplayerSetup,
  continueAsGuest,
  controlledPlayerIds,
  handCounts,
  hostRoom,
  importDeck,
  joinRoom,
  launchBrowser,
  leaveRoomViaActionRail,
  matchLogText,
  newPage,
  phase,
  playUnitFromHandToBase,
  readyUp,
  requestRewind,
  run,
  screenshot,
  sendChat,
  signInAccount,
  startMatch,
  step,
  viewerId,
  waitFor,
  waitForChatMessage,
  waitForGame,
  zoneCards,
} from "./lib.mjs";

const browser = await launchBrowser();
const host = await newPage(browser, "mp-host");
const guest = await newPage(browser, "mp-guest");
const guestName = "E2E Guest B18";

const cleanup = async () => {
  await host.context.close().catch(() => {});
  await guest.context.close().catch(() => {});
  await browser.close().catch(() => {});
};

const failures = [];
async function attempt(label, fn) {
  try {
    await fn();
  } catch (error) {
    failures.push(`${label}: ${error instanceof Error ? error.message : String(error)}`);
    console.error(
      `[mp] ${label} FAILED: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

await run(
  "multiplayer",
  async () => {
    step("mp", "sign in host (atlas) and guest, import the fixture deck");
    await signInAccount(host.page, "atlas", "1234");
    await continueAsGuest(guest.page, guestName);
    await importDeck(host.page);
    await importDeck(guest.page);

    step("mp", "host creates a private room");
    const roomCode = await hostRoom(host.page);
    assert(/^[A-Z0-9]{4,10}$/.test(roomCode), `host room code looks valid (${roomCode})`);

    step("mp", `guest joins room ${roomCode}`);
    await joinRoom(guest.page, roomCode);
    await host.page.getByText(guestName, { exact: false }).first().waitFor({
      state: "visible",
      timeout: 30_000,
    });

    step("mp", "both players ready up");
    await readyUp(host.page);
    await readyUp(guest.page);

    step("mp", "host starts the match");
    await startMatch(host.page, { timeout: 60_000 });
    await Promise.all([waitForGame(host.page, 90_000), waitForGame(guest.page, 90_000)]);
    assert(host.page.url().includes(`room=${roomCode}`), "host URL carries the room code");
    assert(guest.page.url().includes(`room=${roomCode}`), "guest URL carries the room code");

    step("mp", "complete setup with each browser controlling only its own seat");
    await completeMultiplayerSetup(
      [
        { label: "mp/host", page: host.page },
        { label: "mp/guest", page: guest.page },
      ],
      { timeout: 240_000 },
    );
    assert((await phase(host.page)) === "in_game", "host reached in_game");
    assert((await phase(guest.page)) === "in_game", "guest reached in_game");

    const hostViewer = await viewerId(host.page);
    const guestViewer = await viewerId(guest.page);
    assert(
      hostViewer !== guestViewer,
      `host and guest are different seats (${hostViewer} vs ${guestViewer})`,
    );
    const hostSeats = await controlledPlayerIds(host.page);
    const guestSeats = await controlledPlayerIds(guest.page);
    assert(
      hostSeats.length === 1 && hostSeats[0] === hostViewer,
      "host controls exactly its own seat",
    );
    assert(
      guestSeats.length === 1 && guestSeats[0] === guestViewer,
      "guest controls exactly its own seat",
    );
    step("mp", `seats host=${hostViewer} guest=${guestViewer}`);

    const beforeHostPlay = await handCounts(host.page);
    const beforeGuestPlay = await handCounts(guest.page);

    step("mp", "host plays a unit from hand to base");
    const hostUnit = await playUnitFromHandToBase(host.page, { label: "mp/host" });
    await waitFor(async () => (await matchLogText(guest.page)).includes(hostUnit.name), {
      label: `guest to see host's ${hostUnit.name} in the public match log`,
      timeout: 20_000,
    });
    await waitFor(
      async () =>
        (await handCounts(guest.page)).join(",") === (await handCounts(host.page)).join(","),
      { label: "guest to receive the host's public hand counts", timeout: 20_000 },
    );
    await waitFor(
      async () =>
        (await zoneCards(guest.page, "base", "opponent")).some(
          (card) => card.name === hostUnit.name,
        ),
      { label: `guest to see ${hostUnit.name} on the opponent base`, timeout: 20_000 },
    );
    step("mp", `guest sees host play ${hostUnit.name} on the board`);

    step("mp", "guest plays a unit from hand to base");
    const guestUnit = await playUnitFromHandToBase(guest.page, { label: "mp/guest" });
    await waitFor(async () => (await matchLogText(host.page)).includes(guestUnit.name), {
      label: `host to see guest's ${guestUnit.name} in the public match log`,
      timeout: 20_000,
    });
    await waitFor(
      async () =>
        (await handCounts(host.page)).join(",") === (await handCounts(guest.page)).join(","),
      { label: "host to receive the guest's public hand counts", timeout: 20_000 },
    );
    await waitFor(
      async () =>
        (await zoneCards(host.page, "base", "opponent")).some(
          (card) => card.name === guestUnit.name,
        ),
      { label: `host to see ${guestUnit.name} on the opponent base`, timeout: 20_000 },
    );
    step("mp", `host sees guest play ${guestUnit.name} on the board`);

    const hostLog = await matchLogText(host.page);
    const guestLog = await matchLogText(guest.page);
    assert(hostLog.includes(guestUnit.name), "host's match log contains the guest's card");
    assert(guestLog.includes(hostUnit.name), "guest's match log contains the host's card");

    await attempt("chat host → guest", async () => {
      step("mp", "host sends a chat message");
      const message = `hello guest ${Date.now()}`;
      await sendChat(host.page, message, { label: "mp/host" });
      await waitForChatMessage(guest.page, message, { label: "mp/guest" });
      step("mp", "guest sees the host's chat message");
    });

    await attempt("chat guest → host", async () => {
      step("mp", "guest sends a chat message");
      const message = `hello host ${Date.now()}`;
      await sendChat(guest.page, message, { label: "mp/guest" });
      await waitForChatMessage(host.page, message, { label: "mp/host" });
      step("mp", "host sees the guest's chat message");
    });

    await attempt("rewind request/approve", async () => {
      step("mp", "host requests a rewind of its last action");
      await requestRewind(host.page, { label: "mp/host" });
      await host.page
        .getByTestId("rewind-confirmation")
        .waitFor({ state: "visible", timeout: 15_000 });
      await waitFor(
        async () =>
          (await guest.page
            .getByTestId("rewind-confirmation")
            .getAttribute("data-rewind-confirmation")
            .catch(() => null)) === "approver",
        { label: "guest to receive the rewind approval prompt", timeout: 20_000 },
      );
      step("mp", "guest approves the rewind");
      await guest.page.getByTestId("rewind-approve").click();
      await waitFor(
        async () =>
          (await host.page.getByTestId("rewind-confirmation").count()) === 0 &&
          (await guest.page.getByTestId("rewind-confirmation").count()) === 0,
        { label: "rewind confirmation to clear on both clients", timeout: 20_000 },
      );
      await waitFor(
        async () =>
          (await handCounts(host.page)).join(",") === beforeHostPlay.join(",") &&
          (await handCounts(guest.page)).join(",") === beforeGuestPlay.join(","),
        { label: "both hands to revert to their pre-action counts", timeout: 20_000 },
      );
      step(
        "mp",
        `rewind restored hands host=${beforeHostPlay.join(",")} guest=${beforeGuestPlay.join(",")}`,
      );
    });

    await screenshot(host.page, "multiplayer-host-game.png");
    await screenshot(guest.page, "multiplayer-guest-game.png");

    await attempt("host leaves and guest observes the result", async () => {
      step("mp", "host leaves the room from the board action rail");
      await leaveRoomViaActionRail(host.page, { label: "mp/host" });
      const gameOver = guest.page.getByTestId("game-over-overlay");
      await gameOver.waitFor({ state: "visible", timeout: 30_000 }).catch(async () => {
        // Some builds surface the departure banner instead of the outcome sheet.
        await guest.page
          .getByTestId("opponent-left-overlay")
          .waitFor({ state: "visible", timeout: 5_000 });
      });
      if (await guest.page.getByTestId("game-over-overlay").count()) {
        assert(
          (await guest.page.getByTestId("game-over-overlay").getAttribute("data-game-outcome")) ===
            "concession",
          "guest sees a concession result",
        );
        assert(
          (await guest.page
            .getByTestId("game-over-overlay")
            .getAttribute("data-game-outcome-win")) === "true",
          "guest is the winner of the concession",
        );
      }
      step("mp", "guest observed the host leaving and the concession result");
    });

    if (failures.length > 0) {
      throw new Error(
        `${failures.length} multiplayer check(s) failed:\n- ${failures.join("\n- ")}`,
      );
    }

    console.log(
      `[mp] PASS room=${roomCode} host=${hostViewer} guest=${guestViewer} hostCard=${hostUnit.name} guestCard=${guestUnit.name}`,
    );
  },
  [host.page, guest.page],
  { cleanup, labels: ["mp-host", "mp-guest"] },
);
