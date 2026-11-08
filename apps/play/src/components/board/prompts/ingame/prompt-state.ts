/**
 * Pure derivations for the in-game conquer / showdown prompt (module 487939 UI
 * side: `35qz5rkx7yexy.js:56900-57560`). The action itself is always
 * `battlefield_conquer_confirm`; this only chooses the label and which seat can act.
 */

import { VARIANT_RULES } from "@rift/engine";
import type { BattlefieldZone, Room, RoomPlayer } from "@rift/protocol";

export interface ConquerPromptModel {
  zone: BattlefieldZone;
  stage: "attacker_focus" | "defender_response" | "attacker_confirm_conquer";
  attacker: RoomPlayer;
  defender: RoomPlayer | undefined;
  actorId: string;
  viewerIsActor: boolean;
  headline: string;
  instruction: string;
  detail: string;
  primaryLabel: string;
  secondaryLabel: string | null;
  primaryAction: "pass_focus" | "pass_response" | "conquer";
  secondaryAction: "pass_focus" | null;
  tone: "focus" | "response" | "conquer" | "waiting";
  canDismiss: boolean;
  attackerMight: number;
  defenderMight: number;
  conquerKind: "conquer" | "conquer_and_score" | "conquer_and_draw";
}

export function unitMight(card: { might?: number; temporaryMightBuff?: number; whiteCounter?: number }): number {
  if (typeof card.whiteCounter === "number" && card.whiteCounter > 0) return card.whiteCounter;
  return Math.max(0, (card.might ?? 0) + (card.temporaryMightBuff ?? 0));
}

export function mightAt(room: Room, playerId: string, zone: BattlefieldZone): number {
  const player = room.players.find((candidate) => candidate.id === playerId);
  const cards = (player?.board?.[zone] as Array<{ might?: number; temporaryMightBuff?: number; whiteCounter?: number; type?: string; hidden?: boolean }> | undefined) ?? [];
  return cards
    .filter((card) => !card.hidden && (!card.type || /unit/i.test(card.type)))
    .reduce((sum, card) => sum + unitMight(card), 0);
}

export function conquerKind(room: Room, attackerPlayerId: string, zone: BattlefieldZone): ConquerPromptModel["conquerKind"] {
  const scored = room.battlefieldScoredThisTurnByPlayer?.[attackerPlayerId]?.[zone];
  if (scored && room.battlefieldScoredThisTurnByPlayer?.[attackerPlayerId]?.turnNumber === room.turnNumber) {
    return "conquer";
  }
  const player = room.players.find((candidate) => candidate.id === attackerPlayerId);
  const score = player?.board?.score ?? 0;
  const variant = room.gameVariant ?? "duel";
  const victory = VARIANT_RULES[variant]?.victoryScore ?? 8;
  if (score >= victory - 1) return "conquer_and_draw";
  return "conquer_and_score";
}

export function deriveConquerPrompt(
  room: Room,
  viewerId: string,
  translate: (key: string, params?: Record<string, string | number>) => string | null,
): ConquerPromptModel | null {
  const assist = room.pendingBattlefieldConquerAssist;
  if (!assist) return null;
  const attacker = room.players.find((player) => player.id === assist.attackerPlayerId);
  const defender = room.players.find(
    (player) => player.id === (assist.actualDefenderPlayerId ?? assist.defenderPlayerId),
  );
  if (!attacker || !attacker.board) return null;
  const stage =
    assist.stage === "defender_response" || assist.stage === "attacker_focus"
      ? assist.stage
      : "attacker_confirm_conquer";
  const actorId =
    stage === "defender_response" ? (defender?.id ?? assist.defenderPlayerId) : assist.attackerPlayerId;
  const viewerIsActor = viewerId === actorId;
  const kind = conquerKind(room, attacker.id, assist.zone);
  let primaryLabel =
    kind === "conquer_and_draw"
      ? (translate("sim.conquerDraw") ?? "Conquer + Draw")
      : kind === "conquer"
        ? (translate("sim.conquer") ?? "Conquer")
        : (translate("sim.conquerScore") ?? "Conquer + Score");
  const attackerName = attacker.name;
  const defenderName = defender?.name ?? "";
  const headline = defender
    ? (translate("sim.showdownVersus", { attacker: attackerName, defender: defenderName }) ??
      `${attackerName} vs ${defenderName}`)
    : (translate("sim.showdownCanConquer", { attacker: attackerName }) ?? `${attackerName} can conquer`);
  let instruction = "";
  let primaryAction: ConquerPromptModel["primaryAction"] = "conquer";
  let secondaryLabel: string | null = null;
  let secondaryAction: ConquerPromptModel["secondaryAction"] = null;
  let tone: ConquerPromptModel["tone"] = "focus";
  let canDismiss = false;
  if (stage === "attacker_focus") {
    primaryAction = "pass_focus";
    instruction = viewerIsActor
      ? (translate("sim.addToChainOrPass") ?? "Add to Chain or pass.")
      : (translate("sim.waitingForPlayerSentence", { playerName: attackerName }) ??
        `Waiting for ${attackerName}.`);
    tone = "focus";
  } else if (stage === "defender_response") {
    primaryAction = "pass_response";
    primaryLabel = translate("sim.endShowdown") ?? "End Showdown";
    secondaryLabel = translate("sim.passFocus") ?? "Pass Focus";
    secondaryAction = "pass_focus";
    instruction = viewerIsActor
      ? (translate("sim.respondEndOrPass") ?? "Respond, end the showdown or pass focus.")
      : (translate("sim.waitingForPlayerSentence", { playerName: defenderName }) ??
        `Waiting for ${defenderName}.`);
    tone = "response";
  } else {
    primaryAction = "conquer";
    instruction = viewerIsActor
      ? (translate("sim.conquerOrPassFocus") ?? "Conquer or pass focus.")
      : (translate("sim.mustConfirmConquer", { playerName: attackerName }) ??
        `${attackerName} must confirm conquer`);
    secondaryLabel = translate("sim.passFocus") ?? "Pass Focus";
    secondaryAction = "pass_focus";
    tone = "conquer";
    canDismiss = true;
  }
  return {
    zone: assist.zone,
    stage,
    attacker,
    defender,
    actorId,
    viewerIsActor,
    headline,
    instruction,
    detail: defender
      ? `${headline}. ${instruction}`
      : `${headline}. ${instruction}`,
    primaryLabel,
    secondaryLabel,
    primaryAction,
    secondaryAction,
    tone,
    canDismiss,
    attackerMight: mightAt(room, attacker.id, assist.zone),
    defenderMight: defender ? mightAt(room, defender.id, assist.zone) : 0,
    conquerKind: kind,
  };
}
