# Core Rules: Radiance Patch Notes (Effective October 16, 2026)

- **Source:** https://playriftbound.com/en-us/news/announcements/core-rules-radiance-patch-notes-effective-october-16-2026/
- **Rules hub:** https://playriftbound.com/en-us/rules-hub/
- **Published:** 2026-10-09
- **Fetched:** 2026-11-08
- **Type:** Official Core Rules patch notes
- **Note:** These notes explain the Core Rules changes; the authoritative rules text is `corpus/rules.json`.

---

*Radiance Rules Update Effective October 16, 2026*

Welcome to the patch notes for Riftbound, *Radiance* edition. Included in today’s update are rules for playing with *Radiance’s* new mechanics, updates from the *Vendetta* [FAQ](https://playriftbound.com/en-us/news/rules-and-releases/vendetta-rules-faq-and-clarifications/), improvements to the rules’ logical infrastructure to better prepare for future sets and mechanics and a collection of scenarios to help folks understand some of the more complicated interactions introduced with *Radiance*.

## Unique Radiance Interactions

While the patch notes and core rules are aimed at arming our judges, we wanted to include questions and answers prepared by the design team for some of the more tricky interactions and cards released in that set. This article will be released in addition to an FAQ article in the window when we’ve previously released FAQ articles.

Although this article is not an FAQ, it still is a collection of official rulings. These rulings are based on the Core Rules Document that also releases today, as well as the wording of the cards. When a new version of the Core Rules Document is released, it will take precedence over any points that differ from this document.

Throughout this document, we use some specific shorthand to represent symbols in card text. Here’s a short guide:

- [E] means “exhaust”

- [M] means “Might”

- [A] means “one power of any domain”

- [C] means “one power of this card’s domain”

- [C] in Accelerate costs takes on the domain of the Unit, or turns into [A] if the Unit has no domain or multiple domains.

- [C] in other cases is treated as the corresponding power symbol in all respects, matching how the cards are actually printed—it’s just a design shorthand!

**What happens when I play Ekko, Boy Who Shattered Time’s activated ability, play a unit, and then play Unlicensed Armoy’s activated ability? Will the unit be killed on my next turn?**

Your unit’s death from its triggered ability will be replaced by Unlicensed Armory. Although the unit has the text “Kill me at end of turn.” appended to it, that text is synonymous with “Kill me at the end of this turn.” On subsequent turns, it will not trigger.

When “at end of turn” appears on card text, it is used synonymously with “at the end of this turn.” Although granting that text to a unit is strange, it isn’t outside the bounds of possibility. If the unit remains on the board after the triggered ability resolves, the condition for its ability to trigger will no longer be able to be fulfilled, so it will not trigger again. If the unit changes zones to or from a non-board zone *prior* to the triggered ability triggering, all of its temporary modifications—including this granted text—will be removed. As such, the ability will no longer exist to trigger.

*Relevant rules: 359.3.e.16., 124.1.*

**Can I show off a facedown card at a battlefield with the Show Off ability of Gutter Guardian?**

You cannot. Facedown cards don’t have any referenceable characteristics from their front side.

The keyword “Hidden” only appears on the front side of the card; that’s the side with the cost, name, Might, and rules text among other traits. While a card is facedown, any information on its front side cannot be referenced by other cards and effects. Although a facedown card may be friendly to Gutter Guardian, it doesn’t have the appropriate characteristic to be shown off. Note that only the card from hand is revealed with Show Off. You don’t reveal the friendly objects on the board that you’re Showing Off, so you can’t reveal the facedown card even if you wanted to.

*Relevant rules: 811.5.a., 129.4.*

**What’s up with the reminder text on Chronobreak? Do I get to choose the order?**

You get to choose the order if you own all of the units being banished. If you control some number of units that you don’t own and banish those units as well, the units you banish will be placed on the chain starting with units owned by the current turn player and then proceeding in turn order.

Items cannot be placed on the chain simultaneously for any reason. If chain items would be played simultaneously, their controller chooses the order they go on the chain. If multiple players would add items to the chain simultaneously, they place their items on the chain in turn order instead, starting with the current turn player. In the case of Chronobreak, each player chooses the order of their own units being played to the chain (this is what the reminder text is referring to), but each player plays their units to the chain in turn order, starting with the current turn player.

Example: You control five total units, two of which are owned by your opponent. You play Chronobreak, choosing all five units. You banish them, then for each, their owner plays them to the chain as pending items. You’re the current turn player, so you play your three units first in the order of your choice, then your opponent plays their two units in the order of their choice. Pending chain items are finalized from oldest to newest and units resolve as soon as they’re finalized. Thus, we go up the chain starting with the first unit you played to the chain, finalizing and resolving all of the pending units on the chain until there are no more units on the chain. Then we finalize any play effects of those units in the order they triggered. Finally, players can react to the most recent item on the chain. If they don’t, that item resolves, and we repeat the process until all items on the chain have resolved.

*Relevant rules: 303.2.a.*

**What happens when I play Transpositionist’s activated ability choosing an empowered Gangplank, Naval with 6 [M]? Can I play Angler Wyrm?**

Gangplank being returned to hand will be replaced with him being given +3 [M] this turn. You can play Angler Wyrm from hand with Transpositionist’s activated ability.

Transpositionist returns a unit to hand and then references that unit’s information. If the unit didn’t change zones and it was a legal target as the instruction that targeted it was being processed, the activated ability will reference that unit’s current information. Gangplank, Naval’s current Might as it is referenced is 9 [M], allowing you to play a unit with 9 [M] or less.

*Relevant rules: 359.3.e.13., 359.3.e.13.a.*

**What happens when I choose an attached Equipment with Orianna, Lady of Clockwork?**

It detaches from the object it is attached to when it becomes a unit. Although its equip ability can be activated and it can be targeted by Weaponmaster triggers, it cannot attach to a unit; nothing will happen when those abilities resolve.

In this rules update we’ve clarified that units cannot be attached to other game objects. If a unit were to be attached to a game object, it would need to stop being a unit first. If a non-unit game object becomes a unit, it will detach from anything it is attached to as it becomes a unit. If an effect would attempt to attach a unit to another game object without making it no longer a unit first, nothing happens.

*Relevant rules: 143.5., 435.1.h., 718.6.*

**What happens when I choose a gear with Deploy located at a battlefield with Orianna, Lady of Clockwork?**

That gear will become a unit-gear when the triggered ability resolves; if their controller doesn’t control that battlefield, they will apply contested status to that battlefield, and a combat or showdown will be staged there in the subsequent cleanup. When the chain clears, that showdown or combat will open.

*Relevant rules: 190.3.a., 323.7, 323.8., 323.11., 323.12.*

**What happens when I choose another gear with Orianna, Lady of Clockwork and the previous unit-gear stops being a unit? Will its attached Equipment fall off? If it’s a deploy gear in base, do I get to move it?**

Its attached Equipment will remain attached, and if it is a Deploy gear in base, it will remain in base.

Although units cannot be attached to objects, other objects have no such compunctions. Any attached Equipment that don’t become units will remain attached to the gear even after it stops being a unit. Their Might bonus won’t apply, since the gear doesn’t have a Might, but they will continue to apply their effect text to the gear they are attached to.

The majority of gear with Deploy reference “this battlefield” or “hold here” in such a way that gaining a benefit from base is not possible. That being said, if you want to move it back to a battlefield you can either turn it into a unit again with Orianna, Lady of Clockwork or you can use movement effects that specify moving gear, such as Command: Attack.

Note that there is a small gap between finalizing the Orianna, Lady of Clockwork trigger causing the previous unit-gear to stop being a unit, and the triggered ability resolving and causing the new gear to become a unit. During that gap, neither gear is a unit unless it was already one prior to ever being chosen by Orianna, Lady of Clockwork.

*Relevant rules: 137.3.b.*

**So how does Neeko, Blending In actually work? When do I choose the legends, do I get three legends per Neeko in my deck, can I add multiple of the same legend to the Legend Zone, do the legends enter ready, and do I need to reveal them to my opponent?**

You choose the legends during deck building—at competitive OPL, you must register those legends as part of your deck list, and you can store them with your sideboard. The 3 legends are shared by all Neekos in your deck. You cannot add multiple of the same legend to the Legend Zone. The legends enter ready. You do not need to reveal them to your opponent until they are added to the Legend Zone.

Let’s break down Neeko’s rules text. If your deck (Main Deck or sideboard) has one or more copies of Neeko, Blending In, you pick three legends in addition to your starting Champion Legend. Those 3 legends must be different from each other and from your Champion Legend. Regardless of how many copies of Neeko you have in your deck, you will choose three legends in this way.

When Neeko’s play effect resolves, its controller picks one of the legends chosen during deck building and adds it to their Legend Zone alongside their Champion Legend for as long as Neeko is on the board. If Neeko leaves the board, that legend will also cease to exist. The legends don’t exist in any zone of the game while they’re not in the Legend Zone; they don’t exist at all. That being said, if one or more of those legends are already on the board, a player can’t choose to create additional versions of those legends; they can have at most one legend on the board per legend chosen during deckbuilding. If somehow a player played a fourth Neeko, they would fail to add a legend to their legend zone.

The legends added this way are not tokens. They are legend cards and behave in all ways like normal legends do. If an effect instructs a player to “ready a friendly legend” they can target and ready any legends controlled by them or an ally. If an effect instructs a player to ready “your legend,” that refers to any legend controlled by that player. Such an effect does *not* target a legend; the legend is chosen as the spell or ability resolves.

*Relevant rules: 103.1., 440.2.a., 440.3.b., 440.3.c., 355.10.g.*

**What happens when the unit on the board that I Showed Off with Primordial Roar is returned to my hand with Star-Crossed? Do I still deal damage? What about if I play Lunar Boon and discard the unit from hand?**

You still deal damage in both scenarios.

Any referenced characteristics of shown off objects are locked in when you show them off. Regardless of what subsequently happens to them, their information will be able to be checked by the card that showed them off. This also means that giving a unit +[M] or -[M] after showing that unit off will not affect the damage dealt by Primordial Roar; it’s too late by that point.

*Relevant rules: 832.1.d.1.*

**What counts as reducing a unit’s Might for Ahri, Confident? If I play Discipline on my 1 [M] unit while it’s stunned and located at the same battlefield as an enemy Leona, Zealot, will I trigger their Ahri, Confident located at that battlefield?**

Reducing a unit’s Might means an ability of an object you control causes a unit to receive a -[M] effect. Ahri, Confident will trigger if you Discipline a stunned 1 [M] unit at the same battlefield as an enemy Leona, Zealot.

Although Discipline never causes the unit’s Might to increase, the unit goes from 1 [M] with a -0 [M] effect applied to it, which will not trigger Ahri, Confident, to 3 [M] with a -2 [M] effect applied to it. This change in state triggers Ahri, Confident, the same as a 3 [M] unit being stunned and receiving a -2 [M] effect from Leona, Zealot’s passive ability. Note that this doesn’t work for other cases: if a stunned 3 [M] unit at the same battlefield as an enemy Leona, Zealot has Discipline played on it, that unit will not have a new Might reduction effect applied to it and thus Ahri, Confident will not trigger. Spells, triggered abilities, and activated abilities are easier; if a spell, triggered ability, or activated ability applies non-zero -[M] to a unit, Ahri, Confident will trigger.

---

## Core Rules Changes

The *Unleashed* and *Vendetta* rules updates have laid a relatively stable base for this rules update. We’ve made small changes as necessary, but we have fewer logical holes to patch, and there aren’t any sweeping fixes that need to be implemented in this set. The vast majority of the rules in this update are about new cards and mechanics in the *Radiance*set.

Now let’s take a look at the rules changes we have in store for *Radiance*!

**—**

**Radiance Addition:** Deploy

- Deploy is a new keyword appearing on gear in *Radiance.* Gear with Deploy enable players to apply localized, battlefield-altering effects.

- Gear with Deploy can be played to any battlefield; enemy occupied, friendly, or uncontrolled. However, when an opponent holds a battlefield where you have gear with Deploy, those gear will be killed.

- Gear with Deploy remain at their current battlefield so long as they aren’t destroyed. Some effects can move gear with Deploy to other battlefields too!

- **NEW RULE:** Deploy keyword added.

**Radiance Addition:** Disarm

- Disarm is a new keyword appearing on units in *Radiance.*

- Disarm is an attack trigger. The first time a unit with Disarm attacks each combat, they will give an enemy unit at their battlefield -1 [M] this turn. If a unit has Disarm 2, they’ll give an enemy unit -2 [M] this turn.

- Disarm stacks just like Assault or Shield; meaning if a unit has gained multiple Disarm keywords from different sources, the unit will have one trigger for Disarm with a total of the sum of their Disarm values.

- **NEW RULE:** Disarm keyword added.

**Radiance Addition:** Show Off

- Show Off is a new keyword appearing on both units and spells in *Radiance.*

- When you Show Off something, you reveal a card from your hand that matches the requirement, or pick a friendly game object (card or token) on the board with the appropriate characteristics.

- Cards with Show Off can reference information from the shown off card or object. That information is locked in when the card or object is shown off, even if it’s referenced later.

- **NEW RULE:** Show Off keyword added.

**Rules Update:** Copy Effects Layer

- We saw some confusion on how copy effects work and their placement in the trait-altering layer. In the *Radiance* rules update, we’ve moved to clarify this by giving copy effects a layer of their own. The first layer is now for copy effects and all subsequent layers (trait-altering, ability-altering, arithmetic) have been shifted down to reflect this change.

- Because copy effects only interacted with other copy effects anyway, there was functionally no reason for them to remain in the trait-altering layer. Our hope with this move is that it will be clearer that they only interact with other copy effects. Effects like the Mech tag appended by Experimental Hexplate in the trait-altering layer are not copied by copy effects.

- **NEW RULE:** Copy Effects layer added.

**Radiance Addition:** Copy Game Action

- To support and build on this clarification for copy effects, we’ve also added the copy game action to the game actions section.

- This section also clarifies how game objects that are created as copies, like the tokens played by Zilean, Time Mage’s replacement effect, work; those game objects don’t have a copy effect applied to them, but are created directly with the copyable traits of the object it is a copy of, as if those were its own printed traits.

- **NEW RULE:** Copy game action added.

**Radiance Support:** Additional Deckbuilding Decisions

- *Radiance*’s Neeko, Blending In adds the first instance of additional choices made during deckbuilding, so we’ve added rules to clarify how those choices are made.

- **NEW RULE:** Additional deckbuilding decisions added.

**Radiance Support:** Equipment Units

- Orianna, Lady of Clockwork presents some unique rules scenarios for the game, including what happens to an Equipment that becomes a unit. We decided on the simplest answer: units can’t be attached to other game objects. If an attached game object becomes a unit, it detaches immediately.

- **CLARIFIED RULE:** Units cannot be attached to other game objects.

- **CLARIFIED RULE:** If an attached non-unit game object becomes a unit, it detaches as it becomes a unit.

**Rules Update:** Layer Calculations and Object Dependencies

- We’ve added rules for layer calculations in an effort to support future interactions and clarify how the layer effects are calculated.

- When calculating layer effects, each game object is treated individually. If a game object needs to reference information from another game object, the game evaluates that game object’s layer information before returning to calculate the original game object’s information.

- If multiple game objects reference information from each other, instead evaluate all of their information simultaneously, layer by layer.

- **NEW RULE:** Layer calculation procedure added.

**Rules Update:** Pick

- We’re starting to see the word “pick” appear on cards, which will become even more important when *Legacy* releases early next year. Pick is the word we’re moving towards for when you make a choice that isn’t a target. We want to make it clear to players that when a card says for you to “choose” something, that means you are targeting what you choose.

- When the *Legacy* rules and templating change is implemented in card text, many cards that currently say “choose” will have their text updated to pick. We are doing some of that work in *Radiance.*As such, we can also make this clearer in the rules prior to the *Legacy*rules update.

- **NEW RULE:** Pick added.

**Rules Update:** Conditional Clause Scope

- In *Vendetta* we saw some players understandably confused over the scope of conditional clauses in instruction text.

- With the *Radiance* rules update, we’ve clarified what scope conditional clauses have in a given instruction.

- **NEW RULE:** Conditional clauses scope added.

**Rules Update:** Finalizing Time Actions Scope

- We received feedback that cards which referred to “you” when checking if costs were paid or actions were taken was confusing if control of the card is gained by another player. New rules have been added to clarify this.

- **NEW RULE:** Instructions of a spell or ability may reference actions taken during Finalization. They will do so by checking whether “you” performed those game actions.

- **NEW RULE:** These instructions check whether the game action was performed, not by whom. If another player gains control of the spell or ability after the game action was performed during finalization, it will still be considered true for the purposes of these instructions.

**Rules Update:** Making New Choices

- In the *Vendetta* rules update we included a model for making new choices as used by cards like Mystic Reversal and Rebuttal. We received feedback that the rules were unclear, and we clarified in the *Vendetta*FAQ how the interim model would work. Upon review, we found we weren’t entirely satisfied with that implementation. We decided to overhaul how new decisions are made to be simpler and more intuitive.

- When making new decisions now, *all* decisions must be made anew. You can choose to make the same decisions as made previously, but if you’re making new decisions, you can’t go halfway.

- Similar to the previous model, all decisions must be legal and valid; however, with this new model, any abilities that trigger on targeting, for example, will trigger again; even if you previously targeted the same unit. It should feel like you’re going through the process of choosing targets all over again.

- **CLARIFIED RULE:** Making new choices updated.

**Rules Update:** Pending Item Target Legality

- Players have long wondered whether pending items are legal to target with spells and abilities. It’s very rare that such a case is possible but, like many strange rules interactions in *Riftbound,* we can blame these few cases on Promising Future. We figured we might as well make it clear: Pending items are *not* legal targets for spells and abilities.

- **NEW RULE:** Pending item target legality clarified.

**Rules Update:**2v2 Scoring

- The rules for 2v2 scoring were slightly contradictory. In the *Vendetta* rules update we cleaned them up, and in this rules update they’ve been fully aligned. Specifically, the final point and scoring eligibility special rules now apply only to teams that maintain control of a battlefield during their own or a teammate’s turn, and not during an opponent’s turn.

- **CLARIFIED RULE:** 2v2 scoring updated.

Empower Abilities

- *Vendetta*’s Kayle, Justified needed some support from the FAQ. We’ve codified that support with the *Radiance*rules update.

- **NEW RULE:** Game Objects with Empower abilities may have or gain permissions to be Empowered multiple times. Such Game Objects ignore the normal “Play only if not Empowered.” restriction on Empower abilities.

- *Note that this means you can activate the ability even if you’re at your max number of empowered statuses. That is intentional! It just does nothing. That is also intentional.*

Negated and Ignored Instructions

- Insightful judges and players recognized some strangeness in the rules for linked instructions from the *Unleashed* rules update, made more apparent by rules added in the *Vendetta* rules update. In the *Vendetta* FAQ we clarified how those rules should function, and now we’re codifying that fix into the *Radiance*rules update.

- If an instruction mistargets, that instruction is *ignored.* If an instruction fails to execute for any other reason, such as it being replaced, skipped, or being impossible to perform, it is *negated.* Instructions that are ignored will cause any later instructions linked to them to also be ignored. If an instruction is negated, later linked instructions will not be negated; they will still execute if possible.

- **NEW RULE:** Negated and ignored instructions added.

Mandatory Requirements and Restrictions

- The *Vendetta* FAQ clarified how Dragon Roost and other mandatory requirements functioned together. We’ve codified that into the rules in the *Radiance* rules update with extra clarifications. We’ve also codified the concept of a restriction: that being an effect like Perched Grimwyrm’s “Play me only to a battlefield you’ve conquered this turn.”

- **NEW RULE:** Mandatory requirements added.

- **NEW RULE:** Restrictions added.

### Legacy Updates

As we’ve shared before, we’re preparing a major update to Riftbound rules with *Legacy* in January. To part the curtain some, this is a massive undertaking—we’re completely reformatting the rules documents to improve their readability as reference for players and judges.

We’re literally starting from the ground up, which will give us room to reduce redundant information, improve ordering, and generally clean up the rules documentation.

To be clear: this is about rewriting the rules to be more readable, and it won’t change how Riftbound’s mechanics actually work.

As always, we do not update the rules of Riftbound or introduce card errata to manage the power level of any card or effect—if we ever need to manage a powerful card, we’ll use other tools.

We’ll release an additional FAQ article after *Radiance* is released to further clarify remaining points of confusion for players and keep you updated as we learn more.
