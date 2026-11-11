"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { createTranslator } from "@rift/i18n";
import type { ChainEntry } from "@rift/protocol";
import { strictWhoMayAct } from "@rift/engine";

import type { BoardSlotProps } from "../slot-types";
import {
  promptForClient,
  strictChainStatus,
} from "../strict/strict-model";
import { ChainEntryCard } from "./ChainEntryCard";
import {
  chainControlIntent,
  chainDisplayEntry,
  chainPriority,
  chainResolveDestination,
  prioritySummary,
  readBoardCardDrag,
} from "./chain-utils";

const t = createTranslator("en");

const RESOLVE_BUTTON_CLASS =
  "w-[calc(var(--chain-lane-width)-1.12rem)] max-w-full min-h-[2.02rem] rounded-[0.3rem] border px-[0.68rem] text-[0.84rem] font-extrabold leading-none tracking-[0.01em] transition-[transform,background-color,border-color,box-shadow,color,filter] duration-160 ease-out disabled:cursor-default disabled:transform-none";
const BUTTON_ACTIVE =
  "border-[rgba(222,227,233,0.88)] bg-[linear-gradient(180deg,rgba(128,142,161,1),rgba(85,96,113,0.98))] text-[#f7fbff] shadow-[0_0_0_1px_rgba(197,206,218,0.38),0_0_18px_rgba(149,165,189,0.34),0_14px_30px_rgba(37,36,35,0.46)] enabled:hover:-translate-y-[1px] enabled:hover:brightness-[1.05] enabled:focus-visible:outline-none enabled:focus-visible:ring-2 enabled:focus-visible:ring-[rgba(219,225,231,0.48)] enabled:focus-visible:ring-offset-0";
const BUTTON_APPROVE =
  "border-[rgba(164,238,204,0.7)] bg-[linear-gradient(180deg,rgba(39,88,74,0.98),rgba(24,62,54,0.96))] text-[#dffbef] shadow-[0_0_0_1px_rgba(120,221,183,0.24),0_0_16px_rgba(120,221,183,0.18),0_10px_24px_rgba(8,28,22,0.34)]";
const BUTTON_IDLE =
  "border-[rgba(181,185,189,0.26)] bg-[linear-gradient(180deg,rgba(68,67,66,0.94),rgba(58,57,56,0.92))] text-[#c6c9cd] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]";

export interface ChainSlotProps extends BoardSlotProps {
  /** Rendered inside the sidebar chain row (the shell owns the Resolve button). */
  embedded?: boolean;
}

export function ChainSlot({
  state,
  viewerId,
  controlledPlayerIds,
  dispatch,
  dispatchAs,
  mode,
  embedded = false,
}: ChainSlotProps) {
  const [laneWidthRem, setLaneWidthRem] = useState(15.5);
  const [collapsed, setCollapsed] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const rootRef = useRef<HTMLElement | null>(null);
  const priority = useMemo(() => chainPriority(state, viewerId, mode), [state, viewerId, mode]);
  const entries = useMemo(
    () => state.chainEntries.map((entry) => chainDisplayEntry(entry, state)),
    [state],
  );
  const top = entries[0] ?? null;
  const ownerId = top?.byPlayerId ?? null;
  const strictRoom = state.rulesMode === "strict" && state.phase === "in_game" && !!state.rules;
  const strictWho = useMemo(
    () => (strictRoom ? strictWhoMayAct(state) : null),
    [state, strictRoom],
  );
  const strictPrompt = useMemo(
    () => (strictRoom ? promptForClient(state, controlledPlayerIds) : null),
    [state, controlledPlayerIds, strictRoom],
  );
  const promptPending = !!strictPrompt;
  const canResolveAsOwner =
    mode !== "multiplayer" && !!ownerId && controlledPlayerIds.includes(ownerId);
  const canResolve = (priority.canResolve || canResolveAsOwner) && !promptPending;
  const canApprove = priority.canApprove && !promptPending;
  const showResolveRow = !embedded || !(priority.viewerIsOwner || canResolveAsOwner);
  const queuedExtraTurns = new Set(
    (state.pendingExtraTurns ?? []).map((item) => item.sourceEntryId),
  );

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const read = () => {
      const board = root.closest<HTMLElement>(".gb-board");
      const raw = board
        ? getComputedStyle(board).getPropertyValue("--chain-lane-width").trim()
        : "";
      const parsed = Number.parseFloat(raw);
      if (Number.isFinite(parsed) && parsed > 0) setLaneWidthRem(parsed);
    };
    read();
    const observer = typeof ResizeObserver === "function" ? new ResizeObserver(read) : null;
    observer?.observe(root);
    const board = root.closest<HTMLElement>(".gb-board");
    if (board) observer?.observe(board);
    window.addEventListener("resize", read);
    return () => {
      observer?.disconnect();
      window.removeEventListener("resize", read);
    };
  }, []);

  const stackHeight = useMemo(() => {
    const value = Math.max(8, Math.min(26, (laneWidthRem - 0.3) * 1.207));
    return `${value.toFixed(3)}rem`;
  }, [laneWidthRem]);

  const resolve = useCallback(
    (entry: ChainEntry) => {
      if (!canResolve) return;
      const intent = chainControlIntent(state, {
        type: "chain_resolve" as const,
        entryId: entry.id,
        to: chainResolveDestination(entry),
      });
      if (entry.byPlayerId !== viewerId && canResolveAsOwner && dispatchAs) {
        dispatchAs(entry.byPlayerId, intent);
      } else {
        dispatch(intent);
      }
    },
    [canResolve, canResolveAsOwner, dispatch, dispatchAs, viewerId, state],
  );

  const approve = useCallback(
    (entry: ChainEntry) => {
      if (!priority.viewerIsParticipant) return;
      dispatch(
        chainControlIntent(state, {
          type: "chain_set_resolve_vote",
          entryId: entry.id,
          approved: !priority.viewerApproved,
        }),
      );
    },
    [dispatch, priority.viewerApproved, priority.viewerIsParticipant, state],
  );

  const toggleRepeat = useCallback(
    (entry: ChainEntry, enabled: boolean) => {
      dispatch({ type: "chain_set_repeat", entryId: entry.id, enabled });
    },
    [dispatch],
  );

  const toggleFlow = useCallback(
    (entry: ChainEntry, enabled: boolean) => {
      dispatch({ type: "chain_set_flow", entryId: entry.id, enabled });
    },
    [dispatch],
  );

  const toggleExtraTurn = useCallback(
    (entry: ChainEntry, enabled: boolean) => {
      dispatch({ type: "set_extra_turn", entryId: entry.id, enabled });
    },
    [dispatch],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest("input, textarea, select, [contenteditable='true']")
      ) {
        return;
      }
      if (!top) return;
      const key = event.key.toLowerCase();
      if (key === "s" && canResolve) {
        event.preventDefault();
        resolve(top);
      } else if (key === "a" && canApprove) {
        event.preventDefault();
        approve(top);
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
  }, [approve, canApprove, canResolve, resolve, top]);

  const sandboxSummary = prioritySummary(priority, t);
  const strictStatusText = strictRoom
    ? strictChainStatus(state, strictWho, controlledPlayerIds, t, strictPrompt)
    : null;
  const summary = strictStatusText ?? sandboxSummary;
  // With an empty chain, still show the focus/priority response window (the opponent's neutral
  // waiting line, or the holder's focus line) instead of "The chain is empty".
  const showStrictWindow =
    !!strictRoom &&
    !top &&
    !!strictWho &&
    (strictWho.kind === "focus" ||
      strictWho.kind === "prompt" ||
      strictWho.kind === "manual" ||
      (strictWho.kind === "priority" && strictWho.window === "chain"));
  const showStatus = !!top || showStrictWindow;
  const isReady =
    !!top && !promptPending && (priority.allApproved || priority.participants.length === 0);
  const dropActive = dragOver;

  const handleDrop = (event: DragEvent<HTMLElement>) => {
    setDragOver(false);
    const boardCard = readBoardCardDrag(event.dataTransfer);
    if (!boardCard) return;
    event.preventDefault();
    dispatch({
      type: "chain_add",
      from: boardCard.zone,
      cardId: boardCard.cardId,
      clientEntryId: `chain-${viewerId}-${boardCard.cardId}-${Date.now()}`,
    });
  };

  if (collapsed) {
    return (
      <aside
        ref={rootRef}
        data-chain-lane-content="true"
        data-chain-collapsed="true"
        data-chain-empty={entries.length === 0 ? "true" : "false"}
        data-chain-lane-width={laneWidthRem}
        data-chain-count={entries.length}
        className="flex h-full w-full flex-col items-center gap-[0.3rem] px-[0.12rem] py-[0.3rem]"
      >
        <button
          type="button"
          data-testid="chain-collapse-toggle"
          aria-label="Expand chain"
          aria-expanded={false}
          onClick={() => setCollapsed(false)}
          className="pointer-events-auto inline-flex h-[2.8rem] w-[2.2rem] flex-col items-center justify-center gap-[0.1rem] rounded-[0.32rem] border border-[rgba(181,185,189,0.34)] bg-[rgba(23,22,21,0.9)] text-[#dde1e5] shadow-[0_8px_18px_rgba(9,8,7,0.42)]"
        >
          <span className="text-[0.58rem] font-black uppercase tracking-[0.04em]">
            {t("sim.chain") ?? "Chain"}
          </span>
          <span className="text-[1rem] font-black leading-none" data-chain-count>
            {entries.length}
          </span>
          <span aria-hidden="true">‹</span>
        </button>
        <div className="flex flex-col gap-[0.18rem]">
          {entries.slice(0, 4).map((entry) => (
            <span
              key={entry.id}
              className="block h-[0.34rem] w-[1.4rem] rounded-[0.08rem]"
              style={{
                background:
                  entry.byPlayerId === viewerId ? "rgba(120,221,183,0.8)" : "rgba(255,187,110,0.8)",
              }}
            />
          ))}
        </div>
      </aside>
    );
  }

  return (
    <aside
      ref={rootRef}
      data-chain-lane-content="true"
      data-compact-chain="true"
      data-chain-empty={entries.length === 0 ? "true" : "false"}
      data-chain-lane-width={laneWidthRem}
      data-chain-count={entries.length}
      className={`tablet-chain-panel flex h-full min-h-0 w-full flex-col overflow-hidden transition-colors ${
        dropActive ? "bg-[rgba(44,43,42,0.3)]" : ""
      }`}
      onDragOver={(event) => {
        const types = [...event.dataTransfer.types];
        if (
          !types.includes("application/x-riftbound-card") &&
          !types.includes("application/x-riftbound-chain-entry")
        ) {
          return;
        }
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        setDragOver(true);
      }}
      onDragLeave={(event) => {
        const next = event.relatedTarget;
        if (next instanceof Node && event.currentTarget.contains(next)) return;
        setDragOver(false);
      }}
      onDrop={handleDrop}
      data-chain-drop-active={dropActive ? "true" : "false"}
    >
      {embedded ? null : (
        <div className="tablet-chain-entry-heading flex min-h-[2.2rem] items-center justify-between gap-[0.3rem] px-[0.36rem] pt-[0.2rem]">
          <h3 className="m-0 flex items-center gap-[0.26rem] text-[0.7rem] font-semibold uppercase tracking-[0.08em] text-[#e4e7ea]">
            <span className="sr-only">{t("sim.chain") ?? "Chain"} </span>
            <span data-chain-count>{entries.length}</span>
            <span className="text-[0.56rem] font-medium normal-case tracking-[0.02em] text-[#a1a8af]">
              {t("sim.chainPriority") ?? "Chain priority"}
            </span>
          </h3>
          <button
            type="button"
            data-testid="chain-collapse-toggle"
            aria-label="Collapse chain"
            aria-expanded
            onClick={() => setCollapsed(true)}
            className="pointer-events-auto grid h-[1.5rem] w-[1.5rem] place-items-center rounded-[0.24rem] border border-[rgba(181,185,189,0.24)] bg-[rgba(23,22,21,0.78)] text-[0.8rem] text-[#dde1e5] hover:border-[rgba(219,225,231,0.5)]"
          >
            ›
          </button>
        </div>
      )}

      <div
        className="relative z-4 grid grid-cols-[minmax(0,1fr)] gap-y-[0.02rem] min-h-[3.66rem] grid-rows-[auto_2.14rem_0.56rem] items-start"
        data-chain-status-row="true"
      >
        {showStatus ? (
          <p
            role="status"
            title={summary}
            aria-label={summary}
            className={`row-start-1 col-start-1 justify-self-center pt-[0.12rem] m-0 max-w-[calc(var(--chain-lane-width)-0.6rem)] inline-flex items-center justify-center gap-[0.16rem] text-center text-[0.64rem] leading-[1.12] font-semibold tracking-[0.02em] ${
              isReady ? "text-[#bdf3de]" : "text-[#ffd8ad]"
            }`}
          >
            <span
              aria-hidden="true"
              className={`h-2 w-2 shrink-0 rounded-full border ${
                isReady
                  ? "border-[rgba(139,222,189,0.72)] bg-[rgba(88,202,155,0.94)] shadow-[0_0_0_1px_rgba(120,221,183,0.26),0_0_10px_rgba(120,221,183,0.5)]"
                  : "border-[rgba(255,198,128,0.72)] bg-[rgba(255,171,92,0.9)] shadow-[0_0_0_1px_rgba(255,187,110,0.24),0_0_10px_rgba(255,187,110,0.46)]"
              }`}
            />
            <span className="min-w-0 truncate">{summary}</span>
          </p>
        ) : (
          <p
            className="row-start-1 col-start-1 justify-self-center pt-[0.12rem] m-0 max-w-[calc(var(--chain-lane-width)-0.6rem)] text-center text-[0.62rem] font-semibold text-[#a1a8af]"
            data-chain-empty-label
          >
            {t("sim.tablet.emptyChain") ?? "The chain is empty"}
          </p>
        )}

        {showResolveRow && top ? (
          <div className="row-start-2 col-span-full mt-[0.12rem] flex justify-center">
            <div className="w-full max-w-[calc(var(--chain-lane-width)-0.3rem)] flex justify-end pr-[0.26rem]">
              {priority.viewerIsOwner || canResolveAsOwner ? (
                <button
                  type="button"
                  className={`${RESOLVE_BUTTON_CLASS} ${canResolve ? BUTTON_ACTIVE : BUTTON_IDLE}`}
                  aria-label={t("sim.resolveShortcut") ?? "Resolve (S)"}
                  title={
                    promptPending
                      ? (t("rules.ui.answerPromptFirst") ?? "Answer the pending choice first")
                      : (t("sim.resolveShortcut") ?? "Resolve (S)")
                  }
                  disabled={!canResolve}
                  onClick={() => top && resolve(top)}
                  data-testid="chain-resolve"
                  data-setup-action="chain-resolve"
                >
                  {t("sim.resolveShortcut") ?? "Resolve (S)"}
                </button>
              ) : (
                <button
                  type="button"
                  className={`${RESOLVE_BUTTON_CLASS} ${
                    priority.viewerApproved
                      ? BUTTON_APPROVE
                      : canApprove
                        ? BUTTON_ACTIVE
                        : BUTTON_IDLE
                  } ${canApprove && !priority.viewerApproved ? "expected-action-button expected-action-button--approval" : ""}`}
                  aria-label={
                    priority.viewerApproved
                      ? (t("sim.chainApprovedShortcut") ?? "Chain approved (A)")
                      : (t("sim.approveShortcut") ?? "Approve (A)")
                  }
                  title={
                    promptPending
                      ? (t("rules.ui.answerPromptFirst") ?? "Answer the pending choice first")
                      : priority.viewerApproved
                        ? (t("sim.chainApprovedShortcut") ?? "Chain approved (A)")
                        : (t("sim.approveShortcut") ?? "Approve (A)")
                  }
                  disabled={!canApprove}
                  onClick={() => top && approve(top)}
                  data-testid="chain-approve"
                  data-setup-action="chain-approve"
                >
                  {priority.viewerApproved
                    ? (t("sim.chainApprovedShortcut") ?? "Chain approved (A)")
                    : (t("sim.approveShortcut") ?? "Approve (A)")}
                </button>
              )}
            </div>
          </div>
        ) : null}
        <span aria-hidden="true" className="row-start-3 col-start-1 h-[0.56rem]" />
      </div>

      <div
        className="relative z-3 min-h-0 flex-1 grid grid-rows-[minmax(0,1fr)] gap-[0.1rem] pt-[0.14rem]"
        style={{ ["--chain-stack-height" as string]: stackHeight }}
      >
        <div className="min-h-0 pt-[1.02rem] flex items-end justify-center">
          <div
            data-chain-stack-stage="true"
            className="relative w-full h-[var(--chain-stack-height)] max-w-[calc(var(--chain-lane-width)-0.3rem)] overflow-visible"
            data-testid="chain-stack"
          >
            <AnimatePresence initial={false}>
              {[...entries].reverse().map((entry, index) => {
                const depth = entries.length - 1 - index;
                return (
                  <ChainEntryCard
                    key={entry.id}
                    entry={entry}
                    depth={depth}
                    laneWidthRem={laneWidthRem}
                    cardSizeScale={1}
                    isOwner={entry.byPlayerId === viewerId}
                    queuedExtraTurn={queuedExtraTurns.has(entry.id)}
                    {...(canResolve ? { onResolve: resolve } : {})}
                    {...(priority.viewerIsParticipant ? { onApprove: approve } : {})}
                    {...(strictRoom
                      ? {}
                      : { onToggleRepeat: toggleRepeat, onToggleFlow: toggleFlow, onToggleExtraTurn: toggleExtraTurn })}
                  />
                );
              })}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {embedded ? null : (
        <div className="mt-auto flex items-center justify-between gap-[0.3rem] px-[0.34rem] py-[0.24rem] text-[0.54rem] uppercase tracking-[0.06em] text-[#91969f]">
          <span>{t("sim.chainApprovals") ?? "Chain approvals"}</span>
          <span data-chain-approval-count>
            {priority.approvedPlayerIds.length}/{priority.participants.length}
          </span>
        </div>
      )}
    </aside>
  );
}
