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
        className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(6,6,7,0.45),rgba(6,6,7,0.78))]"
      />
    </div>
  );
}

export function SetupHeading({ children }: { children: ReactNode }) {
  return (
    <div
      className="text-center max-[600px]:gap-2 max-[600px]:text-[1.1rem] flex items-center gap-4 text-[1.5rem] font-semibold tracking-[0.03em] text-[var(--rb-gold-bright,#f0d48a)]"
      style={{ fontFamily: "var(--font-heading), ui-serif, Georgia, serif" }}
    >
      <span className="h-px w-[2.4rem] bg-[linear-gradient(90deg,rgba(200,170,110,0),rgba(200,170,110,0.9))]" />
      <span>{children}</span>
      <span className="h-px w-[2.4rem] bg-[linear-gradient(90deg,rgba(200,170,110,0.9),rgba(200,170,110,0))]" />
    </div>
  );
}

export const SETUP_HEADING_BAND_CLASS =
  "rounded-[0.7rem] border border-[var(--rb-border-strong,rgba(200,170,110,0.45))] bg-[var(--rb-surface,#0e0f12)] px-8 py-3 shadow-[0_0_0_1px_rgba(0,0,0,0.6),0_18px_44px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(240,212,138,0.14)]";

export const SETUP_PRIMARY_BUTTON_CLASS =
  "min-h-12 min-w-[10rem] cursor-pointer rounded-[0.4rem] border border-[var(--rb-gold,#c8aa6e)] bg-[linear-gradient(180deg,#d9bd7f,#b08f4c)] px-6 py-2 text-base font-semibold text-[#15110a] shadow-[0_2px_10px_rgba(0,0,0,0.5)] transition-[filter,transform] duration-150 enabled:hover:brightness-110 enabled:active:translate-y-px disabled:cursor-default disabled:opacity-50";

export const SETUP_GREEN_CHIP_CLASS =
  "inline-flex min-h-12 min-w-[10rem] items-center justify-center rounded-[0.4rem] border border-[rgba(110,215,177,0.55)] bg-[#10261f] px-6 py-2 text-base font-semibold text-[#8ff6d3]";

export const SETUP_RANDOM_BUTTON_CLASS =
  "pointer-events-auto inline-flex min-h-12 items-center justify-center gap-2 rounded-[0.4rem] border border-[var(--rb-border-strong,rgba(200,170,110,0.45))] bg-[var(--rb-surface-2,#15171b)] px-6 text-base font-semibold text-[var(--rb-text,#ece6da)] shadow-[0_2px_10px_rgba(0,0,0,0.5)] transition-[border-color,background-color] duration-150 hover:border-[var(--rb-gold-bright,#f0d48a)] hover:bg-[#1d2026] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--rb-gold-bright,#f0d48a)] disabled:cursor-default disabled:opacity-50";

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
      <div className="grid h-full w-full place-items-center bg-[linear-gradient(145deg,rgba(47,90,132,0.92),rgba(17,37,66,0.98))] px-2 text-center text-base font-semibold text-[#dbe7ff]">
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
      className="pointer-events-none relative flex min-w-0 flex-1 items-stretch rounded-[0.16rem] border border-[var(--rb-border-strong,rgba(200,170,110,0.45))] bg-[var(--rb-surface,#0e0f12)]"
    >
      {children}
    </div>
  );
}
