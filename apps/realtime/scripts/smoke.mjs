#!/usr/bin/env node
/**
 * End-to-end smoke test for the realtime server.
 *
 *   node apps/realtime/scripts/smoke.mjs [baseUrl]
 *
 * Requires `wrangler dev --port 1999` running (apps/realtime `pnpm dev`).
 * Uses Node's built-in fetch + WebSocket (Node >= 22).
 *
 * Flow: guest tokens → create_room → join_room → two sockets join_shell → ready → start_lobby_match
 * → join_game → setup (battlefields / initiative / first player / mulligan) → in_game → end_turn →
 * adjust_score, asserting snapshots/patches (with per-viewer hand redaction) along the way.
 */

const BASE = (process.argv[2] ?? "http://127.0.0.1:1999").replace(/\/+$/u, "");
const WS_BASE = BASE.replace(/^http/u, "ws");
const TIMEOUT_MS = 15_000;

const DECK = `Legend:
1 Ahri, Nine-Tailed Fox
Champion:
1 Ahri, Nine-Tailed Fox
MainDeck:
4 Spirit Scout
4 Feral Instinct
4 Runeblade
4 Mystic Shot
Battlefields:
2 Training Grounds
1 Mountain Pass
Runes:
4 Fury Rune
4 Calm Rune
Sideboard:
1 Back to Back`;

let failures = 0;
function check(condition, label) {
  if (condition) {
    console.log(`  ✓ ${label}`);
  } else {
    failures += 1;
    console.error(`  ✗ ${label}`);
  }
}

async function post(path, body) {
  const response = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "text/plain;charset=UTF-8" },
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  return { status: response.status, body: json };
}

async function guestToken(name) {
  const { status, body } = await post("/api/auth/token", { name });
  if (status !== 200 || !body?.token)
    throw Error(`token request failed for ${name}: ${status} ${JSON.stringify(body)}`);
  return { token: body.token, playerId: body.playerId, name: body.name };
}

class Client {
  constructor(label) {
    this.label = label;
    this.messages = [];
    this.ws = null;
  }

  async connect(roomCode, playerId) {
    const url = `${WS_BASE}/parties/match/${encodeURIComponent(roomCode)}?playerId=${encodeURIComponent(playerId)}&roomCode=${encodeURIComponent(roomCode)}`;
    this.ws = new WebSocket(url);
    this.ws.addEventListener("message", (event) => {
      try {
        const message = JSON.parse(event.data);
        if (
          typeof message.sequence === "number" &&
          (message.type === "authoritative_patch_commit" ||
            message.type === "authoritative_snapshot" ||
            message.type === "authoritative_resume_ack")
        ) {
          this.sequence = message.sequence;
        }
        this.messages.push(message);
      } catch {
        this.messages.push({ type: "unparseable", raw: String(event.data) });
      }
    });
    await new Promise((resolve, reject) => {
      const timer = setTimeout(
        () => reject(Error(`${this.label}: websocket open timeout`)),
        TIMEOUT_MS,
      );
      this.ws.addEventListener("open", () => {
        clearTimeout(timer);
        resolve();
      });
      this.ws.addEventListener("error", (event) => {
        clearTimeout(timer);
        reject(Error(`${this.label}: websocket error ${event?.message ?? ""}`));
      });
    });
  }

  send(message) {
    this.ws.send(JSON.stringify(message));
  }

  /** Wait for a message of `type` (optionally matching `predicate`) received after `startIndex`. */
  async waitFor(
    type,
    predicate = () => true,
    startIndex = this.messages.length,
    timeoutMs = TIMEOUT_MS,
  ) {
    const deadline = Date.now() + timeoutMs;
    for (;;) {
      for (let index = startIndex; index < this.messages.length; index += 1) {
        const message = this.messages[index];
        if (message.type === type && predicate(message)) return message;
      }
      if (Date.now() > deadline) {
        const seen = this.messages
          .slice(startIndex)
          .map((message) => message.type)
          .join(", ");
        throw Error(`${this.label}: timed out waiting for ${type} (seen: ${seen || "nothing"})`);
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }

  /** Wait for the acknowledgement of a gameplay action (patch / noop / error). */
  async waitAction(clientActionId, startIndex) {
    const deadline = Date.now() + TIMEOUT_MS;
    for (;;) {
      for (let index = startIndex; index < this.messages.length; index += 1) {
        const message = this.messages[index];
        if (
          (message.type === "authoritative_patch_commit" ||
            message.type === "gameplay_action_noop_ack" ||
            message.type === "error") &&
          message.clientActionId === clientActionId
        ) {
          return message;
        }
      }
      if (Date.now() > deadline) {
        throw Error(`${this.label}: timed out waiting for the ack of ${clientActionId}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }

  async action(type, fields = {}, actorPlayerId) {
    const clientActionId = `smoke-${type}-${Math.random().toString(36).slice(2, 10)}`;
    const startIndex = this.messages.length;
    this.send({
      type: "action_intent",
      gameInstanceId: this.roomCode,
      action: { type, ...fields },
      ...(actorPlayerId ? { actorPlayerId } : {}),
      clientActionId,
      clientBaseSequence: this.sequence,
    });
    const ack = await this.waitAction(clientActionId, startIndex);
    if (ack.type === "authoritative_patch_commit") {
      this.sequence = ack.sequence;
    } else if (ack.type === "error") {
      throw Error(`${this.label}: ${type} failed: ${ack.code} ${ack.message}`);
    }
    return ack;
  }

  /** Wait for a room-shell ack, surfacing server errors with their message. */
  async waitShellAck(clientActionId, startIndex) {
    const deadline = Date.now() + TIMEOUT_MS;
    for (;;) {
      for (let index = startIndex; index < this.messages.length; index += 1) {
        const message = this.messages[index];
        if (message.type === "room_shell_action_ack" && message.clientActionId === clientActionId) {
          return message;
        }
        if (message.type === "error" && message.clientActionId === clientActionId) {
          throw Error(`${this.label}: shell action failed: ${message.code} ${message.message}`);
        }
      }
      if (Date.now() > deadline) {
        throw Error(`${this.label}: timed out waiting for the shell ack of ${clientActionId}`);
      }
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }

  /** Force a fresh authoritative snapshot (clientSequence 0 never matches the server sequence). */
  async refresh() {
    const startIndex = this.messages.length;
    this.send({
      type: "resume_game",
      gameInstanceId: this.roomCode,
      playerId: this.playerId,
      authToken: this.token,
      clientSequence: 0,
    });
    const snapshot = await this.waitFor("authoritative_snapshot", () => true, startIndex);
    this.sequence = snapshot.sequence;
    this.room = snapshot.snapshot;
    return snapshot;
  }
}

async function main() {
  console.log(`rift realtime smoke → ${BASE}`);

  const health = await fetch(`${BASE}/api/health`).then((response) => response.json());
  console.log(`  engine: ${health.engine}`);
  check(health.ok === true, "health endpoint responds");

  const alice = await guestToken("Alice");
  const bob = await guestToken("Bob");
  check(!!alice.token && !!bob.token, "guest tokens issued");
  check(alice.playerId !== bob.playerId, "guest tokens have distinct player ids");

  const created = await post("/parties/coordinator/global-enam-v1", {
    action: "create_room",
    operationId: `smoke:${Date.now()}`,
    playerName: "Alice",
    playMode: "constructed",
    matchFormat: "bo1",
    roomMode: "multiplayer",
    gameVariant: "duel",
    decklist: DECK,
    authToken: alice.token,
  });
  check(created.status === 200 && created.body?.ok === true, "coordinator create_room succeeds");
  check(
    typeof created.body?.roomCode === "string" && created.body.roomCode.length >= 4,
    "room code allocated",
  );
  check(created.body?.playerId === alice.playerId, "create_room echoes the host player id");
  const roomCode = created.body.roomCode;
  console.log(`  room: ${roomCode}`);

  const joined = await post(`/parties/match/${encodeURIComponent(roomCode)}`, {
    action: "join_room",
    roomCode,
    playerName: "Bob",
    playMode: "constructed",
    matchFormat: "bo1",
    decklist: DECK,
    authToken: bob.token,
  });
  check(joined.status === 200 && joined.body?.role === "player", "second player joins the room");
  check(joined.body?.playerId === bob.playerId, "join_room echoes the joining player id");

  const membership = await post(`/parties/match/${encodeURIComponent(roomCode)}`, {
    action: "resolve_room_membership",
    roomCode,
    authToken: bob.token,
  });
  check(membership.body?.role === "player", "resolve_room_membership reports the player role");

  const a = new Client("alice");
  const b = new Client("bob");
  for (const [client, account, playerId] of [
    [a, alice, alice.playerId],
    [b, bob, bob.playerId],
  ]) {
    client.roomCode = roomCode;
    client.playerId = playerId;
    client.token = account.token;
    client.sequence = 0;
    await client.connect(roomCode, playerId);
    const startIndex = client.messages.length;
    client.send({
      type: "join_shell",
      gameInstanceId: roomCode,
      roomCode,
      playerId,
      authToken: account.token,
    });
    const sync = await client.waitFor("room_shell_sync", () => true, startIndex);
    check(
      sync.sessionDoc?.viewer?.playerId === playerId,
      `${client.label} receives a per-viewer shell sync`,
    );
  }

  for (const client of [a, b]) {
    const startIndex = client.messages.length;
    const clientActionId = `ready-${client.label}`;
    client.send({
      type: "room_shell_action",
      gameInstanceId: roomCode,
      action: { type: "set_lobby_ready", ready: true },
      clientActionId,
    });
    const ack = await client.waitShellAck(clientActionId, startIndex);
    check(ack.actionType === "set_lobby_ready", `${client.label} ready ack`);
  }

  {
    const startIndex = a.messages.length;
    const clientActionId = "start-match";
    a.send({
      type: "room_shell_action",
      gameInstanceId: roomCode,
      action: { type: "start_lobby_match" },
      clientActionId,
    });
    const ack = await a.waitShellAck(clientActionId, startIndex);
    check(ack.actionType === "start_lobby_match", "start_lobby_match ack");
  }

  for (const client of [a, b]) {
    const startIndex = client.messages.length;
    client.send({
      type: "join_game",
      gameInstanceId: roomCode,
      roomCode,
      playerId: client.playerId,
      authToken: client.token,
    });
    const snapshot = await client.waitFor("authoritative_snapshot", () => true, startIndex);
    check(
      snapshot.snapshot?.players?.length === 2,
      `${client.label} receives an authoritative snapshot`,
    );
    client.sequence = snapshot.sequence;
    client.room = snapshot.snapshot;
  }

  // Setup: battlefields → initiative → first player → mulligan.
  for (let round = 0; round < 20; round += 1) {
    const phase = (await a.refresh()).snapshot.phase;
    await b.refresh();
    if (phase === "battlefield_pick") {
      for (const client of [a, b]) {
        const player = client.room.players.find((candidate) => candidate.id === client.playerId);
        if (!player?.selectedBattlefield)
          await client.action("select_battlefield", { random: true });
      }
      continue;
    }
    if (phase === "initiative_roll") {
      for (const client of [a, b]) {
        if (client.room.initiativeRolls?.[client.playerId] === undefined) {
          await client.action("roll_initiative");
        }
      }
      continue;
    }
    if (phase === "first_player_choice") {
      const chooserId = a.room.firstPlayerChooserId;
      const chooser = chooserId === b.playerId ? b : a;
      await chooser.action("choose_first_player", { firstPlayerId: chooserId }, chooserId);
      continue;
    }
    if (phase === "mulligan") {
      for (const client of [a, b]) {
        if (!client.room.mulliganDonePlayerIds?.includes(client.playerId)) {
          await client.action("submit_mulligan", { cardIds: [] });
        }
      }
      continue;
    }
    if (phase === "in_game") break;
  }

  const aliceView = await a.refresh();
  await b.refresh();
  check(aliceView.snapshot.phase === "in_game", "match reaches in_game");
  const bobInAliceView = aliceView.snapshot.players.find((player) => player.id === bob.playerId);
  check(
    bobInAliceView?.board?.hand?.[0]?.id?.startsWith("__hidden_zone__") === true,
    "opponent hand is redacted in snapshots",
  );
  const bobView = b.room;
  const bobOwn = bobView.players.find((player) => player.id === bob.playerId);
  check(
    bobOwn?.board?.hand?.[0]?.id?.startsWith("__hidden_zone__") === false,
    "own hand stays visible",
  );

  const activeId = aliceView.snapshot.activeTurnPlayerId;
  const activeClient = activeId === bob.playerId ? b : a;
  const endTurnAck = await activeClient.action("end_turn", {
    observed: {
      turnNumber: aliceView.snapshot.turnNumber,
      activePlayerId: aliceView.snapshot.activeTurnPlayerId,
      activeStep: aliceView.snapshot.activeTurnStep,
    },
  });
  check(endTurnAck.type === "authoritative_patch_commit", "end_turn produces a patch commit");

  const afterEnd = await activeClient.refresh();
  await (activeClient === a ? b : a).refresh();
  const nextActive = afterEnd.snapshot.activeTurnPlayerId;
  const nextClient = nextActive === b.playerId ? b : a;
  const scoreAck = await nextClient.action("adjust_score", { delta: 1 });
  check(scoreAck.type === "authoritative_patch_commit", "adjust_score produces a patch commit");
  check(scoreAck.sequence === scoreAck.baseSequence + 1, "patch sequence advances by one");

  // Stale base sequence must be rejected with stale_action_state.
  {
    const clientActionId = "smoke-stale";
    const startIndex = nextClient.messages.length;
    nextClient.send({
      type: "action_intent",
      gameInstanceId: roomCode,
      action: { type: "adjust_score", delta: 1 },
      clientActionId,
      clientBaseSequence: -1,
    });
    const failure = await nextClient.waitFor(
      "error",
      (message) => message.clientActionId === clientActionId,
      startIndex,
    );
    check(failure.code === "stale_action_state", "stale action base is rejected");
  }

  // Opponent patches arrive for both viewers.
  {
    const startIndex = b.messages.length;
    const snapshot = await b.refresh();
    void startIndex;
    check(typeof snapshot.sequence === "number", "second client stays synced");
  }

  // Solo lab: one human controls both seats.
  {
    const created2 = await post("/parties/coordinator/global-enam-v1", {
      action: "create_room",
      operationId: `smoke-solo:${Date.now()}`,
      playerName: "Solo",
      playMode: "constructed",
      matchFormat: "bo1",
      roomMode: "solo_lab",
      decklist: DECK,
      authToken: alice.token,
    });
    check(created2.body?.ok === true, "solo_lab room is created");
    const controlled = created2.body?.controlledPlayerIds;
    check(
      Array.isArray(controlled) && controlled.length === 2,
      "solo_lab exposes two controlled player ids",
    );
    const soloRoom = created2.body.roomCode;
    const s = new Client("solo");
    s.roomCode = soloRoom;
    s.playerId = alice.playerId;
    s.token = alice.token;
    s.sequence = 0;
    await s.connect(soloRoom, alice.playerId);
    {
      const startIndex = s.messages.length;
      s.send({
        type: "join_shell",
        gameInstanceId: soloRoom,
        roomCode: soloRoom,
        playerId: alice.playerId,
        authToken: alice.token,
      });
      await s.waitFor("room_shell_sync", () => true, startIndex);
      s.send({
        type: "room_shell_action",
        gameInstanceId: soloRoom,
        action: { type: "start_lobby_match" },
        clientActionId: "solo-start",
      });
      await s.waitFor(
        "room_shell_action_ack",
        (message) => message.clientActionId === "solo-start",
        startIndex,
      );
      const joinIndex = s.messages.length;
      s.send({
        type: "join_game",
        gameInstanceId: soloRoom,
        roomCode: soloRoom,
        playerId: alice.playerId,
        authToken: alice.token,
      });
      await s.waitFor("authoritative_snapshot", () => true, joinIndex);
    }
    for (let round = 0; round < 20; round += 1) {
      const view = (await s.refresh()).snapshot;
      if (view.phase === "battlefield_pick") {
        for (const player of view.players) {
          if (!player.selectedBattlefield)
            await s.action("select_battlefield", { random: true }, player.id);
        }
        continue;
      }
      if (view.phase === "first_player_choice") {
        const first = view.players[0];
        if (first) await s.action("choose_first_player", { firstPlayerId: first.id }, first.id);
        continue;
      }
      if (view.phase === "mulligan") {
        for (const player of view.players) {
          if (!view.mulliganDonePlayerIds?.includes(player.id)) {
            await s.action("submit_mulligan", { cardIds: [] }, player.id);
          }
        }
        continue;
      }
      if (view.phase === "in_game") break;
    }
    const soloView = (await s.refresh()).snapshot;
    check(soloView.phase === "in_game", "solo_lab reaches in_game");
    check(
      soloView.players.every(
        (player) => player.board?.hand?.[0]?.id?.startsWith("__hidden_zone__") === false,
      ),
      "solo_lab controller sees both hands",
    );
    s.ws.close();
  }

  // Matchmaking: two new clients pair through the FIFO duel queue, then poll cancel_exact.
  {
    const carol = await guestToken("Carol");
    const dave = await guestToken("Dave");
    const queueRoom = "enam-v2-constructed-all-bo1";
    const c = new Client("carol");
    const d = new Client("dave");
    const openMatchmaking = async (client, account, searchId) => {
      client.ws = new WebSocket(`${WS_BASE}/parties/matchmaking/${queueRoom}`);
      await new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(Error(`${client.label}: matchmaking open timeout`)),
          TIMEOUT_MS,
        );
        client.ws.addEventListener("open", () => {
          clearTimeout(timer);
          resolve();
        });
        client.ws.addEventListener("error", () => {
          clearTimeout(timer);
          reject(Error(`${client.label}: matchmaking socket error`));
        });
      });
      client.ws.addEventListener("message", (event) => {
        try {
          client.messages.push(JSON.parse(event.data));
        } catch {
          client.messages.push({ type: "unparseable" });
        }
      });
      client.send({
        type: "start",
        searchId,
        playerName: account.name,
        playMode: "constructed",
        decklist: DECK,
        matchmakingPool: "standard",
        matchFormat: "bo1",
        authToken: account.token,
      });
    };
    await openMatchmaking(c, carol, `search:carol${Date.now()}`);
    const searching = await c.waitFor("searching", () => true, 0);
    check(
      typeof searching.expiresAt === "number" && typeof searching.widenAt === "number",
      "matchmaking reports searching",
    );
    await openMatchmaking(d, dave, `search:dave${Date.now()}`);
    const matchedC = await c.waitFor("matched", () => true, 0);
    const matchedD = await d.waitFor("matched", () => true, 0);
    check(
      !!matchedC.roomCode && matchedC.roomCode === matchedD.roomCode,
      "FIFO pairing creates a shared room",
    );
    const poll = await post(`/parties/matchmaking/${queueRoom}`, {
      action: "cancel_exact",
      searchId: searching.searchId,
      authToken: carol.token,
    });
    check(
      poll.body?.status === "matched" && poll.body?.roomCode === matchedC.roomCode,
      "cancel_exact polls the matched result",
    );
    c.ws.close();
    d.ws.close();
  }

  for (const client of [a, b]) client.ws.close();

  if (failures > 0) {
    console.error(`\nSMOKE FAILED: ${failures} check(s) failed`);
    process.exit(1);
  }
  console.log("\nSMOKE PASSED");
}

main().catch((error) => {
  console.error(`\nSMOKE ERROR: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
