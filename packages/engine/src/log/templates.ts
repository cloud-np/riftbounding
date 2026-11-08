/**
 * Canonical English game-log sentences (server-side output in the original).
 *
 * The client parses these exact strings back into `{key, params}` and re-renders them in
 * the viewer's locale (0aed5y6vhcy22.js). Keep the strings byte-identical to
 * `.recon/specs/game-log-en.json`; the structured `key`/`params` are attached alongside
 * `text` for @rift/i18n.
 */
import type { ActionKind } from "../types";

type ParamValue = string | number | null | undefined;
type Params = Record<string, ParamValue>;

export const SENTENCE_TEMPLATES: Record<string, string> = {
  acceptedSkipSideboarding: "Accepted the request to skip sideboarding.",
  addedLegendWithNeeko: "added {card} to their legend area with Neeko.",
  adjustedFloatingResource: "adjusted floating {resource} to {value}.",
  adjustedFloatingResources: "adjusted floating resources to {energy} energy and {power} power.",
  adjustedScore: "adjusted score to {score}.",
  allBattlefieldsLockedMulligan:
    "all {count} battlefields are locked. All players may mulligan up to 2 cards.",
  allBattlefieldsLockedSideboard: "all {count} battlefields are locked. All players now sideboard.",
  allChampionsLockedMulligan:
    "All champions are locked. All players may mulligan up to 2 cards.",
  allMulligansComplete: "All mulligans are complete. Starting the game.",
  allRegistrationsLockedMulligan:
    "all {format} registrations are locked. All players may mulligan up to 2 cards.",
  allSideboardsAutoLockedChooseBattlefields:
    "All sideboards were auto-locked. Choose battlefields.",
  allSideboardsAutoLockedMulligan:
    "All sideboards were auto-locked. All players may mulligan up to 2 cards.",
  allSideboardsLockedMulligan: "All sideboards are locked. All players may mulligan up to 2 cards.",
  allSkippedSideboardingChooseBattlefields:
    "All players agreed to skip sideboarding. Their submitted decks were restored. Choose battlefields.",
  allSkippedSideboardingMulligan:
    "All players agreed to skip sideboarding. Their submitted decks were restored. All players may mulligan up to 2 cards.",
  appliedBuff: "applied buff to {card}.",
  autoPaid: "Auto-paid.",
  autoPaidCardCosts: "Auto-paid card costs.",
  autoSelectedLastBattlefield: "Auto-selected the last remaining battlefield.",
  autoStartedTestSetup: "Auto-started test setup.",
  banishedFromChain: "banished {card} from chain.",
  banishedTopCard: "banished {card} from the top of their deck.",
  banishedTopCardWith: "banished {card} from the top of their deck with {source}.",
  banishedWithSource: "banished {card} with {source}.",
  battlefieldsLockedRollD20: "Both battlefields are locked. Roll a d20 to decide first player.",
  bothChampionsLockedMulligan: "Both champions are locked. Mulligan up to 2 cards.",
  bothMulligansComplete: "Both mulligans are complete. Starting the game.",
  bothRegistrationsLockedChoose:
    "both {format} registrations are locked. Each player should now choose one battlefield.",
  bothRegistrationsLockedChooseUnused:
    "both {format} registrations are locked. Each player should now choose one unused battlefield.",
  bothRegistrationsLockedMulligan:
    "both {format} registrations are locked. Mulligan up to 2 cards.",
  bothSideboardsAutoLockedChooseBattlefields:
    "Both sideboards were auto-locked. Choose battlefields.",
  bothSideboardsAutoLockedMulligan: "Both sideboards were auto-locked. Mulligan up to 2 cards.",
  bothSideboardsLockedChooseBattlefield:
    "Both sideboards are locked. Each player should now choose one battlefield.",
  bothSideboardsLockedChooseUnusedBattlefield:
    "Both sideboards are locked. Each player should now choose one unused battlefield.",
  bothSideboardsLockedMulligan: "Both sideboards are locked. Mulligan up to 2 cards.",
  bothSkippedSideboardingMulligan:
    "Both players agreed to skip sideboarding. Their submitted decks were restored. Mulligan up to 2 cards.",
  burnedCards: "burned {count} cards? from the top of their deck.",
  canceledSkipSideboarding: "Canceled the request to skip sideboarding.",
  canceledTimeWarpTurn: "Canceled a Time Warp extra turn.",
  chainResolved: "chain resolved: {card}.",
  changedDeckRules: "changed deck rules to {format}.",
  changedGameType: "changed the game type to {format}.",
  changedLookedAtCardVisibility: "{visibility} a looked-at deck card.",
  changedLookedAtCardsVisibility: "{visibility} looked-at deck cards.",
  changedLookedAtRuneVisibility: "{visibility} a looked-at rune.",
  changedLookedAtRunesVisibility: "{visibility} looked-at runes.",
  changedRoomFormat: "changed the room to {format}.",
  changedXp: "{direction} XP to {xp}. ({delta})",
  channeledRune: "Channeled a rune.",
  chooseSoloFirstSeat: "Choose which Solo Play seat takes the first turn.",
  chooseSoloFirstSeatThenSideboard:
    "Choose which Solo Play seat takes the first turn, then sideboard.",
  chooseTurnOrderThenMulligan:
    "Choose whether to play first or second, then mulligan up to 2 cards.",
  chooseTurnOrderThenSideboard: "Choose whether to play first or second, then sideboard.",
  choosesStarter: "Chooses who starts this game.",
  choseStarterBattlefields:
    "chose {player} to take the first turn. The battlefield contributors now choose their battlefields.",
  choseStarterMulligan:
    "chose {player} to take the first turn. Both players now mulligan up to 2 cards.",
  choseStarterSideboard: "chose {player} to take the first turn. Both players now sideboard.",
  clearedFloatingResources: "Cleared floating resources.",
  clearedRepeat: "cleared Repeat for {card}.",
  closedDeckPeek: "Closed deck peek.",
  closedRuneDeckPeek: "closed rune deck peek.",
  competitorChoseStarterBattlefields:
    "{competitor} chose {player} to take the first turn. The battlefield contributors now choose their battlefields.",
  competitorWonInitiative:
    "{competitor} wins initiative ({high} vs {low}) and decides who plays first.",
  confirmedChampion: "Confirmed their chosen champion.",
  conquered: "conquered {zone}.",
  conqueredAndDrew: "conquered {zone} and drew {count}.",
  conqueredAndScored: "conquered {zone} and scored {count}.",
  consumedBuff: "consumed buff from {card}.",
  continuedWithoutOpponent: "Continued without an opponent.",
  declinedSkipSideboarding: "Declined the request to skip sideboarding.",
  departedEliminated: "{actor}{departure} and was eliminated.",
  departedMatchWinner: "{actor}{departure}. {winner} wins the match.",
  departedWinner: "{actor}{departure}. {winner} {winners}.",
  dismissedShowdown: "dismissed showdown at {zone}.",
  drewCards: "drew {count} cards?.",
  duplicatedInZone: "duplicated {card} in {zone}.",
  duplicatedOpponentCard: "duplicated opponent {card} to base.",
  endedBeginningPhase: "Ended beginning phase.",
  endedShowdownResponses: "ended showdown responses at {zone}.",
  endedTurn: "Ended their turn.",
  equipped: "equipped {card} to {target}.",
  equippedACard: "equipped a card.",
  exhausted: "exhausted {card}.",
  exhaustedRemoved: "exhausted {card} and removed it from play.",
  exhaustedRemovedGainedPower: "exhausted {card}, removed it from play, and gained 1 floating power.",
  exhaustedTrashedGainedPower: "exhausted {card}, trashed it, and gained 1 floating power.",
  filledOpponentSeat: "Filled the opponent seat.",
  finalizedMulligan: "finalized mulligan ({recycled} recycled, {redrawn} redrawn).",
  forfeitedMatch: "{actor}forfeited after disconnecting. {winner} wins the match.",
  gaveControl: "gave control of {card}.",
  goldfishFirstMulligan: "Chose to goldfish from first. Mulligan up to 2 cards.",
  goldfishFirstSideboard: "Chose to goldfish from first. Sideboard before mulligan.",
  goldfishSecondMulligan: "Chose to goldfish from second. Mulligan up to 2 cards.",
  goldfishSecondSideboard: "Chose to goldfish from second. Sideboard before mulligan.",
  hidHand: "Hid their hand.",
  hidHandCard: "Hid a card in their hand.",
  hidHiddenBoardCard: "Hid a hidden board card.",
  isNoLongerReady: "Is no longer ready.",
  isReady: "Is ready.",
  killedToPlayFromBanished: "killed {source} to play {card} from banished to {zone}.",
  lockedBattlefield: "Locked in a battlefield.",
  lockedRandomBattlefield: "Locked in a random battlefield.",
  lockedRegistration: "locked in their {format} registration.",
  lockedSideboarding: "Locked in sideboarding.",
  lookedAtBottomCard: "looked at a card from the bottom of their deck.",
  lookedAtTopCards: "looked at top {count} card(s) of their deck.",
  lookedAtTopRune: "looked at the top rune of their rune deck.",
  lookedAtTopRunes: "looked at the top {count} runes of their rune deck.",
  madePayment: "Made a payment.",
  madeUnitWithOrianna: "made {card} a unit with Orianna.",
  markedRepeat: "marked Repeat for {card}.",
  movedACardFromDeck: "moved a card from deck to {zone}.",
  movedCardFromDeck: "moved {card} from deck to {zone}.",
  movedCardToTrash: "moved {card} from {source} to trash.",
  movedCardsFromDeck: "moved {count} card(s) from deck to {zone}.",
  movedCardsToTrash: "moved {count} cards? from {source} to trash.",
  movedHiddenCard: "moved a hidden card to {zone}.",
  movedIntoDeck: "moved {card} into deck ({position}).",
  movedSelectedCards: "moved {count} selected cards? from {source} to {zone}.",
  movedToRuneDeck: "moved {card} to {position} of rune deck.",
  movedToSeat: "moved to player seat {seat}.",
  movedToZone: "moved {card} to {zone}.",
  movedTopCard: "moved top card to {zone}.",
  mustChooseStarterAll:
    "{competitor} must choose who starts. All players draw 4 cards once mulligan begins.",
  mustChooseStarterBoth:
    "{competitor} must choose who starts. Both players draw 4 cards once mulligan begins.",
  passedFocus: "Passed focus.",
  passedFocusAt: "passed focus at {zone}.",
  payment: '["{auto}"]paid {resources}{details}.',
  performedCardActivity: "performed card activity.",
  playedFromOpponentTrashWith:
    "played {card} from an opponent's trash to {zone} with {source}.",
  playedFromTopOfDeck: "played {card} from top of deck to {zone}.",
  playedFromZone: "played {card} from {source}.",
  playedFromZoneTo: "played {card} from {source} to {zone}.",
  playedTokens: "played {count} {token} to {zone}.",
  playerInitiativeSetup:
    "{format} setup begins with initiative. All {count} players roll a d20.",
  previousLoserChooses: "the previous game loser chooses who starts this game.",
  putHiddenCard: "put a hidden card to {zone}.",
  putLookedAtCardOnTop: "put a looked-at card on top of their deck.",
  queuedTimeWarpTurn: "Queued an extra turn with Time Warp.",
  randomizedTeams: "Randomized the teams.",
  readied: "readied {card}.",
  readiedAllRunes: "Readied all runes.",
  recycled: "recycled {card}.",
  recycledAllLookedAtCards: "recycled looked-at deck cards to bottom of deck.",
  recycledAllLookedAtRunes: "recycled looked-at runes to bottom of rune deck.",
  recycledFromChainToBottom: "recycled {card} from chain to bottom of deck.",
  recycledFromChainToTop: "recycled {card} from chain to top of deck.",
  recycledLookedAtCard: "recycled a looked-at card to bottom of deck.",
  recycledLookedAtCards: "recycled {count} looked-at cards? to bottom of deck in random order.",
  recycledLookedAtRune: "recycled a looked-at rune to bottom of rune deck.",
  recycledLookedAtRunes: "recycled {count} looked-at runes? to bottom of rune deck.",
  recycledSelectedCards:
    "recycled {count} selected cards? from {source} into deck in random order.",
  recycledToFloat: "recycled {source} to float {resources}.",
  recycledTrashCards: "recycled {count} trash cards? into deck in random order.",
  removedFromPlay: "removed {card} from play.",
  removedToken: "removed {token} from play.",
  replacedWithBrush: "replaced {zone} with Brush.",
  requestedSkipSideboarding: "Requested that all players skip sideboarding.",
  restored: "restored {zone}.",
  restoredTimeline: "Used Forward to restore the previous timeline.",
  returnedAdditionalLegend: "returned {card} to their Additional Legends.",
  revealedHand: "Revealed their hand.",
  revealedHandCard: "Revealed a card in their hand.",
  revealedHiddenBoardCard: "Revealed a hidden board card.",
  rewound: "Rewound to before their last action.",
  rolledD20: "Rolled a d20.",
  rolledD20By: "{competitor} rolled a d20.",
  rolledDie: "rolled a d{sides}: {result}.",
  rolls: "{rolls}",
  runeBatch: "{clauses}",
  scoredAtTurnStart: "scored {points} at turn start. Score: {from} → {to}.",
  selectedRegistration: "selected a {format} registration.",
  setScore: "set score to {score}. ({delta})",
  shuffledDeck: "Shuffled their deck.",
  shuffledKeepingRecycled:
    "shuffled their unrecycled deck cards, keeping {count} recycled cards? on the bottom.",
  skippedCardSwapsConfirmChampions:
    "All players agreed to skip card swaps. Submitted decks were restored. Confirm chosen champions before drawing opening hands.",
  skippedSideboarding: "Skipped sideboarding.",
  startedMatch: "Started the match.",
  startedSinglePlayer: "Started Single Player.",
  submittedDeck: "submitted a deck ({cards} main-deck cards, {battlefields} battlefields).",
  teamInitiativeSetup: "{format} setup begins with initiative. Both teams roll a d20.",
  unlinked: "unlinked {card}.",
  unlinkedFrom: "unlinked {card} from {source}.",
  updatedRegistration: "updated their {format} registration.",
  updatedSideboarding: "Updated sideboarding.",
  usedGoldToken: "used a Gold token.",
  usedGoldTokenGainedPower: "used a Gold token and gained 1 floating power.",
  wonInitiative: "wins initiative ({high} vs {low}) and decides who plays first.",
};

function plural(value: ParamValue): boolean {
  return typeof value === "number" ? value !== 1 : false;
}

/** Substitute `{param}`, `{param}?`, `word(s)` and `cards?` plural markers. */
export function renderSentence(key: string, params: Params = {}): string {
  const template = SENTENCE_TEMPLATES[key];
  if (!template) return key;
  let out = template.replace(/\{([a-zA-Z]+)\}/g, (match, name: string) => {
    const value = params[name];
    if (value === undefined || value === null) return "";
    return String(value);
  });
  // Explicit plural markers used by the original catalog: "card(s)", "cards?".
  out = out.replace(/(\w+)\(s\)/g, (_match, stem: string) => (plural(params.count) ? `${stem}s` : stem));
  out = out.replace(/(\w+?)s\?/g, (_match, stem: string) => (plural(params.count) ? `${stem}s` : stem));
  return out;
}

/** Action → log `actionKind` classifier (0xawjzm3yjpr1.js:11080-11150). */
export function actionKindFor(actionType: string): ActionKind | undefined {
  switch (actionType) {
    case "end_turn":
    case "end_beginning_phase":
    case "set_extra_turn":
      return "turn";
    case "peek_deck_top":
    case "peek_deck_bottom":
    case "dismiss_deck_peek":
    case "set_deck_peek_card_reveal":
    case "set_deck_peek_cards_reveal":
    case "set_hand_reveal":
    case "set_card_hidden":
    case "set_card_revealed_to_opponent":
      return "inspect";
    case "draw_cards":
    case "take_top_from_deck":
    case "take_card_from_deck":
      return "draw";
    case "shuffle_deck":
    case "recycle_deck_peek_card":
    case "recycle_all_trash_to_deck":
    case "clear_deck_peek":
    case "put_deck_peek_card_on_top":
    case "send_to_deck":
      return "deck";
    case "move_cards_to_trash_batch":
      return "trash";
    case "draw_rune":
    case "send_rune_to_deck_bottom":
    case "recycle_rune_for_floating_energy":
    case "payment_batch":
    case "rune_batch":
    case "send_to_rune_deck":
    case "floating_resource_batch":
    case "adjust_floating_resource":
    case "clear_floating_resources":
      return "resource";
    case "roll_die":
    case "create_token":
    case "move_card":
    case "move_off_board_cards_batch":
    case "transfer_card_control":
    case "equip_card":
    case "toggle_exhausted":
    case "adjust_card_might":
    case "unlink_banished_card":
    case "dockside_banish_unit":
    case "dockside_play_banished":
    case "kharox_play_from_trash":
    case "animate_orianna_gear":
    case "choose_neeko_legend":
    case "duplicate_card":
    case "set_battlefield_brush":
      return "board";
    case "chain_add":
    case "chain_resolve":
    case "chain_set_repeat":
      return "spell";
    case "battlefield_conquer_pass_focus":
    case "battlefield_conquer_pass_response":
    case "battlefield_conquer_dismiss":
    case "battlefield_conquer_confirm":
      return "battle";
    case "set_score":
    case "adjust_score":
      return "score";
    case "adjust_legend_xp":
      return "legend-xp";
    case "rewind_last_action":
      return "rewind";
    case "forward_last_rewind":
      return "forward";
    default:
      return undefined;
  }
}
