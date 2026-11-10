# Strict rules engine: edge-case audit

Scope: places where the strict engine (`packages/rules`, run through the real engine host) differs
from the Riftbound Core Rules (`packages/rules/corpus/core-rules-2026-10-09.txt`) or does not
implement something yet, ranked by how often a real game hits it. Each claim quotes the corpus and
is checked by a test that builds a real strict room (scenario DSL or the 3-player `table`).

Base: `41ec263` (R4 play-test fixes). Rules coverage after this pass: 691 / 2321 rule ids tested (29.8%, was 666 / 28.7%). Tests live in `packages/rules/test/edge-cases/`:

| File | What it pins |
| --- | --- |
| `awaken.test.ts` | the Awaken Phase ready, done per object (fixed) |
| `combat.test.ts` | several attackers and defenders, Backline assignment, excess damage |
| `turn.test.ts` | Beginning Phase order (Temporary before scoring), Expiration Step |
| `showdown-scoring.test.ts` | 3-player Focus order, the Final Point in a live turn, recalls, tokens |
| `hidden.test.ts` | Facedown Zone occupancy (fixed), 811.1.d.5 (fixed), Elnuk Herd |
| `legends.test.ts` | Evelynn, Agony's Embrace (was manual) |
| `fixture-cards.test.ts` | preset/fixture cards whose `partial` status was out of date |
| `softlock-prompts.test.ts` | the engine prompts behind the UI soft-locks below |
| `known-gaps.test.ts` | `it.skip("[BUG] …")` reproductions of the gaps left open |

`progress.md` section 5 says no engine bugs are open. This audit found five rule divergences
(fixed here), two UI soft-locks (outside this lane; both fixed at integration in `8085843`,
see S1/S2), and three engine gaps that now have skipped reproductions.

## Ranked edge cases

Impact: **every game** = happens in normal play regardless of deck; **common** = any deck with
the named mechanic or card; **deck-specific** = only the named cards; **latent** = no printed card
reaches it today.

| # | Edge case | Rule (quoted) | Status | Player impact | Test |
| ---: | --- | --- | --- | --- | --- |
| 1 | In a multiplayer room (PvP and Practice vs Bot), clicking an **opponent's** unit does not answer a target prompt | 312.1.b.1 "Players can always take and make choices for Limited Actions when instructed, regardless of Priority." | **fixed at integration** (`8085843`: the prompt branch runs before the ownership check; `strict-prompt-softlocks.test.ts`) | every game: any trigger or click-played spell that targets an enemy unit (Gust played by click, "When you play me, deal 2 to an enemy unit", …) | `softlock-prompts.test.ts` (engine input) |
| 2 | The Awaken Phase readied everything in one bulk call: "can't be readied" was ignored and "when I become ready" / "when you ready" never triggered there | 416.3.a "A player Readies all non-spell Game Objects they Control during the Awakening Phase on their turn." 054.1 "Cards that forbid actions or effects … supersede cards that allow or permit that same action or effect." | **fixed** | every turn, for the decks that run them: Maduli the Gatekeeper (scripted `implemented`, readied every turn), Fretful Feline (2 starter kits), Jayce, Hammer in Hand (kit champion), Irelia, Fervent, Pirate's Haven | `awaken.test.ts` |
| 3 | A prompt whose every option is in the player's own **Main Deck or Trash** opens in board-click mode, where those cards cannot be clicked | 312.1.b.1 (above); 355.18 "If a spell or ability requires one or more players to make choices … they are made on resolution." | **fixed at integration** (`8085843`: pile options use the prompt dialog; `strict-prompt-softlocks.test.ts`) | common: hard lock for Stacked Deck, Called Shot (deck, min 1); trash picks (Morbid Return, Cemetery Attendant, Soulgorger, Spectral Matron, The Harrowing) only via the Trash viewer's buttons; every Vision/Predict card (23) can only Skip, never recycle | `softlock-prompts.test.ts` |
| 4 | A hidden spell that plays a unit put it in base | 811.1.d.5 "If a hidden spell or a play effect of a hidden permanent causes you to play a unit, you must choose to play that unit at that battlefield." | **fixed** | common in Hidden decks: Sprite Call's 3 Might blocker now arrives at the contested battlefield | `hidden.test.ts` |
| 5 | Bandle Tree's extra facedown card was refused | 107.3.b.1 "The maximum occupancy of a Facedown Zone can increase or decrease." | **fixed** | common: any game on Bandle Tree (a fixture-deck battlefield) with Hidden cards; also Bushwhack Trap's slot | `hidden.test.ts` |
| 6 | Several attackers moved together; Backline ("I must be assigned combat damage last") in a live assignment; excess damage after lethal | 144.3 "Players may perform multiple Units' standard move simultaneously."; 826.3 "…assigned lethal damage after any other unit with the same controller…"; 467.2.c.6 "A player must obey all requirements and restrictions on damage assignment if able." | verified correct; Caitlyn, Patrolling and Soraka, Wanderer statuses corrected to `implemented` | every game with 2+ units in a fight; Caitlyn is in the fixture/preset decks | `combat.test.ts` |
| 7 | A Temporary unit alone at a battlefield dies before scoring, so the battlefield is no longer held | 816.1.b "At the start of this permanent's controller's Beginning Phase, before scoring, kill this."; 323.5 "Players lose control of any controlled Battlefields without their Units occupying them…" | verified correct | common (Sprite tokens, Keeper of Masks) | `turn.test.ts` |
| 8 | The Final Point: first Conquer at 7 draws instead; conquering the second battlefield the same turn gains the point and wins; Aspirant's Climb raises both thresholds | 473.1.b.1 "If the player has Scored every Battlefield this turn, that player Gains the Final Point. If the player has not …, that player draws a card instead."; 194.3.a "Some game modes or card effects may alter the Victory Score." | verified correct; Aspirant's Climb status corrected | every game that reaches 7 points | `showdown-scoring.test.ts`, `fixture-cards.test.ts` |
| 9 | Showdown Focus in a 3-player game goes round in Turn Order; all passing once ends it | 347.2.b "Otherwise, the next Player in Turn Order gains Focus."; 347.2.a "If all Players have passed once in sequence, the Showdown ends." | verified correct | every FFA showdown | `showdown-scoring.test.ts` |
| 10 | Leaving a held battlefield and retaking it the same turn scores nothing | 472 "A player may only Score, from either method, once per Battlefield per turn." | verified correct | common | `showdown-scoring.test.ts` |
| 11 | End of turn: Stun ends, "this turn" Might ends, damage heals (lethal damage kills first), Rune Pool empties | 424.1.a.2 "Stunned Units lose the Stunned status during step 3d of the end of turn cleanup."; 317.2.b–d | verified correct | every turn | `turn.test.ts` |
| 12 | A recalled Attacker does not trigger "When I move"; a token returned to hand ceases to exist | 458.1 "They do not cause Triggered Abilities to trigger that are triggered by Move actions."; 186.1 "If a token is put into any Non-Board Zone besides the chain, it ceases to exist immediately…" | verified correct | common (Treasure Hunter, Recruit/Sprite tokens) | `showdown-scoring.test.ts` |
| 13 | Readying an already-ready object (or exhausting an exhausted one) still emitted an event, so "when I become ready/exhausted" could fire for nothing | 416.1.c "If a Unit is instructed to be Readied while it is already Ready, nothing additional happens." | **fixed** (primitives return early) | deck-specific; was reachable from any caller that skipped the op-level check | `awaken.test.ts` |
| 14 | Manual-status cards (§6.4 window) cannot touch the opponent's objects: the sandbox actions the window allows only act on the actor's own board | 312.1.b.1 (the instructed choices must be makeable) | not implemented | deck-specific but severe: a manual card that damages/kills/moves an enemy (e.g. manual legends Jhin, Vi) cannot be resolved in PvP; the player can only press Done | — (see `packages/rules/src/gate.ts` `MANUAL_ACTIONS`, engine `moveCard(room, playerIndex, …)`) |
| 15 | "Excess damage" is not defined anywhere in the corpus, and the engine does not record it | 467.2.c.4 "Units cannot have more damage assigned to them than the minimum required to constitute lethal damage unless no further units remain…" (the only related text) | interpretation question + not implemented | deck-specific: Vi, Piltover Enforcer (legend, kit), Trapping Grounds (battlefield, kit), Yeti Brawler (kit), Hextech Gauntlets, Sivir, Tryndamere | — |
| 16 | Per-turn history (units that died, where cards were played) is missing | 356.4 "Apply discounts."; 369.3 (entry replacements) | not implemented; `[BUG]` repros | **most-played gap**: Hunters' Circle, Lingering Animus and Hold 'Em are each in 3 of the 24 starter kits | `known-gaps.test.ts` |
| 17 | Predict 2+: the kept cards go back in their old order | 437.1.a "…Recycles any number of them before putting the rest back on top of their Main Deck in any order." | bug, `[BUG]` repro | deck-specific (Clairvoyance, Clocktower Guardian, Mysterious Chronomancer) | `known-gaps.test.ts` |
| 18 | When a Facedown Zone's occupancy drops (Bushwhack Trap leaves), the excess facedown card stays | 107.3.b.2 "If the maximum occupancy … decreases to a number less than the number of cards currently located there, the controller … must put a number of cards equal to the difference in the trash…" | bug, `[BUG]` repro | deck-specific (Bushwhack Trap stays `partial`) | `known-gaps.test.ts` |
| 19 | A discard cost inside a spell's instructions discards the newest card instead of asking | 423.1.a "The player who is performing the action chooses which cards to send to their Trash…"; 740.4.a.1 "For spells, costs within instructions are paid on resolution…" | bug, `[BUG]` repro | latent: no printed card uses this path (leading trigger costs are asked by the play layer) | `known-gaps.test.ts` |
| 20 | Hide is allowed in a Showdown Open State | 811.1.b "…on your turn during an Open State, you may pay [A] to hide this…" vs 411.1.a "A Discretionary Action is a Game Action that may be performed … during a Neutral Open State." and 422.2 "Hiding is a Discretionary Action." | interpretation question (engine follows 811.1.b) | rare: your own showdown, with Focus | — |
| 21 | `progress.md` §7 still lists 479.4.c negative Might as open | 143.2.c "If a unit's Might is ever less than 0, it is treated as 0 when referenced…"; 143.2.c.1 "…it is not 0. Effects that calculate Might increases and decreases use the actual value." | resolved in code (commit `3193e13`), doc entry stale | none | existing tests |

## Soft-lock risks

A prompt the player cannot answer stops the game for both players. The engine side of both cases
is sound: every prompt has options and a plain `rules_choose` with an option id answers it
(`softlock-prompts.test.ts`). The defects were in the strict board's routing (`apps/play`, owned by
another lane), so the audit described them with the fix; both were fixed at integration in
`8085843` (`apps/play/.../strict/__tests__/strict-prompt-softlocks.test.ts`). The analysis below is
kept for the record.

### S1 — options only in the player's own Main Deck or Trash (hard lock for deck picks) — fixed

- `StrictPromptHost.tsx:43` hides the dialog when `promptHasBoardTargets` is true.
- `strict-interaction.ts:163` treats an option as a board target when `findCard(room, id)` finds
  it, and `strict-model.ts:36` `findCard` searches **every** array on the board, including `deck`,
  `trash`, `banished` and `runeDeck`. The prompted player's own deck is not redacted for them, so a
  deck-only prompt is routed to board-click mode.
- Deck cards are never rendered as clickable; clicking the deck pile sends `draw_cards`
  (`BoardInteractionProvider.tsx:2416`), which strict mode rejects. Trash cards are reachable only
  through the Trash viewer's sandbox buttons ("To hand", "Recycle"), which happen to carry the
  card id the engine's gesture translator accepts. The banner gives no hint of this.
- Checked against a real redacted room in a temporary UI probe (removed): `promptHasBoardTargets`
  returns `true` for a deck-only and a trash-only option.
- Affected (found by playing every card whose script picks from the deck/trash): **hard lock**
  Stacked Deck, Called Shot; **hidden path only** Morbid Return, Cemetery Attendant, Soulgorger,
  Spectral Matron, The Harrowing; **Skip only, cannot recycle/pick** Clairvoyance, Clocktower
  Guardian, Consult the Heavens, Eclipse, Karma, Lightning Rush, Mysterious Chronomancer,
  Reinforce, Remember the Fallen, Shadows of the Past, The Empyrean, Trifarian Captain, Wild Claw,
  and every Vision/Predict card.
- Fix (UI): in `promptHasBoardTargets` only count cards found in clickable zones (base,
  battlefields, hand, legend, champion, rune area). Every other prompt then falls back to
  `StrictPromptDialog`, which already lists card options by name and answers them.
  Keyboard Tab/Enter cycling (`BoardInteractionProvider.tsx:2939`) is the only current workaround.

### S2 — the opponent's cards cannot be clicked to answer a prompt in multiplayer rooms — fixed

- `BoardInteractionProvider.tsx:1469`: `canActAsOwner = interactive && (isSelf || (mode !==
  "multiplayer" && !!dispatchAs))`. In strict rooms the click handler returns at `:1597` when
  `!canActAsOwner`, **before** the prompt branch at `:1601`. `GameScreen.tsx` passes
  `mode: "multiplayer"` for PvP rooms and for Practice vs Bot (whose live `roomMode` is switched
  to `multiplayer` after setup).
- So a `choose-target` whose options are enemy units (`softlock-prompts.test.ts`, Gust played by
  click) cannot be answered with the mouse. Drag-to-target binds the target before the prompt, so
  dragging a spell onto its target still works; triggered abilities have no such path. Only
  Tab/Enter cycling answers. Not verified in a browser (the play suite has no DOM environment);
  the code path is unambiguous.
- Fix (UI): handle the `strictPrompt && strictPromptOnBoard` branch before the `canActAsOwner`
  check and send `promptChooseIntent(strictPrompt, [option.id])` as `strictPrompt.playerId`
  (prompt answers are the prompted seat's, whoever owns the clicked card).

### Prompt and intent coverage

Every prompt kind/reason the engine can emit, and how the strict UI answers it:

| Reason (`prompt.data.reason`) | Kinds | UI path | Answerable |
| --- | --- | --- | --- |
| `burn_out` | `choose-opponent` | dialog | yes |
| `stage_showdown`, `stage_combat` | `choose-battlefield` | battlefield marker click | yes |
| `combat.damage_assignment` | `damage-assignment` | dialog (steppers, suggestion) | yes |
| `effects.order_triggers` | `order` | dialog (select all, confirm) | yes |
| `effects.replacement` | `yes-no`, `choose-mode` | dialog | yes |
| `play.optional_cost`, `play.trigger` | `yes-no` | dialog | yes |
| `play.cost` | `choose-cost` | dialog (cards listed by name) | yes |
| `play.choice`, `effects.resume` | `choose-number`, `choose-mode`, `choose-opponent`, `yes-no` | dialog | yes |
| `play.choice`, `effects.resume` | `choose-player` | seat click (`IdentityBadge`) | yes |
| `play.choice`, `effects.resume` | `choose-battlefield` | battlefield marker click; a `base` option is only clickable through a card in base | yes (base: minor) |
| `play.choice`, `effects.resume` | `choose-target`, `choose-card` | board click | **S1 / S2** |
| §6.4 manual window | — | Done button (`StrictPromptHost`) | yes (but see row 14) |

No emitter produces an empty or all-disabled option list (the dialog's only dead end). All eight
`rules_*` intents (`play`, `activate`, `move`, `pass`, `end_turn`, `choose`, `manual_done`,
`concede`) have a UI or gesture emitter.

## Most-played unfinished cards

"Preset decks" in this repository are the 24 Pre-Rift starter kits in
`packages/cards/data/preset-decks.json` (RAD 9, UNL 6, VEN 9; no constructed tournament lists are
committed) plus the two fixture decks (`packages/rules/test/fixtures/decks.json`). Legends and
battlefields matter most: one legend is in play every game of its deck, and both chosen
battlefields are in play all game.

Fixed or corrected in this pass: Fretful Feline (2 kits), Elnuk Herd (2 kits), Reckless Innovator
(3 kits + fixture), Evelynn, Agony's Embrace (legend, kit), Jayce, Hammer in Hand (kit champion),
Caitlyn, Patrolling, Clockwork Keeper, Bandle Tree and Aspirant's Climb (fixture decks), Soraka,
Wanderer, Pirate's Haven. Card status is now 816 implemented / 191 partial / 83 manual
(was 805 / 200 / 85).

Still unfinished, ranked by starter-kit copies:

| Card | Role | Kits | Status | What is missing (script notes) | Engine gap |
| --- | --- | ---: | --- | --- | --- |
| Hunters' Circle | battlefield | 3 | manual | first unit/gear each player plays here costs [1] less | per-turn play-location history (`known-gaps.test.ts`) |
| Lingering Animus | unit | 3 | manual | enters ready if a friendly unit or gear died this turn | per-turn death history (`known-gaps.test.ts`) |
| Hold 'Em | spell | 3 | partial | [2] discount after playing a unit/gear to a battlefield | per-turn play-location history (`known-gaps.test.ts`) |
| Dune Devourer | unit | 2 | partial | discount for paying its optional kill cost | cost layer cannot read an object paid as a cost |
| Dune Surfer | unit | 2 | partial | ignore Tank when assigning damage here | `ignore-keyword` has no combat consumer |
| Herald of the Emperor | unit | 2 | partial | "base Might becomes 5" approximated | no trait-altering base-Might layer |
| Invigorating Bloom | gear | 2 | partial | cost exhausts two objects | `Cost.exhaust` holds one selector |
| Meticulous Restorationist | unit | 2 | manual | play from trash when you play a [7]+ card | triggers of cards in non-board zones (385) |
| Profiteer | unit | 2 | partial | "disempower something you control" cost | no disempower cost part |
| Questionable Tome | gear | 2 | partial | "disempower this" cost | no disempower cost part |
| Risen Altar | battlefield | 2 | partial | either/or (Energy or Power) discount | no choice between cost components |
| Ambessa, Matriarch of War / Mel, Soul's Reflection / Zed, Master of Shadows / Kennen, Heart of the Tempest | legends | 1 each | partial | "Disempower me" activation cost | no disempower cost part (one fix unblocks 4 legends + Profiteer + Questionable Tome + Ekko, Boy Who Shattered Time) |
| Vi, Piltover Enforcer | legend | 1 | manual | "if you assigned 3 or more excess damage" | excess damage undefined and unrecorded (row 15) |
| Trapping Grounds | battlefield | 1 | manual | same excess-damage condition | row 15 |
| Jhin, Virtuoso | legend | 1 | manual | "if you spent [4] or more"; spells banished with it | resources-spent history |
| Forgotten Library | battlefield | 1 | manual | "if you spend [4] or more, predict" | resources-spent history |
| Ivern, Green Father | legend | 1 | manual | replace a battlefield with a Brush token | battlefield replacement (186) |
| Orianna, Lady of Clockwork | legend | 1 | manual | gear "becomes a unit gear" | card-type-changing layer |
| Seraphine, Starry-Eyed Songstress | legend | 1 | manual | optional cost: exhaust legend + three units | multi-object optional cost |
| Gardens of Becoming | battlefield | 1 | manual | grants "[Tap]: Gain 1 XP" to units here | granted activated abilities |
| Diana, Scorn of the Moon / Renekton, Butcher of the Sands / Mordekaiser, Iron Revenant | legends | 1 each | partial | restricted Energy/Power ("spend only on …") | resource spending restrictions |
| Ekko, Boy Who Shattered Time | legend | 1 | partial | disempower cost; next-unit discount consumed by any card | disempower cost; typed one-shot discounts |
| Firelights' Hideout / Mystic Vortex / Piltovan Forge | battlefields | 1 each | partial | keyword grants to cards in hand; opponent cost changes; discounts on abilities | hand keyword grants; cross-player cost modifiers |
| Meditation | fixture spell | — | manual | deliberately manual: the R1 manual-window suites use it as the canonical unscripted card | none (the script is written) |

Biggest single unlocks, by kit copies blocked: per-turn history (9 copies across 3 cards, plus Jhin,
Forgotten Library, Bloodscent Swarm), a disempower cost part (4 legends + 3 kit cards), and a
definition plus record of excess combat damage (1 legend, 1 battlefield, 1 kit unit).

## Verification

- `pnpm --filter @rift/rules test`, `pnpm --filter @rift/rules typecheck`, `pnpm --filter
  @rift/engine test`, `node packages/rules/scripts/rules-coverage.mjs --check`; results are in the
  hand-off report.
- Catalog self-play after the changes: 50 seeds, 49 wins, 1 legal turn cap, 0 stuck, 0 crashes.
- `apps/play` and `apps/realtime` suites were run unchanged (no edits there): 354 and 76 passing.
