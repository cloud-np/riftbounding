"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { createTranslator } from "@rift/i18n";

import type { BoardSlotProps } from "../../slot-types";
import { chainControlIntent } from "../../chain/chain-utils";
import { deriveConquerPrompt, type ConquerPromptModel } from "./prompt-state";

const t = createTranslator("en");

const BUTTON_BASE =
  "enabled:hover:brightness-110 enabled:active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rb-gold-bright,#f0d48a)]";
const TONE_CLASSES = {
  conquer:
    "border-[rgba(139,222,189,0.7)] bg-[linear-gradient(180deg,#2f8466,#1d5c47)] text-[#effff8] shadow-[0_2px_10px_rgba(0,0,0,0.5)]",
  response:
    "border-[var(--rb-gold,#c8aa6e)] bg-[linear-gradient(180deg,#d9bd7f,#b08f4c)] text-[#15110a] shadow-[0_2px_10px_rgba(0,0,0,0.5)]",
  waiting:
    "border-[var(--rb-border,rgba(255,255,255,0.08))] bg-[var(--rb-surface-2,#15171b)] text-[var(--rb-text-dim,#a39d92)] shadow-none",
  focus:
    "border-[var(--rb-border-strong,rgba(200,170,110,0.45))] bg-[var(--rb-surface-2,#15171b)] text-[var(--rb-text,#ece6da)] shadow-[0_2px_10px_rgba(0,0,0,0.5)] enabled:hover:border-[var(--rb-gold-bright,#f0d48a)]",
} as const;

function MightNumber({ value, direction }: { value: number; direction: 1 | -1 }) {
  return (
    <div className="relative inline-flex min-w-[2.8rem] items-center justify-center overflow-hidden rounded-[0.3rem] border border-[var(--rb-border-strong,rgba(200,170,110,0.45))] bg-[var(--rb-surface-2,#15171b)] px-2 py-[0.2rem] text-xl font-black tabular-nums text-[var(--rb-gold-bright,#f0d48a)]">
      <AnimatePresence initial={false} custom={direction} mode="popLayout">
        <motion.span
          key={value}
          custom={direction}
          variants={{
            enter: (dir: number) => ({ opacity: 0, y: 9 * dir, rotateX: -40 * dir }),
            settled: { opacity: 1, y: 0, rotateX: 0 },
            leave: (dir: number) => ({ opacity: 0, y: -9 * dir, rotateX: 40 * dir }),
          }}
          initial="enter"
          animate="settled"
          exit="leave"
          transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          className="inline-block"
          data-might-number={value}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </div>
  );
}

function useMightDirection(value: number): 1 | -1 {
  const previous = useRef(value);
  const direction = value >= previous.current ? 1 : -1;
  previous.current = value;
  return direction;
}

export function ShowdownPrompt({
  room,
  viewerId,
  controlledPlayerIds,
  mode,
  dispatch,
  dispatchAs,
}: Pick<
  BoardSlotProps,
  "state" | "viewerId" | "controlledPlayerIds" | "mode" | "dispatch" | "dispatchAs"
> & { room: BoardSlotProps["state"] }) {
  const initialPrompt = deriveConquerPrompt(room, viewerId, t);
  const soloActorId =
    mode !== "multiplayer" &&
    initialPrompt &&
    controlledPlayerIds.includes(initialPrompt.actorId) &&
    initialPrompt.actorId !== viewerId
      ? initialPrompt.actorId
      : null;
  const prompt = deriveConquerPrompt(room, soloActorId ?? viewerId, t);
  const [busy, setBusy] = useState(false);
  const sendAsActor = (intent: Parameters<typeof dispatch>[0]) => {
    if (soloActorId && dispatchAs) dispatchAs(soloActorId, intent);
    else dispatch(intent);
  };
  const attackerDirection = useMightDirection(prompt?.attackerMight ?? 0);
  const defenderDirection = useMightDirection(prompt?.defenderMight ?? 0);

  useEffect(() => {
    if (!prompt) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey || event.defaultPrevented) return;
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        target.closest("input, textarea, select, [contenteditable='true']")
      )
        return;
      const key = event.key.toLowerCase();
      if (!prompt.viewerIsActor || busy) return;
      if (key === "q") {
        event.preventDefault();
        runPrimary();
      } else if (key === "w" && prompt.secondaryAction === "pass_focus") {
        event.preventDefault();
        runSecondary();
      }
    };
    window.addEventListener("keydown", onKeyDown, true);
    return () => window.removeEventListener("keydown", onKeyDown, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, prompt?.viewerIsActor, prompt?.secondaryAction, prompt?.zone, prompt?.stage]);

  if (!prompt) return null;

  const run = (intent: () => void) => {
    if (busy) return;
    setBusy(true);
    intent();
    window.setTimeout(() => setBusy(false), 650);
  };

  const runPrimary = () => {
    if (!prompt.viewerIsActor) return;
    run(() => {
      if (prompt.primaryAction === "pass_focus") {
        sendAsActor(
          chainControlIntent(room, { type: "battlefield_conquer_pass_focus", zone: prompt.zone }),
        );
      } else if (prompt.primaryAction === "pass_response") {
        sendAsActor(
          chainControlIntent(room, {
            type: "battlefield_conquer_pass_response",
            zone: prompt.zone,
          }),
        );
      } else {
        sendAsActor({ type: "battlefield_conquer_confirm", zone: prompt.zone });
      }
    });
  };

  const runSecondary = () => {
    if (!prompt.viewerIsActor || prompt.secondaryAction !== "pass_focus") return;
    run(() =>
      sendAsActor(
        chainControlIntent(room, { type: "battlefield_conquer_pass_focus", zone: prompt.zone }),
      ),
    );
  };

  const primaryTone = !prompt.viewerIsActor ? "waiting" : prompt.tone;
  const secondaryTone = prompt.viewerIsActor ? "focus" : "waiting";
  const primaryHotkey =
    prompt.primaryAction === "pass_response" || prompt.primaryAction === "conquer" ? "Q" : "Q";
  const secondaryHotkey = prompt.secondaryAction ? "W" : null;

  return (
    <motion.div
      className="pointer-events-none absolute left-1/2 z-[152] w-[min(30rem,calc(100%-1.5rem))] -translate-x-1/2"
      style={{ bottom: "calc(var(--player-band-size, 9rem) + 0.9rem)" }}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
      data-showdown-shell="true"
      data-showdown-visual-tone={prompt.tone}
      data-showdown-action-tone={primaryTone}
      data-showdown-zone={prompt.zone}
      data-showdown-stage={prompt.stage}
      data-testid="showdown-prompt"
    >
      <div
        className="pointer-events-auto rounded-[0.7rem] border border-[var(--rb-border-strong,rgba(200,170,110,0.45))] bg-[var(--rb-surface,#0e0f12)] p-4 text-[var(--rb-text,#ece6da)] shadow-[0_0_0_1px_rgba(0,0,0,0.6),0_18px_44px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(240,212,138,0.14)]"
        style={{ fontFamily: "var(--font-ui), system-ui, sans-serif" }}
      >
        <div className="flex items-start gap-3">
          <span
            data-showdown-crest={prompt.tone}
            aria-hidden="true"
            className={`mt-[0.1rem] inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.3rem] border text-base ${
              prompt.tone === "conquer"
                ? "border-[rgba(139,222,189,0.5)] bg-[rgba(25,82,64,0.72)] text-[#bff3da]"
                : prompt.tone === "response"
                  ? "border-[rgba(226,185,119,0.48)] bg-[rgba(91,67,39,0.72)] text-[#f5d59b]"
                  : "border-[rgba(151,199,238,0.44)] bg-[rgba(42,74,105,0.74)] text-[#c9eaff]"
            }`}
          >
            {prompt.primaryAction === "conquer" ? "⚔" : "◎"}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-semibold uppercase leading-none tracking-[0.14em] text-[var(--rb-gold,#c8aa6e)]">
                {prompt.stage === "attacker_confirm_conquer"
                  ? (t("sim.playerCaptures", { playerName: prompt.attacker.name }) ?? "Captures")
                  : (t("sim.showdownInProgress") ?? "Showdown")}
              </span>
              <span className="flex items-center gap-[0.24rem]" data-showdown-might="">
                <MightNumber value={prompt.attackerMight} direction={attackerDirection} />
                {prompt.defender ? (
                  <>
                    <span className="text-sm text-[var(--rb-text-dim,#a39d92)]">v</span>
                    <MightNumber value={prompt.defenderMight} direction={defenderDirection} />
                  </>
                ) : null}
              </span>
            </div>
            <p
              className="m-0 mt-2 text-[1.25rem] font-semibold leading-[1.25] text-[var(--rb-gold-bright,#f0d48a)]"
              style={{ fontFamily: "var(--font-heading), ui-serif, Georgia, serif" }}
              title={prompt.detail}
            >
              {prompt.headline}
            </p>
            <p className="m-0 mt-1 text-base leading-[1.4] text-[var(--rb-text-dim,#a39d92)]">
              {prompt.instruction}
            </p>
          </div>
          {prompt.canDismiss ? (
            <button
              type="button"
              data-showdown-dismiss="true"
              className="pointer-events-auto inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[0.3rem] border border-[var(--rb-border-strong,rgba(200,170,110,0.45))] bg-[var(--rb-surface-2,#15171b)] text-xl text-[var(--rb-text,#ece6da)] transition hover:border-[var(--rb-gold-bright,#f0d48a)]"
              aria-label={t("sim.dismissShowdown") ?? "Dismiss showdown"}
              onClick={() =>
                run(() => sendAsActor({ type: "battlefield_conquer_dismiss", zone: prompt.zone }))
              }
              data-testid="showdown-dismiss"
            >
              ×
            </button>
          ) : null}
        </div>
        <div className="mt-4 grid grid-cols-1 gap-2">
          <button
            type="button"
            data-showdown-action-tone={primaryTone}
            className={`pointer-events-auto min-h-12 rounded-[0.4rem] border px-4 py-2 text-center text-base font-semibold leading-[1.2] ${BUTTON_BASE} transition-[filter,border-color,background-color,color,box-shadow] disabled:pointer-events-none disabled:cursor-default ${TONE_CLASSES[primaryTone]} ${
              prompt.viewerIsActor ? "expected-action-button expected-action-button--showdown" : ""
            }`}
            disabled={!prompt.viewerIsActor || busy}
            onClick={runPrimary}
            title={prompt.instruction}
            aria-label={`${prompt.primaryLabel} (${primaryHotkey})`}
            aria-keyshortcuts={primaryHotkey}
            data-testid="showdown-primary"
            data-setup-action="showdown-primary"
          >
            {prompt.primaryLabel}
            {prompt.viewerIsActor ? ` (${primaryHotkey})` : ""}
          </button>
          {prompt.secondaryLabel ? (
            <button
              type="button"
              data-showdown-action-tone={secondaryTone}
              className={`pointer-events-auto min-h-12 rounded-[0.4rem] border px-4 py-2 text-center text-base font-semibold leading-[1.2] ${BUTTON_BASE} transition-[filter,border-color,background-color,color,box-shadow] disabled:pointer-events-none disabled:cursor-default ${TONE_CLASSES[secondaryTone]} ${
                prompt.viewerIsActor
                  ? "expected-action-button expected-action-button--showdown"
                  : ""
              }`}
              disabled={!prompt.viewerIsActor || busy}
              onClick={runSecondary}
              aria-keyshortcuts={secondaryHotkey ?? undefined}
              data-testid="showdown-secondary"
              data-setup-action="showdown-secondary"
            >
              {prompt.secondaryLabel}
              {secondaryHotkey ? ` (${secondaryHotkey})` : ""}
            </button>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
}
