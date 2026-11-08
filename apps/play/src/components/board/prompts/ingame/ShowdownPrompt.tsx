"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

import { createTranslator } from "@rift/i18n";

import type { BoardSlotProps } from "../../slot-types";
import { deriveConquerPrompt, type ConquerPromptModel } from "./prompt-state";

const t = createTranslator("en");

const TONE_CLASSES = {
  conquer:
    "border-[rgba(139,222,189,0.58)] bg-[linear-gradient(180deg,rgba(39,112,87,0.94),rgba(24,76,60,0.96))] text-[#e3fff2] shadow-[inset_0_1px_0_rgba(218,255,240,0.1)] enabled:hover:border-[rgba(174,241,211,0.78)] enabled:hover:bg-[linear-gradient(180deg,rgba(49,132,102,0.98),rgba(28,91,70,0.98))]",
  response:
    "border-[rgba(226,185,119,0.56)] bg-[linear-gradient(180deg,rgba(105,79,47,0.94),rgba(67,50,34,0.96))] text-[#fff0cf] shadow-[inset_0_1px_0_rgba(255,238,198,0.1)] enabled:hover:border-[rgba(245,210,151,0.76)] enabled:hover:bg-[linear-gradient(180deg,rgba(124,92,53,0.98),rgba(79,58,37,0.98))]",
  waiting:
    "border-[rgba(155,174,202,0.18)] bg-[rgba(42,57,78,0.72)] text-[rgba(198,213,235,0.58)] shadow-none",
  focus:
    "border-[rgba(151,199,238,0.48)] bg-[linear-gradient(180deg,rgba(60,92,130,0.96),rgba(42,67,98,0.96))] text-[#e8f5ff] shadow-[inset_0_1px_0_rgba(225,244,255,0.1)] enabled:hover:border-[rgba(190,224,250,0.72)] enabled:hover:bg-[linear-gradient(180deg,rgba(73,109,150,0.98),rgba(49,78,113,0.98))]",
} as const;

function MightNumber({ value, direction }: { value: number; direction: 1 | -1 }) {
  return (
    <div className="relative inline-flex min-w-[2.1rem] items-center justify-center overflow-hidden rounded-[0.2rem] border border-[rgba(193,210,235,0.42)] bg-[rgba(16,30,50,0.9)] px-[0.34rem] py-[0.16rem] text-[0.86rem] font-black tabular-nums text-[#e8f2ff] shadow-[inset_0_1px_0_rgba(234,242,255,0.12)]">
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
        sendAsActor({ type: "battlefield_conquer_pass_focus", zone: prompt.zone });
      } else if (prompt.primaryAction === "pass_response") {
        sendAsActor({ type: "battlefield_conquer_pass_response", zone: prompt.zone });
      } else {
        sendAsActor({ type: "battlefield_conquer_confirm", zone: prompt.zone });
      }
    });
  };

  const runSecondary = () => {
    if (!prompt.viewerIsActor || prompt.secondaryAction !== "pass_focus") return;
    run(() => sendAsActor({ type: "battlefield_conquer_pass_focus", zone: prompt.zone }));
  };

  const primaryTone = !prompt.viewerIsActor ? "waiting" : prompt.tone;
  const secondaryTone = prompt.viewerIsActor ? "focus" : "waiting";
  const primaryHotkey =
    prompt.primaryAction === "pass_response" || prompt.primaryAction === "conquer" ? "Q" : "Q";
  const secondaryHotkey = prompt.secondaryAction ? "W" : null;

  return (
    <motion.div
      className="pointer-events-none absolute left-1/2 z-[152] w-[min(23rem,calc(100%-1rem))] -translate-x-1/2"
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
      <div className="pointer-events-auto rounded-[0.32rem] border border-[rgba(193,210,235,0.42)] bg-[linear-gradient(160deg,rgba(31,49,75,0.97),rgba(16,28,46,0.98))] p-[0.42rem] shadow-[inset_0_1px_0_rgba(234,242,255,0.12),inset_3px_0_0_rgba(226,178,102,0.34),0_0_0_1px_rgba(5,12,25,0.46),0_8px_20px_rgba(2,8,20,0.44)]">
        <div className="flex items-start gap-[0.38rem]">
          <span
            data-showdown-crest={prompt.tone}
            aria-hidden="true"
            className={`mt-[0.04rem] inline-flex h-[1.35rem] w-[1.35rem] shrink-0 items-center justify-center border text-[0.72rem] ${
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
              <span className="text-[0.56rem] font-semibold uppercase leading-none tracking-[0.1em] text-[#c5d6ee]">
                {prompt.stage === "attacker_confirm_conquer"
                  ? (t("sim.playerCaptures", { playerName: prompt.attacker.name }) ?? "Captures")
                  : (t("sim.showdownInProgress") ?? "Showdown")}
              </span>
              <span className="flex items-center gap-[0.24rem]" data-showdown-might="">
                <MightNumber value={prompt.attackerMight} direction={attackerDirection} />
                {prompt.defender ? (
                  <>
                    <span className="text-[0.56rem] text-[#8fa6c1]">v</span>
                    <MightNumber value={prompt.defenderMight} direction={defenderDirection} />
                  </>
                ) : null}
              </span>
            </div>
            <p
              className="m-0 mt-[0.18rem] text-[0.72rem] font-semibold leading-[1.2] text-[#eef5ff]"
              title={prompt.detail}
            >
              {prompt.headline}
            </p>
            <p className="m-0 mt-[0.1rem] text-[0.6rem] leading-[1.24] text-[#b8cce4]">
              {prompt.instruction}
            </p>
          </div>
          {prompt.canDismiss ? (
            <button
              type="button"
              data-showdown-dismiss="true"
              className="pointer-events-auto inline-flex h-[1.35rem] w-[1.35rem] shrink-0 items-center justify-center border border-[rgba(170,188,217,0.3)] bg-[rgba(36,56,84,0.72)] text-[0.72rem] text-[#d4e4ff] transition hover:border-[rgba(202,218,244,0.52)] hover:bg-[rgba(52,78,114,0.82)]"
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
        <div className="mt-[0.34rem] grid grid-cols-1 gap-[0.2rem]">
          <button
            type="button"
            data-showdown-action-tone={primaryTone}
            className={`pointer-events-auto min-h-8 rounded-none border px-[0.32rem] py-[0.22rem] text-center text-[0.72rem] font-semibold leading-[1.08] transition-[filter,border-color,background-color,color,box-shadow] disabled:pointer-events-none disabled:cursor-default ${TONE_CLASSES[primaryTone]} ${
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
              className={`pointer-events-auto min-h-8 rounded-none border px-[0.32rem] py-[0.22rem] text-center text-[0.72rem] font-semibold leading-[1.08] transition-[filter,border-color,background-color,color,box-shadow] disabled:pointer-events-none disabled:cursor-default ${TONE_CLASSES[secondaryTone]} ${
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
