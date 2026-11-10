"use client";

/**
 * `/dev/play?rules=strict[&scenario=showdown][&seed=N]` — a local STRICT-rules duel against the
 * practice bot with the full strict board UI (same slots/layout hints as `GameScreen`), no
 * server. See `strictGame.ts` for how the room is built and `README.md` for the panel hooks.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { strictLegalIntents, strictWhoMayAct } from "@rift/engine";
import type { Room, RoomPlayer } from "@rift/protocol";

import { ChainSlot } from "@/components/board/chain";
import { BoardInteractionProvider, HandSlot } from "@/components/board/interaction";
import type { BattlefieldInfo } from "@/components/board/layout/BattlefieldLayer";
import { GameBoardView, type GameBoardLayoutHints } from "@/components/board/layout/GameBoardView";
import { OverlaysSlot, PromptsSlot } from "@/components/board/prompts";
import type { BoardSlotProps, Dispatch, GameActionIntent } from "@/components/board/slot-types";
import { SidebarSlot } from "@/components/board/sidebar";
import { strictActorFor } from "@/components/board/strict/strict-model";

import { createSeededRng } from "./localGame";
import {
  STRICT_BOT_ACTION_CAP,
  STRICT_BOT_ID,
  STRICT_HUMAN_ID,
  applyStrictIntent,
  botMayAct,
  createStrictHarness,
  runBotStep,
  strictViewFor,
  type StrictHarnessState,
  type StrictIntentRecord,
} from "./strictGame";
import type { StrictScenarioId } from "./strictScenario";

export interface StrictGameHarnessProps {
  seed?: string | number | null;
  scenario?: StrictScenarioId | null;
}

function battlefieldHint(
  player: RoomPlayer | undefined,
  zone: "battlefieldA" | "battlefieldB",
): BattlefieldInfo | undefined {
  if (!player) return undefined;
  const selected = player.selectedBattlefield?.trim();
  const preview = selected || player.battlefieldOptions?.[0]?.trim();
  if (!preview) return undefined;
  return {
    zone,
    name: preview,
    ...(selected && player.selectedBattlefieldCardCode
      ? { cardCode: player.selectedBattlefieldCardCode }
      : {}),
  };
}

const CONTROLLED = [STRICT_HUMAN_ID];

const BTN =
  "rounded-md border border-[rgba(134,168,246,0.32)] bg-[rgba(19,35,60,0.9)] px-2 py-1 font-semibold text-[#dbe7ff] hover:bg-[rgba(29,51,84,0.95)] disabled:cursor-not-allowed disabled:opacity-40";

export function StrictGameHarness({ seed, scenario }: StrictGameHarnessProps) {
  const [initial] = useState<StrictHarnessState>(() =>
    createStrictHarness({ seed, scenario: scenario ?? null }),
  );
  const [room, setRoom] = useState<Room>(initial.room);
  const [seedValue, setSeedValue] = useState(initial.seed);
  const [seedDraft, setSeedDraft] = useState(String(initial.seed));
  const [intents, setIntents] = useState<StrictIntentRecord[]>([]);
  const [botOn, setBotOn] = useState(true);
  const [botError, setBotError] = useState<string | null>(null);
  const [burst, setBurst] = useState(0);
  const [panelOpen, setPanelOpen] = useState(true);
  // Start collapsed on small screens so the panel never covers the board.
  useEffect(() => {
    if (window.innerWidth < 1100 || window.innerHeight < 800) setPanelOpen(false);
  }, []);

  const roomRef = useRef(initial.room);
  const timelineRef = useRef(initial.timeline);
  const rngRef = useRef(createSeededRng(initial.seed ^ 0x51ed2701));
  const recordIdRef = useRef(0);
  const burstRef = useRef(0);

  const record = useCallback((entry: Omit<StrictIntentRecord, "id">) => {
    recordIdRef.current += 1;
    const next: StrictIntentRecord = { id: recordIdRef.current, ...entry };
    setIntents((previous) => [...previous, next].slice(-20));
  }, []);

  const commit = useCallback((next: Room, timeline: typeof timelineRef.current) => {
    roomRef.current = next;
    timelineRef.current = timeline;
    setRoom(next);
  }, []);

  /** Human intents (the board only ever acts for the human seat). */
  const dispatch = useCallback<Dispatch>(
    (intent: GameActionIntent) => {
      const step = applyStrictIntent(
        roomRef.current,
        timelineRef.current,
        STRICT_HUMAN_ID,
        intent as never,
        rngRef.current,
        "human",
      );
      record(step.record);
      burstRef.current = 0;
      setBurst(0);
      setBotError(null);
      if (step.record.ok && step.room !== roomRef.current) commit(step.room, step.timeline);
    },
    [commit, record],
  );
  const dispatchAs = useCallback((_playerId: string, intent: GameActionIntent) => dispatch(intent), [dispatch]);

  /** One bot action; false when the bot had nothing to do or failed. */
  const botStep = useCallback((): boolean => {
    const step = runBotStep(roomRef.current, timelineRef.current, rngRef.current);
    if (!step) return false;
    record(step.record);
    if (!step.record.ok || !step.record.changed) {
      setBotError(`bot ${step.record.type}: ${step.record.error ?? "no progress"}`);
      return false;
    }
    burstRef.current += 1;
    setBurst(burstRef.current);
    commit(step.room, step.timeline);
    return true;
  }, [commit, record]);

  const botCanAct = !room.gameOutcome && room.phase === "in_game" && botMayAct(room);

  // Auto-play the bot with a visible delay; bounded per burst and stopped by errors.
  useEffect(() => {
    if (!botOn || botError || !botCanAct) return;
    if (burst >= STRICT_BOT_ACTION_CAP) {
      setBotError(`bot action cap (${STRICT_BOT_ACTION_CAP}) reached`);
      return;
    }
    const timer = window.setTimeout(() => botStep(), 600 + Math.floor(Math.random() * 300));
    return () => window.clearTimeout(timer);
  }, [room, botOn, botError, botCanAct, burst, botStep]);

  const rebuild = useCallback(
    (nextSeed: number) => {
      const next = createStrictHarness({ seed: nextSeed, scenario: scenario ?? null });
      roomRef.current = next.room;
      timelineRef.current = next.timeline;
      rngRef.current = createSeededRng(next.seed ^ 0x51ed2701);
      recordIdRef.current = 0;
      burstRef.current = 0;
      setBurst(0);
      setBotError(null);
      setIntents([]);
      setRoom(next.room);
      setSeedValue(next.seed);
      setSeedDraft(String(next.seed));
      try {
        const url = new URL(window.location.href);
        url.searchParams.set("seed", String(next.seed));
        window.history.replaceState(null, "", url);
      } catch {
        /* non-browser */
      }
    },
    [scenario],
  );

  // The board only ever sees the human's redacted view, like a real client.
  const view = useMemo(() => strictViewFor(room, STRICT_HUMAN_ID), [room]);
  const who = useMemo(() => strictWhoMayAct(room), [room]);

  const layoutHints = useMemo<GameBoardLayoutHints>(() => {
    const viewerPlayer = view.players.find((player) => player.id === STRICT_HUMAN_ID) ?? view.players[0];
    const opponent = view.players.find((player) => player.id !== viewerPlayer?.id);
    const strict = view.rulesMode === "strict" && view.phase === "in_game" && !!view.rules;
    const strictLegal =
      strict && viewerPlayer
        ? strictLegalIntents(
            view,
            strictActorFor(strictWhoMayAct(view), viewerPlayer.id, CONTROLLED),
          )
        : null;
    return {
      boardLines: "default",
      showScoreTrack: true,
      showTurnControls: view.phase === "in_game",
      canEndTurn: view.phase === "in_game" && (!strict || !!strictLegal?.canEndTurn),
      canSwitchSeat: false,
      phase: view.activeTurnStep === "beginning" ? "beginning" : "main",
      activeTurnSide: view.activeTurnPlayerId === viewerPlayer?.id ? "self" : "opponent",
      battlefields: {
        own: battlefieldHint(viewerPlayer, "battlefieldA"),
        opponent: battlefieldHint(opponent, "battlefieldB"),
      },
    };
  }, [view]);

  const slotProps: BoardSlotProps = useMemo(
    () => ({
      state: view,
      viewerId: STRICT_HUMAN_ID,
      controlledPlayerIds: CONTROLLED,
      dispatch,
      dispatchAs,
      mode: view.roomMode === "solo_lab" ? "solo_lab" : view.roomMode === "single_player" ? "single_player" : "multiplayer",
      onReturnToLobby: () => undefined,
      onLeaveRoom: () => undefined,
    }),
    [view, dispatch, dispatchAs],
  );

  // Script hook (dev only): `window.__riftStrict.dispatch({ type: "rules_pass" })`, `.getRoom()`.
  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;
    const hook = {
      dispatch: (intent: GameActionIntent) => dispatch(intent),
      getRoom: () => roomRef.current,
      getInfo: () => initial.scenarioInfo,
      botStep: () => botStep(),
      setBot: (on: boolean) => setBotOn(on),
    };
    (window as unknown as { __riftStrict?: typeof hook }).__riftStrict = hook;
    return () => {
      delete (window as unknown as { __riftStrict?: typeof hook }).__riftStrict;
    };
  }, [dispatch, botStep, initial.scenarioInfo]);

  const rules = room.rules;
  const last = intents[intents.length - 1] ?? null;
  const nameOf = (id: string | null | undefined) =>
    id ? (room.players.find((p) => p.id === id)?.name ?? id) : "—";
  const whoText = who && who.kind !== "none" ? `${who.kind}:${who.player} (${who.window})` : "none";

  return (
    <div
      className="relative h-[100dvh] w-full"
      data-testid="dev-play"
      data-fixture={`strict${scenario ? `-${scenario}` : ""}`}
    >
      <div className="sim-game-viewport h-full" data-padded="false">
        <BoardInteractionProvider {...slotProps} dispatchAs={dispatchAs}>
          <GameBoardView
            state={view}
            viewerId={STRICT_HUMAN_ID}
            layoutHints={layoutHints}
            slots={{
              sidebar: <SidebarSlot {...slotProps} chain={<ChainSlot {...slotProps} embedded />} />,
              hand: <HandSlot {...slotProps} />,
              prompts: <PromptsSlot {...slotProps} />,
              overlays: <OverlaysSlot {...slotProps} state={view} />,
            }}
          />
        </BoardInteractionProvider>
      </div>

      <aside
        className={`fixed left-3 top-3 z-[2147483000] flex max-h-[calc(100dvh-1.5rem)] max-w-[calc(100vw-1.5rem)] flex-col gap-2 overflow-auto rounded-xl border border-[rgba(134,168,246,0.35)] bg-[rgba(6,14,26,0.94)] text-[0.68rem] text-[#dbe7ff] shadow-[0_18px_50px_rgba(0,0,0,0.55)] backdrop-blur-md ${panelOpen ? "w-[22.5rem] p-3" : "w-auto p-1"}`}
        data-testid="dev-panel"
        data-open={String(panelOpen)}
      >
        <header className="flex items-center justify-between gap-2">
          {panelOpen ? (
            <>
              <strong className="text-[0.72rem] font-bold uppercase tracking-[0.12em] text-[#bfeaff]">
                Strict local duel
              </strong>
              <span className="text-[0.58rem] uppercase tracking-[0.08em] text-[#8ea9c9]">
                {scenario ?? "plain"} · seed {seedValue}
              </span>
            </>
          ) : null}
          <button
            type="button"
            data-testid="strict-panel-toggle"
            aria-expanded={panelOpen}
            title={panelOpen ? "Collapse the dev panel" : "Open the dev panel"}
            className={BTN}
            onClick={() => setPanelOpen((open) => !open)}
          >
            {panelOpen ? "Hide" : "Dev"}
          </button>
        </header>

        <div className={panelOpen ? "contents" : "hidden"}>
          <>
            <div
              data-testid="strict-state"
              data-phase={rules?.turn.phase ?? ""}
              data-room-phase={room.phase}
              data-turn={rules?.turn.number ?? 0}
              data-turn-player={rules?.turn.player ?? ""}
              data-priority={rules?.priority ?? ""}
              data-focus={rules?.focus ?? ""}
              data-who={whoText}
              data-showdown={rules?.showdown ? "true" : "false"}
              data-combat={rules?.combat ? "true" : "false"}
              data-chain={rules?.chain.length ?? 0}
              data-prompt={rules?.prompt?.kind ?? ""}
              data-bot-on={String(botOn)}
              data-bot-can-act={String(botCanAct)}
              data-bot-error={botError ?? ""}
              data-game-over={room.gameOutcome ? "true" : "false"}
              data-hand-counts={room.players.map((p) => p.board?.hand.length ?? 0).join(",")}
              className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 rounded-md border border-[rgba(134,168,246,0.2)] bg-[rgba(11,23,42,0.72)] px-2 py-1.5 text-[0.62rem]"
            >
              <span className="text-[#8ea9c9]">phase / step</span>
              <span className="font-semibold">
                {room.phase} · {rules?.turn.phase ?? "—"} (turn {rules?.turn.number ?? 0})
              </span>
              <span className="text-[#8ea9c9]">turn player</span>
              <span>{nameOf(rules?.turn.player)}</span>
              <span className="text-[#8ea9c9]">priority / focus</span>
              <span>
                {nameOf(rules?.priority)} / {nameOf(rules?.focus)}
              </span>
              <span className="text-[#8ea9c9]">may act</span>
              <span>{whoText}</span>
              <span className="text-[#8ea9c9]">chain / prompt</span>
              <span>
                {rules?.chain.length ?? 0} / {rules?.prompt?.kind ?? "—"}
              </span>
              <span className="text-[#8ea9c9]">showdown</span>
              <span data-testid="strict-showdown">
                {rules?.showdown ? JSON.stringify(rules.showdown) : "—"}
              </span>
              <span className="text-[#8ea9c9]">combat</span>
              <span data-testid="strict-combat">{rules?.combat ? JSON.stringify(rules.combat) : "—"}</span>
              <span className="text-[#8ea9c9]">score</span>
              <span>{room.players.map((p) => `${p.name} ${p.board?.score ?? 0}`).join(" · ")}</span>
              {room.gameOutcome ? (
                <>
                  <span className="text-[#8ea9c9]">outcome</span>
                  <span>{JSON.stringify(room.gameOutcome)}</span>
                </>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <button
                type="button"
                data-testid="strict-bot-toggle"
                className={BTN}
                aria-pressed={botOn}
                onClick={() => {
                  setBotOn((on) => !on);
                  setBotError(null);
                  burstRef.current = 0;
                  setBurst(0);
                }}
              >
                Bot: {botOn ? "on" : "off"}
              </button>
              <button
                type="button"
                data-testid="strict-bot-step"
                className={BTN}
                disabled={!botCanAct}
                onClick={() => {
                  setBotError(null);
                  botStep();
                }}
              >
                Bot step once
              </button>
              <button
                type="button"
                data-testid="debug-reset"
                className={BTN}
                onClick={() => rebuild(seedValue)}
              >
                Reset
              </button>
            </div>
            <form
              className="flex items-center gap-1.5"
              onSubmit={(event) => {
                event.preventDefault();
                rebuild(Number.parseInt(seedDraft, 10) || 0);
              }}
            >
              <label className="text-[0.56rem] uppercase tracking-[0.08em] text-[#8ea9c9]">
                Seed
              </label>
              <input
                data-testid="strict-seed"
                value={seedDraft}
                onChange={(event) => setSeedDraft(event.target.value)}
                inputMode="numeric"
                className="w-24 rounded-md border border-[rgba(134,168,246,0.3)] bg-[rgba(14,28,50,0.95)] px-1.5 py-1 text-[0.66rem] text-[#eaf3ff]"
              />
              <button type="submit" data-testid="strict-seed-apply" className={BTN}>
                New game
              </button>
            </form>
            {botError ? (
              <p data-testid="strict-bot-error" className="rounded border border-[rgba(255,120,120,0.4)] bg-[rgba(60,18,24,0.8)] px-2 py-1 text-[#ffb4b4]">
                {botError} — bot paused (toggle, step or act to resume)
              </p>
            ) : null}

            <details open data-testid="debug-details">
              <summary className="cursor-pointer select-none text-[0.6rem] font-semibold uppercase tracking-[0.1em] text-[#9db5d4]">
                Last 20 intents
              </summary>
              <div
                data-testid="debug-last-result"
                data-ok={last ? String(last.ok) : ""}
                data-changed={last ? String(last.changed) : ""}
                data-type={last?.type ?? ""}
                className="mt-1 rounded-md border border-[rgba(134,168,246,0.2)] bg-[rgba(11,23,42,0.72)] px-2 py-1 text-[0.6rem] text-[#9db5d4]"
              >
                {last
                  ? `${last.type} · ${last.ok ? (last.changed ? "changed" : "no-op") : `error: ${last.error ?? "unknown"}`}`
                  : "No intents yet."}
              </div>
              <ol data-testid="debug-intent-log" className="mt-1 space-y-1">
                {intents
                  .slice()
                  .reverse()
                  .map((entry) => (
                    <li
                      key={entry.id}
                      data-testid="debug-intent"
                      data-type={entry.type}
                      data-ok={String(entry.ok)}
                      data-changed={String(entry.changed)}
                      data-actor-id={entry.actorId}
                      data-source={entry.source}
                      className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0.5 rounded border border-[rgba(134,168,246,0.14)] bg-[rgba(9,19,36,0.62)] px-1.5 py-1 font-mono text-[0.56rem]"
                    >
                      <span className="text-[#7f9ab8]">#{entry.id}</span>
                      <code className="text-[#cfe4ff]">{entry.type}</code>
                      <span className="text-[#8ea9c9]">{entry.source}</span>
                      <span className={entry.ok ? (entry.changed ? "text-[#8fe3b0]" : "text-[#e5cf94]") : "text-[#ff9f9f]"}>
                        {entry.ok ? (entry.changed ? "ok" : "no-op") : `error: ${entry.error ?? "unknown"}`}
                      </span>
                    </li>
                  ))}
              </ol>
            </details>
            <p className="text-[0.55rem] leading-snug text-[#7f9ab8]">
              You are <code>{STRICT_HUMAN_ID}</code> (seat 0); <code>{STRICT_BOT_ID}</code> is driven
              by <code>pickStrictBotAction</code> on its own redacted view. Intents run through{" "}
              <code>applyGameAction</code> with <code>mode: &quot;single_player&quot;</code>.
            </p>
          </>
        </div>
      </aside>
    </div>
  );
}
