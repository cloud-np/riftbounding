"use client";

/**
 * Board customization provider — resolves each seat from
 * `identity.boardCustomization` and applies the opponent-cosmetics dim.
 */
import { createContext, useContext, useMemo } from "react";
import type { ReactNode } from "react";

import type { Room } from "@rift/protocol";

import { useLocalGameSettings } from "../settings/settings-values";
import {
  dimBoardCustomization,
  resolveBoardCustomization,
  type RuntimeCustomization,
} from "./customization-resolve";

export {
  dimBoardCustomization,
  resolveBoardCustomization,
  sleeveForSlot,
  tokenArtForName,
} from "./customization-resolve";
export type {
  RuntimeCustomization,
  RuntimePlaymat,
  RuntimeSleeve,
} from "./customization-resolve";

interface CustomizationContextValue {
  viewerId: string;
  byPlayerId: Readonly<Record<string, RuntimeCustomization>>;
  self: RuntimeCustomization;
  opponent: RuntimeCustomization;
}

const CustomizationContext = createContext<CustomizationContextValue | null>(null);

export function BoardCustomizationProvider({
  room,
  viewerId,
  children,
}: {
  room: Room;
  viewerId: string;
  children: ReactNode;
}) {
  const settings = useLocalGameSettings();
  const value = useMemo<CustomizationContextValue>(() => {
    const byPlayerId: Record<string, RuntimeCustomization> = {};
    for (const player of room.players) {
      const resolved = resolveBoardCustomization(player.identity?.boardCustomization);
      byPlayerId[player.id] =
        player.id === viewerId
          ? resolved
          : dimBoardCustomization(resolved, settings.opponentCosmeticsPercent);
    }
    return {
      viewerId,
      byPlayerId,
      self: byPlayerId[viewerId] ?? {},
      opponent:
        byPlayerId[room.players.find((player) => player.id !== viewerId)?.id ?? ""] ?? {},
    };
  }, [room.players, settings.opponentCosmeticsPercent, viewerId]);

  return <CustomizationContext.Provider value={value}>{children}</CustomizationContext.Provider>;
}

export function useBoardCustomization(): CustomizationContextValue {
  return (
    useContext(CustomizationContext) ?? {
      viewerId: "",
      byPlayerId: {},
      self: {},
      opponent: {},
    }
  );
}

export function usePlayerCustomization(playerId: string | null | undefined): RuntimeCustomization {
  const context = useBoardCustomization();
  if (!playerId) return context.self;
  return context.byPlayerId[playerId] ?? {};
}
