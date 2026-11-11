"use client";

import { useMemo } from "react";

import { buildAutoPayPaymentBatch } from "@rift/engine";
import { createTranslator } from "@rift/i18n";
import type { CardInstance, Zone } from "@rift/protocol";

import { useBoardInteractionOptional } from "../interaction/context";
import { playBoardSound } from "../interaction/sfx";
import type { GameActionIntent } from "../slot-types";
import type { CardSide } from "./types";

const t = createTranslator("en");

function EyeIcon({ off = false, className = "h-4 w-4" }: { off?: boolean; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="12" cy="12" r="3.1" stroke="currentColor" strokeWidth="1.7" />
      {off ? <path d="M4 4 20 20" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" /> : null}
    </svg>
  );
}

function CoinIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="12" cy="12" r="8.3" stroke="currentColor" strokeWidth="1.7" />
      <path d="M9 9.4h4.3a2.1 2.1 0 0 1 0 4.2H9m0 0h4.8M9 7.2v9.6" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function PingIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M12 4.5v.1M12 19.4v.1M4.5 12h.1M19.4 12h.1M6.7 6.7l.1.1M17.2 17.2l.1.1M17.3 6.7l-.1.1M6.8 17.3l-.1.1" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="12" r="3.2" stroke="currentColor" strokeWidth="1.7" />
    </svg>
  );
}

function TagIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M4 5.2h9.1L20 12l-6.9 6.8H4V5.2Z" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7.5 10.5h4.2M7.5 13.6h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function CounterIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <rect x="4" y="5" width="16" height="14" rx="2.4" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 12h3M9.5 10.5v3M14 10.7h3M14 13.3h3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

function ActionButton({
  label,
  onClick,
  children,
  active = false,
  tone,
  disabled = false,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
  active?: boolean;
  tone?: "danger" | "resource" | "positive";
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      className={
        "gb-card-action-button group/action relative inline-flex h-[1.62rem] w-[1.62rem] items-center justify-center disabled:opacity-40 " +
        (active ? "gb-card-action-button--active " : "") +
        (tone === "danger" ? "gb-card-action-button--danger " : "") +
        (tone === "resource" ? "gb-card-action-button--resource " : "") +
        (tone === "positive" ? "gb-card-action-button--positive " : "")
      }
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onClick();
      }}
    >
      {children}
      <span className="gb-action-hover-label pointer-events-none absolute bottom-[calc(100%+0.18rem)] left-1/2 z-130 inline-flex -translate-x-1/2 items-center justify-center whitespace-nowrap rounded-[0.12rem] border border-[rgba(171,191,238,0.42)] bg-[linear-gradient(168deg,rgba(27,44,72,0.96),rgba(36,56,88,0.94))] px-[0.32rem] py-[0.18rem] text-[0.52rem] font-semibold uppercase tracking-[0.03em] text-[#dbe7ff] opacity-0 shadow-[inset_0_0_0_1px_rgba(209,224,255,0.08),0_8px_18px_rgba(3,8,20,0.45)] transition-opacity duration-120 group-hover/action:opacity-100 group-focus-visible/action:opacity-100">
        {label}
      </span>
    </button>
  );
}

export interface CardActionButtonsProps {
  card: CardInstance;
  zone: Zone;
  owner: CardSide;
  faceDown: boolean;
}

/** Hover controls on a board/hand card: reveal, hide, ping, auto-pay. */
export function CardActionButtons({ card, zone, owner, faceDown }: CardActionButtonsProps) {
  const interaction = useBoardInteractionOptional();
  const state = interaction?.slotProps.state;
  const canAct = !!interaction?.canAct && owner === "self";
  const strictLocked = !!interaction?.strictView && !interaction?.strictManual;
  const autoPay = useMemo(() => {
    if (!state || !interaction || zone !== "hand" || !canAct || strictLocked) return null;
    const index = state.players.findIndex((player) => player.id === interaction.viewerId);
    if (index < 0) return null;
    return buildAutoPayPaymentBatch(state, index, { purpose: "play", zone: "hand", cardId: card.id });
  }, [state, interaction, zone, canAct, card.id, strictLocked]);

  if (!interaction || !canAct) return null;

  const send = (intent: GameActionIntent) => {
    playBoardSound("card_click");
    interaction.sendIntent(intent);
  };

  const canReveal =
    !strictLocked &&
    (zone === "hand" ||
      (zone !== "runeArea" &&
        zone !== "legend" &&
        !faceDown &&
        (!!card.hidden || !!card.revealedToOpponent)));
  const revealed = !!card.revealedToOpponent;

  return (
    <div
      data-card-action-strip="true"
      className="absolute right-[0.08rem] top-[0.08rem] z-90 flex flex-col items-end gap-[0.12rem] opacity-0 transition-opacity duration-120 group-hover:opacity-100 group-focus-within:opacity-100"
    >
      {canReveal ? (
        <ActionButton
          label={revealed ? t("sim.hideFromOpponent") ?? "Hide from Opponent" : t("sim.revealToOpponent") ?? "Reveal to Opponent"}
          active={revealed}
          onClick={() =>
            send({
              type: "set_card_revealed_to_opponent",
              zone,
              cardId: card.id,
              revealed: !revealed,
            } as GameActionIntent)
          }
        >
          <EyeIcon off={revealed} />
        </ActionButton>
      ) : null}
      {(zone === "hand" || zone === "champion") && !faceDown && !strictLocked ? (
        <ActionButton
          label={card.hidden ? t("sim.reveal") ?? "Reveal" : t("sim.hide") ?? "Hide"}
          onClick={() =>
            send({
              type: "set_card_hidden",
              zone,
              cardId: card.id,
              hidden: !card.hidden,
            } as GameActionIntent)
          }
        >
          <EyeIcon off={!!card.hidden} />
        </ActionButton>
      ) : null}
      {autoPay ? (
        <ActionButton
          label={t("sim.autoPay") ?? "Auto Pay"}
          tone="resource"
          onClick={() => {
            playBoardSound("card_autopay");
            interaction.sendIntent(autoPay as GameActionIntent);
          }}
        >
          <CoinIcon />
        </ActionButton>
      ) : null}
      {zone !== "hand" && zone !== "runeArea" && !faceDown ? (
        <>
          {!strictLocked ? (
            <ActionButton
              label={t("sim.tablet.labels") ?? "Labels"}
              onClick={() => interaction.openLabelEditor({ zone, card, owner: "self" })}
            >
              <TagIcon />
            </ActionButton>
          ) : null}
          {!strictLocked ? (
            <ActionButton
              label={t("sim.tablet.counter") ?? "Counters"}
              onClick={() => interaction.openCounterEditor({ zone, card, owner: "self" })}
            >
              <CounterIcon />
            </ActionButton>
          ) : null}
        </>
      ) : null}
      <ActionButton
        label={t("sim.compactPing") ?? "Ping"}
        onClick={() => interaction.pingCard(card.id)}
      >
        <PingIcon />
      </ActionButton>
    </div>
  );
}
