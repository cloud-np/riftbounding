"use client";

import type { CardInstance, Room, RoomPlayer } from "@rift/protocol";
import { createTranslator } from "@rift/i18n";

import type { CardEventHandler, CardSide } from "../card/types";
import { GameCard } from "../card/GameCard";
import { groupAttachedCards } from "../card/attachments";
import { useBoardInteractionOptional } from "../interaction/context";
import { hideDropZones } from "../strict/strict-interaction";
import { TokenPanel } from "../tokens/TokenPanel";
import { cardImageUrl } from "@/lib/assets";
import { useAnimationLevel } from "../theme/motion";
import { battlefieldState, type BattlefieldControlState } from "./battlefield-state";
import { BattlefieldCorners } from "./BattlefieldFrame";
import { SafeImg } from "../card/SafeImg";

const t = createTranslator("en");

export interface BattlefieldInfo {
  zone: "battlefieldA" | "battlefieldB" | "battlefieldC" | "battlefieldToken";
  name: string;
  cardCode?: string;
  title?: string;
  brush?: boolean;
}

type SlotKind = "own" | "token" | "opponent" | "supplemental";

export interface BattlefieldLayout {
  slotKinds: SlotKind[];
  visibleSlotKinds: SlotKind[];
  normalBattlefieldCount: number;
  visibleColumnCount: number;
  gridTemplateColumns: string;
  columnGapRem: number;
}

/** `ps` slot layout (module 430427, ~43521). */
export function computeBattlefieldLayout(options: {
  supplementalVisible: boolean;
  tokenVisible: boolean;
  compactColumns?: string | null;
}): BattlefieldLayout {
  const { supplementalVisible, tokenVisible } = options;
  if (supplementalVisible) {
    const slotKinds: SlotKind[] = tokenVisible
      ? ["own", "opponent", "supplemental", "token"]
      : ["own", "opponent", "supplemental"];
    return {
      slotKinds,
      visibleSlotKinds: [...slotKinds],
      normalBattlefieldCount: 3,
      visibleColumnCount: tokenVisible ? 4 : 3,
      gridTemplateColumns: options.compactColumns ?? `repeat(${slotKinds.length}, minmax(0, 1fr))`,
      columnGapRem: tokenVisible ? 0.18 : 0.24,
    };
  }
  return {
    slotKinds: ["own", "token", "opponent"],
    visibleSlotKinds: tokenVisible ? ["own", "token", "opponent"] : ["own", "opponent"],
    normalBattlefieldCount: 2,
    visibleColumnCount: tokenVisible ? 3 : 2,
    gridTemplateColumns:
      options.compactColumns ??
      (tokenVisible
        ? "minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)"
        : "minmax(0,1fr) minmax(0,0fr) minmax(0,1fr)"),
    columnGapRem: 0.24,
  };
}

/**
 * Battlefield art. The CDN image is optional: it stays hidden until it has really loaded (see
 * SafeImg), so when it is missing or blocked the procedural gradient + sigil stands in and no
 * broken-image glyph or alt text is ever visible. `variant="bg"` is the faded panel backdrop.
 */
function MarkerArt({
  info,
  card,
  variant = "marker",
}: {
  info: BattlefieldInfo;
  card: CardInstance;
  variant?: "marker" | "bg";
}) {
  const isBg = variant === "bg";
  return (
    <>
      <div data-marker-fallback="true" className="bf-marker-art absolute inset-0">
        <svg viewBox="0 0 100 72" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <g fill="none" stroke="currentColor" strokeWidth="0.6" opacity="0.55">
            <circle cx="50" cy="32" r="22" />
            <circle cx="50" cy="32" r="15" strokeDasharray="1.6 2.2" />
            <path d="M50 8 L56 32 L50 56 L44 32 Z" />
            <path d="M26 32 L50 26 L74 32 L50 38 Z" />
          </g>
        </svg>
        {isBg ? null : (
          <div className="absolute inset-x-0 bottom-[0.14rem] px-[0.2rem] text-center">
            <strong className="bf-marker-name block truncate text-[0.46rem] leading-[1.15]">{info.name}</strong>
          </div>
        )}
      </div>
      {info.cardCode ? (
        <SafeImg
          alt={isBg ? "" : info.name}
          aria-hidden={isBg ? true : undefined}
          src={cardImageUrl(card, "preview")}
          loading="eager"
          decoding="async"
          draggable={false}
          className="absolute inset-0 h-full w-full select-none object-cover"
        />
      ) : null}
    </>
  );
}

function markerCard(info: BattlefieldInfo): CardInstance {
  return {
    id: `battlefield-marker:${info.zone}`,
    name: info.name,
    source: "battlefield",
    exhausted: false,
    createdAt: 0,
    cardCode: info.cardCode,
    type: "Battlefield",
    isPlaceholder: !info.cardCode,
  };
}

function BattlefieldMarker({
  info,
  onCardEvent,
  side,
}: {
  info: BattlefieldInfo;
  onCardEvent?: CardEventHandler;
  side: CardSide;
}) {
  const interaction = useBoardInteractionOptional();
  const card: CardInstance = {
    id: `battlefield-marker:${info.zone}`,
    name: info.name,
    source: "battlefield",
    exhausted: false,
    createdAt: 0,
    cardCode: info.cardCode,
    type: "Battlefield",
    isPlaceholder: !info.cardCode,
  };
  return (
    <div
      className="gb-card-action-hover-scope group bf-marker absolute top-1/2 z-2 overflow-visible rounded-[0.48rem] border border-transparent bg-transparent shadow-none isolate [&_strong]:text-[#dbe7ff] [&_strong]:text-(length:--card-battlefield-title-size) [&_strong]:leading-[1.15] gb-local-board-hover-tone"
      data-hover-preview-anchor="true"
      data-card-id={`battlefield-marker:${info.zone}`}
      data-drop-zone={info.zone}
      data-battlefield-marker={info.zone}
      data-strict-prompt-hover={
        interaction?.strictPromptHoverId === info.zone ? "true" : undefined
      }
      data-preview-landscape="true"
      data-preview-rotation="0"
      draggable={!!interaction?.canAct}
      onDragStart={(event) => {
        if (!interaction?.canAct) {
          event.preventDefault();
          return;
        }
        interaction.handleBattlefieldMarkerDragStart(info.zone, side, event);
      }}
      onDragEnd={() => interaction?.handleCardDragEnd()}
      onPointerEnter={(event) => {
        if (event.pointerType !== "mouse" && event.pointerType) return;
        interaction?.showCardPreview(card, event.currentTarget, { landscape: true });
      }}
      onPointerLeave={() => interaction?.hideCardPreview()}
      onClick={(event) => {
        interaction?.handleBattlefieldMarkerPress(info.zone, side, event);
      }}
      onContextMenu={(event) => {
        if (!interaction) return;
        event.preventDefault();
        event.stopPropagation();
        interaction.handleBattlefieldMarkerPress(info.zone, side, event);
      }}
      style={{
        left: "0.34rem",
        width: "var(--bf-marker-w)",
        height: "auto",
        aspectRatio: "1.39286 / 1",
        marginTop: "calc(-0.358974 * var(--bf-marker-w))",
      }}
    >
      <div className="absolute inset-px isolate">
        <div className="relative w-full h-full rounded-[0.48rem] overflow-visible">
          <div className="absolute inset-0 rounded-[0.48rem] overflow-hidden bg-[linear-gradient(160deg,#1a2b48,#0b1424)]">
            <div className="absolute rounded-[inherit] overflow-hidden pointer-events-none" style={{ inset: "1px" }}>
              <div className="absolute inset-0">
                <MarkerArt info={info} card={card} />
              </div>
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.76)_0%,rgba(0,0,0,0.58)_14%,rgba(0,0,0,0)_25%,rgba(0,0,0,0)_75%,rgba(0,0,0,0.58)_86%,rgba(0,0,0,0.76)_100%)]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function BattlefieldPanel({
  info,
  owner,
  ownCards,
  opponentCards,
  onCardEvent,
  selectedCardIds,
  targetableCardIds,
  state,
}: {
  state: BattlefieldControlState;
  info: BattlefieldInfo;
  owner: CardSide;
  ownCards: CardInstance[];
  opponentCards: CardInstance[];
  onCardEvent?: CardEventHandler;
  selectedCardIds?: Set<string>;
  targetableCardIds?: Set<string>;
}) {
  const total = ownCards.length + opponentCards.length;
  const animationLevel = useAnimationLevel();
  const interaction = useBoardInteractionOptional();
  const ownDrop = interaction?.getDropZoneHandlers(info.zone, "self");
  const opponentDrop = interaction?.getDropZoneHandlers(info.zone, "opponent");
  const ownGroups = groupAttachedCards(ownCards);
  const opponentGroups = groupAttachedCards(opponentCards);
  const draggedCardId = interaction?.drag.active ? interaction.drag.sourceCardId : null;
  const hideLocations = hideDropZones(
    interaction?.strictView?.legal.hideable,
    draggedCardId,
  );
  const showHidePocket = hideLocations.has(info.zone);
  return (
    <section
      data-bf-state={state}
      data-bf-zone={info.zone}
      data-bf-motion={animationLevel}
      data-might-border="true"
      data-board-drag-active="false"
      data-ghost-zone="false"
      data-buff-action-armed="false"
      data-play-hidden-selecting={showHidePocket ? "true" : "false"}
      className="gb-board-layer bf-panel min-h-0 h-full relative rounded-[0.5rem] bg-transparent p-[0.16rem]"
    >
      <span aria-hidden="true" className="battlefield-border-line" />
      <div aria-hidden="true" data-bf-backdrop="true" className="bf-backdrop pointer-events-none absolute inset-0 overflow-hidden rounded-[0.5rem]">
        <MarkerArt info={info} card={markerCard(info)} variant="bg" />
      </div>
      <BattlefieldCorners />
      <span className="bf-nameplate" data-bf-nameplate="true">
        <span className="bf-nameplate-gem" aria-hidden="true" />
        <span className="bf-nameplate-text">{info.name}</span>
      </span>
      <BattlefieldMarker info={info} onCardEvent={onCardEvent} side={owner} />
      <span className="bf-count absolute right-[0.34rem] top-[0.34rem] z-6">
        {total}
      </span>
      {showHidePocket && interaction ? (
        <div
          {...interaction.getHideDropZoneHandlers(info.zone, "self")}
          data-testid="strict-hide-pocket"
          data-hide-zone={info.zone}
          title={
            t("rules.ui.hideDropHint") ??
            "Drop here to hide; or hold Alt while dropping on the battlefield"
          }
          className="pointer-events-auto absolute bottom-[0.36rem] left-1/2 z-40 flex -translate-x-1/2 items-center gap-[0.24rem] whitespace-nowrap rounded-[0.22rem] border border-dashed border-[rgba(177,149,244,0.72)] bg-[rgba(31,24,51,0.94)] px-[0.38rem] py-[0.22rem] text-[0.56rem] font-bold uppercase tracking-[0.04em] text-[#e6dcff] shadow-[0_6px_16px_rgba(3,8,18,0.48)]"
        >
          <span aria-hidden="true">◈</span>
          <span>{t("rules.ui.hidePocket") ?? "Hide (facedown)"}</span>
          <span className="text-[0.5rem] font-semibold normal-case text-[#c2b2ea]">
            {t("rules.ui.hideCost") ?? "Cost: [A]"}
          </span>
        </div>
      ) : null}
      <button
        type="button"
        aria-label={`Add a card to ${info.name}`}
        className="bf-add-button absolute left-[-0.72rem] top-1/2 z-20 grid h-[1.1rem] w-[1.1rem] -translate-y-1/2 place-items-center"
      >
        +
      </button>
      <div
        data-battlefield-card-rows="true"
        className="bf-rows min-h-0 relative grid grid-rows-2 gap-[0.12rem] h-full pt-[0.36rem] pb-[0.36rem] overflow-visible"
      >
        <div
          data-drop-zone-root={info.zone}
          data-zone-owner="opponent"
          style={{ ["--bf-n" as string]: Math.max(1, opponentGroups.topLevel.length) }}
          className="bf-lane min-h-0 relative rounded-[0.08rem] bg-transparent py-[0.16rem] px-[0.2rem] flex items-start overflow-visible shadow-none justify-center before:content-[''] before:absolute before:inset-0 before:rounded-[inherit] before:border-none before:bg-transparent before:z-0 before:pointer-events-none"
          {...opponentDrop}
        >
          {opponentGroups.topLevel.map((card) => (
            <GameCard
              key={card.id}
              card={card}
              zone={info.zone}
              owner="opponent"
              profile="board"
              exhausted={card.exhausted}
              faceDown={card.hidden || card.isPlaceholder}
              labels={card.customLabels}
              attachedCards={opponentGroups.byHostId.get(card.id)}
              selected={selectedCardIds?.has(card.id)}
              targetable={targetableCardIds?.has(card.id)}
              onCardEvent={onCardEvent}
              readOnly={!onCardEvent}
            />
          ))}
        </div>
        <div
          data-drop-zone-root={info.zone}
          data-zone-owner="self"
          style={{ ["--bf-n" as string]: Math.max(1, ownGroups.topLevel.length) }}
          className="bf-lane min-h-0 relative rounded-[0.08rem] bg-transparent py-[0.16rem] px-[0.2rem] flex items-end overflow-visible shadow-none justify-center before:content-[''] before:absolute before:inset-0 before:rounded-[inherit] before:border-none before:bg-transparent before:z-0 before:pointer-events-none"
          {...ownDrop}
        >
          <div className="absolute right-[0.16rem] bottom-[0.12rem] z-40">
            <TokenPanel zone={info.zone} owner="self" />
          </div>
          {ownGroups.topLevel.map((card) => (
            <GameCard
              key={card.id}
              card={card}
              zone={info.zone}
              owner="self"
              profile="board"
              exhausted={card.exhausted}
              faceDown={card.hidden || card.isPlaceholder}
              labels={card.customLabels}
              attachedCards={ownGroups.byHostId.get(card.id)}
              selected={selectedCardIds?.has(card.id)}
              targetable={targetableCardIds?.has(card.id)}
              onCardEvent={onCardEvent}
              readOnly={!onCardEvent}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

export interface BattlefieldLayerProps {
  room: Room;
  viewer: RoomPlayer;
  opponents: RoomPlayer[];
  battlefields: {
    own?: BattlefieldInfo;
    opponent?: BattlefieldInfo;
    supplemental?: BattlefieldInfo;
    token?: BattlefieldInfo;
  };
  onCardEvent?: CardEventHandler;
  compactColumns?: string | null;
  selectedCardIds?: Set<string>;
  targetableCardIds?: Set<string>;
}

export function BattlefieldLayer({
  room,
  viewer,
  opponents,
  battlefields,
  onCardEvent,
  compactColumns,
  selectedCardIds,
  targetableCardIds,
}: BattlefieldLayerProps) {
  const supplementalVisible = !!battlefields.supplemental;
  const tokenVisible = !!battlefields.token || !!room.sharedBattlefieldToken?.active;
  const layout = computeBattlefieldLayout({
    supplementalVisible,
    tokenVisible,
    compactColumns,
  });
  const infoFor = (kind: SlotKind): BattlefieldInfo | null => {
    if (kind === "own") return battlefields.own ?? null;
    if (kind === "opponent") return battlefields.opponent ?? null;
    if (kind === "supplemental") return battlefields.supplemental ?? null;
    return (
      battlefields.token ??
      (tokenVisible
        ? {
            zone: "battlefieldToken",
            name: room.sharedBattlefieldToken?.title ?? "Baron Pit",
            title: room.sharedBattlefieldToken?.title,
          }
        : null)
    );
  };

  const zoneFor = (kind: SlotKind) => {
    if (kind === "own") return "battlefieldA" as const;
    if (kind === "opponent") return "battlefieldB" as const;
    if (kind === "supplemental") return "battlefieldC" as const;
    return "battlefieldToken" as const;
  };

  return (
    <div
      data-battlefield-surface="true"
      data-normal-battlefield-count={layout.normalBattlefieldCount}
      data-battlefield-column-count={layout.visibleColumnCount}
      data-battlefield-slot-order={layout.slotKinds.join(" ")}
      className="absolute left-(--battlefield-side-gap) right-(--battlefield-side-gap) top-(--battlefield-top-inset) bottom-(--battlefield-bottom-inset) z-7 grid pointer-events-auto transition-[grid-template-columns,top,bottom] duration-280 ease-[cubic-bezier(0.2,0.7,0.2,1)]"
      style={{ gridTemplateColumns: layout.gridTemplateColumns, columnGap: `${layout.columnGapRem}rem` }}
    >
      {layout.slotKinds.map((kind) => {
        const visible = layout.visibleSlotKinds.includes(kind);
        const info = infoFor(kind);
        const zone = zoneFor(kind);
        const ownCards = viewer.board?.[zone] ?? [];
        const oppCards = opponents.flatMap((player) => player.board?.[zone] ?? []);
        return (
          <div
            key={kind}
            data-battlefield-surface-slot={kind}
            data-battlefield-visible={visible}
            className="relative z-1 min-h-0 min-w-0 h-full overflow-visible"
            style={!visible ? { pointerEvents: "none" } : undefined}
          >
            {visible && info ? (
              <div className="min-h-0 min-w-0 h-full" style={{ opacity: 1, transform: "none" }}>
                <BattlefieldPanel
                  state={battlefieldState({ room, viewer, zone, ownCards, opponentCards: oppCards })}
                  info={info}
                  owner={kind === "opponent" ? "opponent" : "self"}
                  ownCards={ownCards}
                  opponentCards={oppCards}
                  onCardEvent={onCardEvent}
                  selectedCardIds={selectedCardIds}
                  targetableCardIds={targetableCardIds}
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
