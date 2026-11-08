"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";

import type { CardInstance } from "@rift/protocol";
import type { Card } from "@rift/cards";
import { getCardByName } from "@rift/cards";

import { CardArt } from "../../card/CardArt";

export const SETUP_FRAME_CLASS =
  "absolute inset-y-[0.28rem] left-[0.28rem] right-[var(--board-surface-overlay-right,0.28rem)] max-[1200px]:right-[0.28rem] overflow-hidden";

export const SETUP_PANEL_CLASS = `pointer-events-none z-45 select-none ${SETUP_FRAME_CLASS}`;

export const SETUP_PANEL_MOTION = {
  initial: { opacity: 0, scale: 0.992, y: 8 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.994, transition: { duration: 0.22, ease: [0.4, 0, 0.2, 1] } },
  transition: { duration: 0.34, ease: [0.22, 1, 0.36, 1] },
} as const;

export function SetupDimBackdrop({ visible }: { visible: boolean }) {
  return (
    <div className="pointer-events-none z-44 absolute inset-0" data-testid="setup-dim-overlay">
      <motion.div
        initial={false}
        animate={{ opacity: visible ? 1 : 0 }}
        transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
        className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(16,36,62,0.32),rgba(4,10,21,0.66))]"
      />
    </div>
  );
}

export function SetupHeading({ children }: { children: ReactNode }) {
  return (
    <div className="text-center max-[600px]:gap-2 max-[600px]:text-[0.68rem] max-[600px]:tracking-[0.08em] flex items-center gap-[0.62rem] text-[0.8rem] uppercase tracking-[0.14em] text-[#e8dcc1]">
      <span className="h-px w-[1.85rem] bg-[linear-gradient(90deg,rgba(200,176,130,0),rgba(200,176,130,0.88))]" />
      <span className="text-shadow-[0_1px_0_rgba(8,18,34,0.55)]">{children}</span>
      <span className="h-px w-[1.85rem] bg-[linear-gradient(90deg,rgba(200,176,130,0.88),rgba(200,176,130,0))]" />
    </div>
  );
}

export const SETUP_HEADING_BAND_CLASS =
  "rounded-none border border-[rgba(199,176,131,0.62)] bg-[linear-gradient(145deg,rgba(16,40,74,0.96),rgba(6,18,38,0.95))] px-[1.22rem] py-[0.52rem] shadow-[inset_0_0_0_1px_rgba(232,214,176,0.18),0_12px_28px_rgba(2,8,19,0.58)]";

export const SETUP_PRIMARY_BUTTON_CLASS =
  "min-w-[8.6rem] cursor-pointer rounded-none border border-[rgba(224,194,135,0.84)] bg-[linear-gradient(180deg,rgba(34,79,127,0.98),rgba(10,34,68,0.98))] text-[#fff0d2] text-[0.76rem] uppercase tracking-[0.09em] py-[0.42rem] px-[0.8rem] shadow-[inset_0_0_0_1px_rgba(246,223,176,0.16),0_8px_18px_rgba(3,10,22,0.45)] transition-[transform,box-shadow,border-color,background] duration-140 hover:-translate-y-px hover:border-[rgba(243,214,157,0.96)] hover:bg-[linear-gradient(180deg,rgba(42,93,144,1),rgba(12,39,77,1))] hover:shadow-[inset_0_0_0_1px_rgba(255,234,191,0.26),0_10px_22px_rgba(3,10,22,0.5)] active:translate-y-0 active:shadow-[inset_0_0_0_1px_rgba(255,234,191,0.18),0_6px_14px_rgba(3,10,22,0.42)] disabled:opacity-[0.56] disabled:cursor-default disabled:transform-none";

export const SETUP_GREEN_CHIP_CLASS =
  "inline-flex min-w-[8.6rem] items-center justify-center rounded-none border border-[rgba(110,215,177,0.5)] text-[#8ff6d3] bg-[rgba(20,73,63,0.62)] py-[0.42rem] px-[0.8rem] text-[0.76rem] uppercase tracking-[0.09em]";

export const SETUP_RANDOM_BUTTON_CLASS =
  "pointer-events-auto inline-flex h-8 items-center justify-center gap-1.5 rounded-none border border-[rgba(132,150,184,0.32)] bg-[rgba(8,14,24,0.72)] px-3 text-[0.68rem] font-medium uppercase tracking-[0.08em] text-[#eef3fa] shadow-[0_8px_18px_rgba(3,10,22,0.28)] transition hover:border-[rgba(139,222,189,0.62)] hover:bg-[rgba(18,38,36,0.86)] focus-visible:border-[rgba(139,222,189,0.84)] focus-visible:outline-none disabled:cursor-default disabled:opacity-50";

export function catalogCardInstance(name: string, source: CardInstance["source"] = "battlefield"): CardInstance | null {
  const card = getCardByName(name);
  if (!card) return null;
  return cardToInstance(card, source);
}

export function cardToInstance(card: Card, source: CardInstance["source"] = "battlefield"): CardInstance {
  return {
    id: card.id,
    name: card.name,
    source,
    exhausted: false,
    createdAt: 0,
    cardCode: card.id,
    imageUrl: card.imageUrl,
    type: card.type,
    text: card.text,
    energyCost: card.energyCost,
    powerCost: card.powerCost,
    might: card.might,
    domains: card.domains,
    keywords: card.keywords,
    rarity: card.rarity,
    set: card.set,
  };
}

/** Battlefield draft art, rotated landscape like the original marker. */
export function BattlefieldDraftArt({
  name,
  className,
  profile = "battlefieldDraft",
}: {
  name: string;
  className?: string;
  profile?: "battlefieldDraft" | "preview" | "hand";
}) {
  const card = catalogCardInstance(name);
  if (!card) {
    return (
      <div className="grid h-full w-full place-items-center bg-[linear-gradient(145deg,rgba(47,90,132,0.92),rgba(17,37,66,0.98))] px-2 text-center text-[0.68rem] font-semibold text-[#dbe7ff]">
        {name}
      </div>
    );
  }
  return (
    <div className="absolute inset-0">
      <CardArt card={card} profile={profile} className={className ?? "h-full w-full object-contain"} alt={name} />
    </div>
  );
}

export function SetupRosterStrip({
  label,
  children,
  testId,
}: {
  label: string;
  children: ReactNode;
  testId?: string;
}) {
  return (
    <div
      role="status"
      aria-atomic="false"
      aria-live="polite"
      aria-label={label}
      data-testid={testId}
      className="pointer-events-none relative flex min-w-0 flex-1 items-stretch rounded-[0.16rem] border border-[rgba(132,150,184,0.28)] bg-[rgba(7,13,23,0.7)]"
    >
      {children}
    </div>
  );
}
