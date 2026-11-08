"use client";

import { useCallback, useMemo, useRef, useState } from "react";

import type { EngineResult } from "@rift/engine";
import { applyGameAction, createInitialTimeline } from "@rift/engine";
import { getCardByName } from "@rift/cards";
import type { GameState, Room, RoomPlayer } from "@rift/protocol";

import type { GameBoardLayoutHints } from "@/components/board/layout/GameBoardView";
import { GameBoardView } from "@/components/board/layout/GameBoardView";
import type { BattlefieldInfo } from "@/components/board/layout/BattlefieldLayer";
import { ChainSlot } from "@/components/board/chain";
import { BoardInteractionProvider, HandSlot } from "@/components/board/interaction";
import { OverlaysSlot, PromptsSlot } from "@/components/board/prompts";
import type { GameActionIntent, BoardSlotProps, Dispatch } from "@/components/board/slot-types";
import { SidebarSlot } from "@/components/board/sidebar";

import {
  boardMode,
  createHarnessState,
  createSeededRng,
  DEV_PLAYER_IDS,
  type HarnessState,
} from "./localGame";

export interface LocalGameHarnessProps {
  fixture?: string | null;
  seed?: string | number | null;
  viewer?: string | null;
}

interface IntentRecord {
  id: number;
  at: number;
  type: string;
  actorId: string;
  ok: boolean;
  changed: boolean;
  error?: string;
  errorCode?: string;
}

/** Setup actions need to be dispatched for more than one seat in a local two-seat lab. */
const SETUP_ACTIONS = new Set<string>([
  "select_battlefield",
  "submit_mulligan",
  "roll_initiative",
  "choose_first_player",
  "choose_single_player_turn_order",
  "submit_sideboard",
  "request_sideboard_skip",
  "respond_sideboard_skip",
  "confirm_solo_setup",
  "auto_start_test_setup",
]);

const ACTIVE_PLAYER_ACTIONS = new Set<string>(["end_turn", "end_beginning_phase"]);

function uniqueIds(...groups: string[][]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const group of groups) {
    for (const id of group) {
      if (seen.has(id)) continue;
      seen.add(id);
      out.push(id);
    }
  }
  return out;
}

function seatedPlayerIds(room: Room): string[] {
  return room.players
    .filter((player) => !!player.board && !player.leftAt)
    .map((player) => player.id);
}

function setupActorOrder(intent: GameActionIntent, room: Room, viewerId: string): string[] {
  const seated = seatedPlayerIds(room);
  const rest = seated.filter((id) => id !== viewerId);
  const notSeated = (ids: string[]) => ids.filter((id) => seated.includes(id));

  switch (intent.type) {
    case "auto_start_test_setup": {
      const host =
        room.hostPlayerId && seated.includes(room.hostPlayerId) ? room.hostPlayerId : viewerId;
      return uniqueIds([host], [viewerId], rest);
    }
    case "select_battlefield": {
      const pending = room.players
        .filter((player) => seated.includes(player.id) && !player.selectedBattlefield)
        .map((player) => player.id);
      return uniqueIds(notSeated(pending), [viewerId], rest);
    }
    case "submit_mulligan": {
      const done = new Set(room.mulliganDonePlayerIds ?? []);
      const pending = seated.filter((id) => !done.has(id));
      return uniqueIds(notSeated(pending), [viewerId], rest);
    }
    case "roll_initiative": {
      const rolled = new Set(Object.keys(room.initiativeRolls ?? {}));
      const pending = seated.filter((id) => !rolled.has(id));
      return uniqueIds(notSeated(pending), [viewerId], rest);
    }
    case "submit_sideboard": {
      const done = new Set(room.sideboardDonePlayerIds ?? []);
      const pending = seated.filter((id) => !done.has(id));
      return uniqueIds(notSeated(pending), [viewerId], rest);
    }
    case "choose_first_player": {
      const chooser = room.firstPlayerChooserId;
      return uniqueIds(chooser ? [chooser] : [], [viewerId], rest);
    }
    default:
      return uniqueIds([viewerId], rest);
  }
}

function gameActor(intent: GameActionIntent, room: Room, viewerId: string): string {
  if (ACTIVE_PLAYER_ACTIONS.has(intent.type) && room.activeTurnPlayerId) {
    return room.activeTurnPlayerId;
  }
  return viewerId;
}

function battlefieldHint(
  player: RoomPlayer | undefined,
  zone: "battlefieldA" | "battlefieldB",
): BattlefieldInfo | undefined {
  if (!player) return undefined;
  const selected = player.selectedBattlefield?.trim();
  const preview = selected || player.battlefieldOptions?.[0]?.trim();
  if (!preview) return undefined;
  const cardCode = selected ? player.selectedBattlefieldCardCode : getCardByName(preview)?.id;
  return {
    zone,
    name: preview,
    ...(cardCode ? { cardCode } : {}),
  };
}

function buildLayoutHints(
  harness: HarnessState,
  state: GameState,
  viewerId: string,
): GameBoardLayoutHints {
  const viewer = state.players.find((player) => player.id === viewerId) ?? state.players[0]!;
  const opponent = state.players.find((player) => player.id !== viewer.id);
  const base = harness.baseHints;
  const viewerMoved = harness.fixture != null && harness.fixture.viewerId !== viewerId;
  const baseBattlefields = base.battlefields;
  const battlefields = baseBattlefields
    ? viewerMoved
      ? {
          ...baseBattlefields,
          own: baseBattlefields.opponent,
          opponent: baseBattlefields.own,
        }
      : baseBattlefields
    : {
        own: battlefieldHint(viewer, "battlefieldA"),
        opponent: battlefieldHint(opponent, "battlefieldB"),
      };
  return {
    ...base,
    boardLines: base.boardLines ?? "default",
    showScoreTrack: base.showScoreTrack ?? true,
    showTurnControls: base.showTurnControls ?? state.phase === "in_game",
    canEndTurn: base.canEndTurn ?? state.phase === "in_game",
    canSwitchSeat: base.canSwitchSeat ?? true,
    phase: base.phase ?? (state.activeTurnStep === "beginning" ? "beginning" : "main"),
    activeTurnSide: state.activeTurnPlayerId === viewer.id ? "self" : "opponent",
    battlefields,
  };
}

export function LocalGameHarness({ fixture, seed, viewer }: LocalGameHarnessProps) {
  const [harness] = useState<HarnessState>(() =>
    createHarnessState({ fixtureId: fixture, seed, viewer }),
  );
  const [state, setState] = useState<GameState>(harness.room);
  const [viewerId, setViewerId] = useState(harness.viewerId);
  const [intents, setIntents] = useState<IntentRecord[]>([]);

  const stateRef = useRef<GameState>(harness.room);
  const rngRef = useRef<() => number>(createSeededRng(harness.seed ^ 0x9e3779b9));
  const timelineRef = useRef(createInitialTimeline());
  const recordIdRef = useRef(0);

  const controlledPlayerIds = useMemo(
    () => state.players.map((player) => player.id),
    [state.players],
  );
  const mode = boardMode(state);

  const dispatch = useCallback<Dispatch>(
    (intent, actorOverride) => {
      const current = stateRef.current;
      const isSetup = SETUP_ACTIONS.has(intent.type);
      const candidates = isSetup
        ? setupActorOrder(intent, current, viewerId)
        : [actorOverride ?? gameActor(intent, current, viewerId)];
      let actorId = candidates[0] ?? viewerId;
      let result: EngineResult | null = null;

      for (const candidate of candidates) {
        actorId = candidate;
        let attempt: EngineResult;
        try {
          attempt = applyGameAction(current, candidate, intent, {
            now: Date.now(),
            rng: rngRef.current,
            mode: "solo_lab",
            timeline: timelineRef.current,
          });
        } catch (error) {
          attempt = {
            ok: false,
            error: error instanceof Error ? error.message : String(error),
            errorCode: "engine_threw",
          };
        }
        result = attempt;
        if (attempt.ok && attempt.timeline) timelineRef.current = attempt.timeline;
        if (attempt.ok && attempt.state !== current) break;
        if (!isSetup) break;
      }

      recordIdRef.current += 1;
      const changed = !!result && result.ok && result.state !== current;
      const record: IntentRecord = {
        id: recordIdRef.current,
        at: Date.now(),
        type: intent.type,
        actorId,
        ok: result?.ok ?? false,
        changed,
        ...(result && !result.ok
          ? { error: result.error, ...(result.errorCode ? { errorCode: result.errorCode } : {}) }
          : {}),
      };

      if (result?.ok && result.state !== current) {
        stateRef.current = result.state;
        setState(result.state);
      }
      setIntents((previous) => [...previous, record].slice(-20));
    },
    [viewerId],
  );

  const reset = useCallback(() => {
    const next = createHarnessState({
      fixtureId: harness.fixture?.id ?? null,
      seed: harness.seed,
      viewer,
    });
    stateRef.current = next.room;
    rngRef.current = createSeededRng(next.seed ^ 0x9e3779b9);
    timelineRef.current = createInitialTimeline();
    recordIdRef.current = 0;
    setState(next.room);
    setViewerId(next.viewerId);
    setIntents([]);
  }, [harness.fixture?.id, harness.seed, viewer]);

  const layoutHints = useMemo(
    () => buildLayoutHints(harness, state, viewerId),
    [harness, state, viewerId],
  );

  const dispatchAs = useCallback(
    (playerId: string, intent: GameActionIntent) => dispatch(intent, playerId),
    [dispatch],
  );
  const switchPerspective = useCallback(() => {
    setViewerId((current) => {
      const index = controlledPlayerIds.indexOf(current);
      return controlledPlayerIds[(index + 1) % controlledPlayerIds.length] ?? current;
    });
  }, [controlledPlayerIds]);
  const switchSeat = useCallback(
    (playerId: string) => {
      if (controlledPlayerIds.includes(playerId)) setViewerId(playerId);
    },
    [controlledPlayerIds],
  );

  const slotProps: BoardSlotProps = useMemo(
    () => ({
      state,
      viewerId,
      controlledPlayerIds,
      dispatch,
      dispatchAs,
      mode,
      onSwitchSeat: switchSeat,
      onReturnToLobby: () => undefined,
      onLeaveRoom: () => undefined,
    }),
    [state, viewerId, controlledPlayerIds, dispatch, dispatchAs, mode, switchSeat],
  );

  const viewerPlayer = state.players.find((player) => player.id === viewerId);
  const handCounts = state.players.map((player) => player.board?.hand.length ?? 0).join(",");
  const deckCounts = state.players.map((player) => player.board?.deck.length ?? 0).join(",");
  const lastIntent = intents[intents.length - 1] ?? null;

  const debugIntent = (intent: GameActionIntent) => dispatch(intent);

  return (
    <div
      className="relative h-[100dvh] w-full"
      data-testid="dev-play"
      data-fixture={harness.fixture?.id ?? "sololab"}
    >
      <div className="sim-game-viewport h-full" data-padded="false">
        <BoardInteractionProvider
          {...slotProps}
          dispatchAs={dispatchAs}
          onSwitchPerspective={switchPerspective}
        >
          <GameBoardView
            state={state}
            viewerId={viewerId}
            layoutHints={layoutHints}
            slots={{
              sidebar: (
                <SidebarSlot
                  {...slotProps}
                  chain={<ChainSlot {...slotProps} embedded />}
                />
              ),
              hand: <HandSlot {...slotProps} />,
              prompts: <PromptsSlot {...slotProps} />,
              overlays: <OverlaysSlot {...slotProps} />,
            }}
          />
        </BoardInteractionProvider>
      </div>

      <aside
        className="fixed left-3 top-3 z-[2147483000] flex max-h-[calc(100dvh-1.5rem)] w-[22.5rem] max-w-[calc(100vw-1.5rem)] flex-col gap-2 overflow-auto rounded-xl border border-[rgba(134,168,246,0.35)] bg-[rgba(6,14,26,0.94)] p-3 text-[0.68rem] text-[#dbe7ff] shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-md"
        data-testid="dev-panel"
      >
        <header className="flex items-center justify-between gap-2">
          <strong className="text-[0.72rem] font-bold uppercase tracking-[0.12em] text-[#bfeaff]">
            Local play harness
          </strong>
          <span className="text-[0.58rem] uppercase tracking-[0.08em] text-[#8ea9c9]">
            {harness.fixture ? harness.fixture.id : "solo lab"}
          </span>
        </header>

        <div
          data-testid="debug-state"
          data-phase={state.phase}
          data-turn={state.turnNumber ?? 0}
          data-viewer-id={viewerId}
          data-mode={mode}
          data-controlled-player-ids={controlledPlayerIds.join(",")}
          data-active-player-id={state.activeTurnPlayerId ?? ""}
          data-hand-counts={handCounts}
          data-deck-counts={deckCounts}
          className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 rounded-md border border-[rgba(134,168,246,0.2)] bg-[rgba(11,23,42,0.72)] px-2 py-1.5 text-[0.62rem]"
        >
          <span className="text-[#8ea9c9]">phase</span>
          <span className="font-semibold">{state.phase}</span>
          <span className="text-[#8ea9c9]">turn</span>
          <span>
            {state.turnNumber ?? 0} · active {state.activeTurnPlayerId ?? "—"}
          </span>
          <span className="text-[#8ea9c9]">viewer</span>
          <span>
            {viewerPlayer?.name ?? viewerId} <span className="text-[#8ea9c9]">({viewerId})</span>
          </span>
          <span className="text-[#8ea9c9]">hands</span>
          <span>{handCounts}</span>
          <span className="text-[#8ea9c9]">decks</span>
          <span>{deckCounts}</span>
          <span className="text-[#8ea9c9]">seed</span>
          <span>{harness.seed}</span>
        </div>

        <div className="flex flex-wrap items-end gap-1.5">
          <label className="flex min-w-0 flex-1 flex-col gap-0.5 text-[0.56rem] uppercase tracking-[0.08em] text-[#8ea9c9]">
            Viewer seat
            <select
              data-testid="viewer-select"
              value={viewerId}
              onChange={(event) => setViewerId(event.target.value)}
              className="w-full rounded-md border border-[rgba(134,168,246,0.3)] bg-[rgba(14,28,50,0.95)] px-1.5 py-1 text-[0.66rem] normal-case tracking-normal text-[#eaf3ff]"
            >
              {state.players.map((player) => (
                <option key={player.id} value={player.id}>
                  {player.name} · seat {player.seat}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            data-testid="debug-reset"
            onClick={reset}
            className="rounded-md border border-[rgba(134,168,246,0.32)] bg-[rgba(19,35,60,0.9)] px-2 py-1 font-semibold text-[#dbe7ff] hover:bg-[rgba(29,51,84,0.95)]"
          >
            Reset
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            data-testid="debug-auto-setup"
            onClick={() => debugIntent({ type: "auto_start_test_setup" })}
            disabled={state.phase === "in_game"}
            className="rounded-md border border-[rgba(231,185,117,0.4)] bg-[rgba(54,41,20,0.88)] px-2 py-1 font-semibold text-[#ffe6b8] hover:bg-[rgba(74,56,26,0.92)] disabled:cursor-not-allowed disabled:opacity-40"
            title="Runs the original auto_start_test_setup action (battlefields → first player → mulligans)"
          >
            Auto setup
          </button>
          <button
            type="button"
            data-testid="debug-draw"
            onClick={() => debugIntent({ type: "draw_cards", count: 1 })}
            className="rounded-md border border-[rgba(134,168,246,0.32)] bg-[rgba(19,35,60,0.9)] px-2 py-1 font-semibold text-[#dbe7ff] hover:bg-[rgba(29,51,84,0.95)]"
            title="draw_cards { count: 1 } — applied as the current viewer seat"
          >
            Draw 1
          </button>
          <button
            type="button"
            data-testid="debug-end-turn"
            onClick={() =>
              debugIntent({
                type: "end_turn",
                observed: {
                  turnNumber: state.turnNumber ?? 0,
                  activePlayerId: state.activeTurnPlayerId ?? "",
                  activeStep: state.activeTurnStep ?? "main",
                },
              })
            }
            disabled={state.phase !== "in_game"}
            className="rounded-md border border-[rgba(134,168,246,0.32)] bg-[rgba(19,35,60,0.9)] px-2 py-1 font-semibold text-[#dbe7ff] hover:bg-[rgba(29,51,84,0.95)] disabled:cursor-not-allowed disabled:opacity-40"
            title="end_turn with the current observed turn state"
          >
            End turn
          </button>
        </div>

        <details open data-testid="debug-details">
          <summary className="cursor-pointer select-none text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-[#9db5d4]">
            Last 20 intents
          </summary>
          <div
            data-testid="debug-last-result"
            data-ok={lastIntent ? String(lastIntent.ok) : ""}
            data-changed={lastIntent ? String(lastIntent.changed) : ""}
            data-type={lastIntent?.type ?? ""}
            className="mt-1 rounded-md border border-[rgba(134,168,246,0.2)] bg-[rgba(11,23,42,0.72)] px-2 py-1 text-[0.6rem] text-[#9db5d4]"
          >
            {lastIntent
              ? `${lastIntent.type} · ${lastIntent.ok ? (lastIntent.changed ? "changed" : "no-op") : `error: ${lastIntent.error ?? "unknown"}`}`
              : "No intents yet."}
          </div>
          <ol data-testid="debug-intent-log" className="mt-1 space-y-1">
            {intents
              .slice()
              .reverse()
              .map((record) => (
                <li
                  key={record.id}
                  data-testid="debug-intent"
                  data-type={record.type}
                  data-ok={String(record.ok)}
                  data-changed={String(record.changed)}
                  data-actor-id={record.actorId}
                  className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 rounded border border-[rgba(134,168,246,0.14)] bg-[rgba(9,19,36,0.62)] px-1.5 py-1 font-mono text-[0.56rem]"
                >
                  <span className="text-[#7f9ab8]">#{record.id}</span>
                  <code className="text-[#cfe4ff]">{record.type}</code>
                  <span className="text-[#8ea9c9]">as {record.actorId}</span>
                  <span
                    className={
                      record.ok
                        ? record.changed
                          ? "text-[#8fe3b0]"
                          : "text-[#e5cf94]"
                        : "text-[#ff9f9f]"
                    }
                  >
                    {record.ok
                      ? record.changed
                        ? "ok"
                        : "no-op"
                      : `error: ${record.error ?? "unknown"}`}
                  </span>
                </li>
              ))}
          </ol>
        </details>

        <p className="text-[0.55rem] leading-snug text-[#7f9ab8]">
          Both seats are controlled ({DEV_PLAYER_IDS.join(" · ")}). Setup actions auto-route to the
          seat that still needs to act. Every intent is applied locally through{" "}
          <code>applyGameAction</code> with <code>mode: &quot;solo_lab&quot;</code>.
        </p>
      </aside>
    </div>
  );
}
