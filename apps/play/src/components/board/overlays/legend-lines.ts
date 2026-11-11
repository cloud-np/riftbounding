/**
 * Victory / defeat lines per Legend (owner request: "play a line from the legend's role that is
 * appropriate"). All lines are ORIGINAL (short, in each champion's voice), never Riot's actual voice
 * lines. A line is chosen by how the game ended first (conquest / hold / close / blowout /
 * concession / timeout), then falls back to the champion's plain victory or defeat pool, then to a
 * generic pool. Among equally fitting lines the pick is random but SEEDED per game, so re-renders
 * never change the line.
 */

export type EndSituation =
  | "conquer"
  | "hold"
  | "close"
  | "blowout"
  /** The opponent conceded or left (viewer won) / the viewer conceded or timed out (viewer lost). */
  | "concession";

export interface ChampionLines {
  win: string[];
  lose: string[];
  /** Won / lost by a point or two. */
  wonClose: string[];
  lostClose: string[];
  /** Opponent conceded or left. */
  oppConceded: string[];
  /** Viewer conceded, timed out or disconnected. */
  iConceded: string[];
  /** Optional extras where a champion has a line that obviously fits. */
  conquer?: string[];
  hold?: string[];
  blowout?: string[];
}

/** (win x3, lose x3, wonClose, lostClose, oppConceded, iConceded, extras) */
const P = (
  win: [string, string, string],
  lose: [string, string, string],
  wonClose: string,
  lostClose: string,
  oppConceded: string,
  iConceded: string,
  extra: Partial<Pick<ChampionLines, "conquer" | "hold" | "blowout">> = {},
): ChampionLines => ({
  win,
  lose,
  wonClose: [wonClose],
  lostClose: [lostClose],
  oppConceded: [oppConceded],
  iConceded: [iConceded],
  ...extra,
});

export const GENERIC_LINES: ChampionLines = {
  win: ["The rift is ours. Well fought.", "Victory, earned one rune at a time.", "A clean finish. Remember this one."],
  lose: ["Not today. The rift remembers.", "A hard loss. Learn from it and return.", "Fallen, but not forgotten."],
  wonClose: ["That could have gone either way. It went ours."],
  lostClose: ["So close. A single turn separated us."],
  oppConceded: ["They left the field. The rift is ours by default."],
  iConceded: ["A retreat is not the end. Regroup."],
  conquer: ["We took the ground and kept it."],
  hold: ["We held the line until the very end."],
  blowout: ["It was never in doubt."],
};

/** Keyed by champion (the part of the Legend's name before the comma). */
export const LEGEND_LINES: Record<string, ChampionLines> = {
  Ahri: P(
    ["Every heart tells me where to step next. You were easy to read.", "Pretty, isn't it? Winning, I mean.", "I let you think you had a chance. It was kinder."],
    ["Hm. I misjudged that one. It happens, once.", "You caught me. Enjoy it while the moon is up.", "Even a fox trips on the last stair."],
    "A narrow win still counts. I will take it with a smile.",
    "One step short. I'll be quicker next time.",
    "You ran before the dance ended. Shame.",
    "I fold the game, not the story.",
  ),
  Akali: P(
    ["Quiet work. Clean result.", "You never saw the blade. That was the point.", "The balance holds, and so do I."],
    ["You were quicker. That will not happen twice.", "A shadow can still be cornered.", "Fine. I'll learn your rhythm and come back."],
    "A thin margin, but a kill is a kill.",
    "A hair too slow. I felt it.",
    "You vanished mid-fight. Not even a challenge.",
    "I step back into the dark. Not defeated, only gone.",
  ),
  Ambessa: P(
    ["Strength decides. It decided.", "Kneel to the better plan, not to me.", "My house wins what it sets its hand on."],
    ["Loss is a tax. I will not pay it twice.", "You earned that. Do not mistake it for mercy.", "I will remember the faces that beat me."],
    "Even a narrow win is still a crown.",
    "Barely beaten. I'll settle that debt.",
    "You fled the war room. Weakness has a smell.",
    "I yield the field, not the campaign.",
    { conquer: ["I took the ground. Now it answers to me."], hold: ["Hold the line, and the line becomes a wall."] },
  ),
  Annie: P(
    ["We won! Tibbers, we won!", "That was fun. Can we do it again?", "Did I do good? I think I did good!"],
    ["Aww, that's not fair... okay, it's a little fair.", "Tibbers is sad now. So am I.", "I'll beat you next time. Maybe with snacks."],
    "That was scary close! I'm shaking!",
    "So close! One more turn and it would've been mine!",
    "Hey, where are you going? I wasn't done!",
    "Okay, okay, you win. Don't tell Tibbers I gave up.",
  ),
  Azir: P(
    ["The sands remember an emperor. They remember today.", "My empire rises again, one legion at a time.", "All of this was foretold. All of this was mine."],
    ["The sands shift. Even emperors learn to wait.", "A setback. A throne is not built in one day.", "You have taken a grain. I still own the desert."],
    "A narrow victory is still a coronation.",
    "I was one step from the throne. I'll climb again.",
    "You abandon the field? The desert has its answer.",
    "I withdraw to the dunes. The empire endures.",
    { conquer: ["Where my standard stands, an empire begins."], hold: ["The sun sets on others. Never on my ground."] },
  ),
  Darius: P(
    ["Another banner falls. Noxus advances.", "Strength is the only argument that never loses.", "You fought well. It changes nothing."],
    ["I do not hide from defeat. I answer it.", "You struck true. The next blow is mine.", "A lost battle. The war is mine to finish."],
    "A close fight. Noxus does not need pretty wins.",
    "That close, and I still fell. It will not stand.",
    "Running from battle? Pathetic.",
    "A fighter may retreat once. Never twice.",
    { conquer: ["The ground is taken. Raise the banner."], blowout: ["It was not a duel. It was an execution."] },
  ),
  Diana: P(
    ["The moon rises, and you are in its light.", "Silver and shadow, and I stand in the one you fear.", "This night belongs to the moon. And to me."],
    ["The moon sets, but it always comes back.", "Dimmed, not darkened.", "You have the night. I keep the dawn."],
    "The moon was barely full, but it was enough.",
    "Hair's breadth. The next moon will be brighter.",
    "You fled the moonlight. It will find you anyway.",
    "I leave the field. The moon does not.",
  ),
  Draven: P(
    ["Admit it, you loved the show. I know I did!", "Draven wins! Draven always wins! Say it with me!", "Applause, please. Flowers optional."],
    ["A loss? Me? There must be a mistake. Wait, no. Nope. Rematch.", "The crowd goes quiet. I hate that.", "Fine, you were good. Not Draven good, but good."],
    "Cutting it fine, just to make it dramatic.",
    "One point short. The crowd is cheering for the wrong guy.",
    "You left before the encore? Rude.",
    "Even Draven bows out sometimes. Briefly.",
    { blowout: ["That wasn't a game, that was a performance."] },
  ),
  Ekko: P(
    ["Saw how this ends. Took the good timeline.", "Nice try. Check the clock, I'm early.", "Winners rewind. I just never had to."],
    ["Alright. Rewind. I'm taking that one back.", "I've lost this one before. I'll lose it better next time.", "Not my best timeline. Next!"],
    "Barely made it. Don't tell the other timelines.",
    "A second more and I'd have had it. I'll find that second.",
    "You bailed? I wasn't even done stalling.",
    "Fine, fold this one. Time loops, I'll be back.",
  ),
  Evelynn: P(
    ["Mm. That was almost tender.", "You were a lovely game. Thank you for playing.", "Run along now. I've had my fill."],
    ["You caught me in a weak moment. Sweet.", "Don't smile yet, darling. The night is long.", "Beaten? No. Bored. Soon, I'll be hungry."],
    "Close, wasn't it? I do enjoy the nervous ones.",
    "A whisper short. I'll haunt you for it.",
    "You left so soon. We were just getting intimate.",
    "I leave this table for now. Sleep lightly.",
  ),
  Ezreal: P(
    ["Boom! Another treasure for the shelf.", "Told you I'd pull it off. Eventually.", "That's a map worth framing. Well played!"],
    ["Okay, that went sideways. Classic exploring.", "Ah. The treasure was a trap. Again.", "I'll just call it research and go again."],
    "Phew! Barely made it out with the loot.",
    "So close I could smell the treasure.",
    "Hey, don't go yet. I was about to be impressive.",
    "Strategic retreat! That's exploring, too.",
  ),
  Fiora: P(
    ["Honour satisfied. Next challenger.", "A duel, fairly won. Well fenced.", "Precision wins. It always has."],
    ["You were the better blade today. I salute it.", "A flaw in my footwork. I will mend it.", "Defeat is a lesson I am glad to be taught."],
    "Won by a single touch. The sharpest kind.",
    "One touch from victory. I will find the other.",
    "You left mid-duel. Where is your honour?",
    "I yield. A duelist must know when.",
  ),
  Garen: P(
    ["For Demacia! And for everyone who stood behind me!", "Justice served. Stand easy, soldiers.", "Steady shields and a steady sword. That was the plan."],
    ["We fall back, we regroup, we return.", "A loss is a lesson. Demacia learns.", "You fought with honour. I respect that."],
    "A close one, but Demacia holds.",
    "A single step more and we'd have had them.",
    "They left the field. Disappointing, but the day is ours.",
    "A soldier retreats to fight another day.",
    { conquer: ["The ground is ours. Raise the banner high!"], hold: ["Hold the line! Not one step back!"] },
  ),
  Irelia: P(
    ["Every blade danced exactly where I wished.", "For Ionia, and for those who believed.", "Grace is the strongest edge."],
    ["My blades missed. My resolve did not.", "A stumble in the dance. I will find my step.", "Ionia endures, and so do I."],
    "A narrow edge is still an edge.",
    "A breath from victory. I'll find that breath.",
    "You left the dance? The music was just rising.",
    "I step off the floor. The dance is not over.",
  ),
  Ivern: P(
    ["Oh, the forest is so pleased! Thank you, friend!", "A good game grows good friends. Hello, new friend!", "Everything is exactly where it belongs."],
    ["Oh dear, a little wilted. We'll sprout again!", "Don't be sad. Even the best seeds take a season.", "A cloudy day. The rain makes things grow."],
    "A tiny win! Tiny wins bloom into big ones.",
    "Almost! Just a few more days of sun.",
    "Oh, you're leaving? Come back when you're ready!",
    "I'll take a little nap in the grass. See you soon.",
  ),
  "Jarvan IV": P(
    ["A prince's duty fulfilled. Demacia is proud.", "Stand tall. We have won with honour.", "Let the banners fly. The day is ours."],
    ["A prince must bear defeat as well as glory.", "We were bested. We will be better.", "Even royal armour dents. The line holds."],
    "A narrow victory, but a victory. Demacia thanks you.",
    "A single stride away from glory. We will take it next time.",
    "They run from a fair fight. A prince does not.",
    "I lower my lance. For now.",
    { conquer: ["The standard is planted. The ground is Demacia's."] },
  ),
  Jax: P(
    ["You brought a plan. I brought a lamppost.", "Class dismissed. Take notes.", "Better luck next lesson, student."],
    ["Huh. That one stings. Good hit.", "A master is just someone who lost more often. I'm learning.", "Fine. Round two, and bring your A game."],
    "Won by a whisker. A master's whisker.",
    "Lost by a whisker. A master's whisker. I hate that.",
    "You quit mid-lesson? That's an automatic failure.",
    "I'm sitting this one out. Don't read into it.",
  ),
  Jayce: P(
    ["Progress wins. It always does.", "The future was ready. Were you?", "Calculated, built, delivered. Next."],
    ["Back to the workshop. There's a flaw to fix.", "That design didn't hold. I'll iterate.", "A failed trial is still data."],
    "Within tolerances. Barely.",
    "A fraction of a percent away. I'll find it.",
    "You walked off mid-test. The data will have to do.",
    "I'll go back to the drawing board. Don't wait up.",
  ),
  Jhin: P(
    ["And that is the final act. The audience is silent, awed.", "A masterpiece, in four quiet beats.", "The curtain falls on a flawless piece."],
    ["A dissonance. My art was interrupted.", "Not every performance is a triumph. I will refine.", "The critics may be unkind. I will not."],
    "A tense finale. The best kind.",
    "One note off. The whole performance, wasted.",
    "You left before the curtain call? Unforgivable.",
    "I withdraw this piece. It was unworthy of me.",
  ),
  Jinx: P(
    ["Boom! Did you see that? Tell me you saw that!", "Haha! Best game ever! Do it again!", "I win! Everybody clap! Clap harder!"],
    ["Aww, no fun... okay, a little fun.", "That's not how it goes in my head. Rewind!", "Fine. You get the bang this time. I'll get the next one."],
    "Whoa, whoa, that was close! My heart's doing flips!",
    "Oooh, almost! So close it hurts. I like it.",
    "You're leaving?! But I haven't even blown anything up!",
    "I quit! No, wait, I'm just taking a break. Totally different.",
    { blowout: ["Pow! And then pow again! Too easy!"] },
  ),
  "K'Sante": P(
    ["Pride earned, not given. Today I earned it.", "Nazumah walks tall tonight.", "I carried the weight. The weight carried me."],
    ["Pride bruises. It does not break.", "I overreached. I'll measure better.", "The shield dented. The man did not."],
    "A close finish. I'll learn from how close.",
    "Short by a breath. A breath I'll find.",
    "You gave up the field. I won't gloat. Much.",
    "I step back. Pride is patient.",
  ),
  "Kai'Sa": P(
    ["The void answers. Today, so did I.", "I survived worse than you.", "Both of us, stronger. Thanks for the push."],
    ["The void is patient. So am I.", "You hit harder than I expected. It won't repeat.", "I'll hunt you in the next one."],
    "That was close. The void almost had us.",
    "A heartbeat short. We'll fix it.",
    "You left. The void gets what it wants anyway.",
    "I retreat to the shadows. Only to return.",
  ),
  Kennen: P(
    ["Lightning struck. Quick, clean, done!", "Small, fast, and extremely satisfied!", "Did you blink? That's all it took."],
    ["Ow. Okay, a little slower than planned.", "Even storms run out of charge. I'll recharge.", "Next time I'll be faster. Promise."],
    "Won by a zap! A tiny, tiny zap!",
    "One zap short. Grr!",
    "Where did you go? I wasn't done zooming!",
    "Okay, okay. Pausing. Recharging. Back soon!",
  ),
  "Kha'Zix": P(
    ["Prey acknowledged. Hunt complete.", "Stronger. Evolved. Yours was a good meal.", "The weak adapt. You did not. Yet."],
    ["Pain is useful. It teaches the next form.", "You are prey no more. Interesting.", "I will evolve past this."],
    "Barely fed. Still hungry.",
    "A whisker from the kill. I will hunt again.",
    "You flee? Good. Hunters like a chase.",
    "I slip away. The hunt isn't over.",
  ),
  LeBlanc: P(
    ["Oh, you thought that was your move? How sweet.", "All the strings, all in my hands.", "I told you I'd win. Or did I? Never mind."],
    ["A momentary lapse. I will rewrite it.", "How delightful. You surprised me. Once.", "Do not smile. The game is longer than one hand."],
    "Won by a thread. The thread was mine.",
    "A thread short of triumph. I'll weave tighter.",
    "You fled the table? Fascinating.",
    "I fold. Don't confuse that with losing.",
  ),
  "Lee Sin": P(
    ["Patience, and the mountain moves.", "Balance in mind, power in hand. The path is clear.", "A fine fight. I bow to my opponent."],
    ["I fell, but I have learned. That is the path.", "A fist was blind. The mind was not.", "Defeat is a teacher. I am a willing student."],
    "A close victory is a quiet victory.",
    "One breath short of harmony. I will find it.",
    "You left? Calm down, friend. We can still talk.",
    "I bow out. Humility is also a technique.",
  ),
  Leona: P(
    ["The sun rises. It never asked permission.", "Stand in the light, and be unafraid.", "The dawn has come. Rest, everyone."],
    ["The sun sets. It rises again, always.", "I stumbled. I will stand.", "Even the dawn is delayed. It never fails."],
    "A narrow dawn. A dawn all the same.",
    "A sliver of light short. We will find it.",
    "They abandoned the battle. The light waits.",
    "I step back from the field. The sun waits for no one, but it returns.",
    { conquer: ["The ground bathes in light. It is held now."], hold: ["I am the wall at dawn. Nothing passes."] },
  ),
  Lillia: P(
    ["Oh, I did it! The dreams sing!", "Tee-hee! The whole forest cheered for that!", "I'm so happy, I could faint. Is that okay?"],
    ["Oh... that was a scary dream. Can I wake up?", "I'll be braver in the next dream. Promise.", "The forest isn't mad. It's just sleepy."],
    "That was so close my knees wobbled!",
    "Oh no, so close! I'll try one tiny bit harder!",
    "Wait, where did you go? We were just getting started!",
    "I'm gonna curl up for a bit. Tell the others I'm okay.",
  ),
  Lucian: P(
    ["Done. Two shots, no mercy, no regrets.", "Quick hands, steady aim. Next.", "Every shadow answers to the light. Today, that's me."],
    ["Missed one. Won't miss two.", "You were quicker. Admit it, it won't last.", "A dark day. A short one."],
    "A close shave. I'll take it.",
    "A shot too slow. I'll sleep on it. Briefly.",
    "You ran? Then I'll find you next time.",
    "I'll holster the guns, for now.",
  ),
  Lux: P(
    ["We did it! Light wins!", "Did you see that sparkle? That was us!", "Everyone deserves a bright ending. Today was ours!"],
    ["Oh. Well. That didn't work. Let's try the other way!", "I'm not giving up. I'm just... recalculating.", "A little dark. A little brave. Still shining."],
    "Phew! That was so close, I almost lost my sparkle!",
    "Almost! The light was right there, I could feel it.",
    "Oh, you're going? We'll play another time, okay?",
    "I'll step back, but I'm not giving up the light.",
    { conquer: ["Look at it shine! The whole ground is glowing!"], hold: ["I'm standing right here. And I'm not moving."] },
  ),
  "Master Yi": P(
    ["Mind still, blade still. It is done.", "The move before the move is where the fight is won.", "A calm heart wins quickly."],
    ["I lost my centre. I will find it.", "Swift is not the same as wise. I forgot.", "Defeat is a mirror. I look into it."],
    "A narrow victory. I accept the lesson in it.",
    "A single breath too late. I will meditate on that.",
    "You have left the dojo. The door remains open.",
    "I sheathe my blade. A pause, not an ending.",
  ),
  Mel: P(
    ["As reflected, so returned. Elegant.", "Each strike you sent was a gift. Thank you.", "Everything you did helped me finish it."],
    ["I misjudged your light. It won't happen twice.", "A pattern I did not foresee. Fascinating.", "Reflect, adjust, return. Standard practice."],
    "A narrow margin, but not an accident.",
    "A sliver away. I'd like to see it again.",
    "You abandoned the match? Predictable.",
    "I withdraw. For now. You will see me again.",
  ),
  "Miss Fortune": P(
    ["Pay up, sweetheart. House always wins.", "Bounty collected. Drinks are on me!", "You never had the cards. I did."],
    ["Well, shoot. That was a bad hand.", "Don't spend the winnings yet. I know where you sleep.", "A lost bounty. Nothing a rematch won't fix."],
    "That was close enough to spill my drink.",
    "A hair shy of the pot. I'll double down.",
    "Folded before the showdown? Cowards pay the house.",
    "I'll fold this hand, but I'm keeping the table.",
  ),
  Mordekaiser: P(
    ["Kneel. Another soul for the iron throne.", "You were never going to leave this realm.", "Death comes for all. I just arrived early."],
    ["Iron does not break. It endures.", "A lost realm is not a lost throne.", "I have been dead before. I'll return."],
    "A narrow conquest. Still a conquest.",
    "A blink short of dominion. I'll remember it.",
    "You flee the afterlife? There is no exit.",
    "I yield the field. The throne does not move.",
    { blowout: ["You were never my equal. Merely my entertainment."] },
  ),
  Nasus: P(
    ["I have counted every move. Yours are all accounted for.", "The ledger closes, and you are the sum.", "Patience. Always patience. Always victory."],
    ["Defeat is also a page in the library.", "I will record this, and correct it.", "Even an archive has gaps. I will fill them."],
    "A narrow sum. But still positive.",
    "A decimal short. I will account for it.",
    "You withdrew from the record. It is noted.",
    "I yield this chapter. The book continues.",
  ),
  Orianna: P(
    ["Precision, and a few well-wound gears. Done.", "Exactly as calculated.", "A flawless sequence. Thank you for playing."],
    ["A gear slipped. I will recalibrate.", "An unexpected variable. How interesting.", "I will review the logs and return."],
    "Within tolerance, barely. That is enough.",
    "A fraction short. Recalibrating.",
    "You left the machine running. Rude.",
    "I will power down for now, and wake again.",
  ),
  Ornn: P(
    ["Forged true, and tested. Good work.", "Hammer to anvil, and the job is done.", "Strong things last. That was a strong thing."],
    ["A crack in the steel. Back to the forge.", "That one didn't hold. I'll hammer it out.", "Bad metal. Better next batch."],
    "It held, barely. Barely is still holding.",
    "A hair of tolerance short. I'll reforge.",
    "You left the forge? The metal's still hot.",
    "I'll cool the fire for now. It'll be back.",
    { hold: ["Strong foundations. Nothing moves them."] },
  ),
  Poppy: P(
    ["Yep! That's how you do it, hammer first!", "Small, stubborn, and still standing.", "I told you I'd hold the line. I held the line."],
    ["Ouch. That hurt. But I'm still up!", "I'll be back. Hammers don't quit.", "Sometimes you lose. Then you pick up the hammer again."],
    "That was close! But close counts.",
    "A bit short. Next time, I swing harder.",
    "Aw, you left? I was getting warmed up!",
    "I'll sit this one out, but I'm not done.",
    { hold: ["Held the ground! Told you I would!"] },
  ),
  Pyke: P(
    ["Paid in full. The tide takes the rest.", "Fresh water for the fish. Good night.", "Debt settled. Collect elsewhere."],
    ["I have drowned before. This one is no different.", "A bad tide. A better one is coming.", "You got the better of me. You'll pay for it."],
    "A thin margin. A thin blade does the same.",
    "A hair short of settling the debt. I'll collect.",
    "Run, then. The sea remembers.",
    "I sink for now. I always resurface.",
  ),
  "Rek'Sai": P(
    ["The ground trembles. It is mine.", "Hunt finished. Hunger quiet. For now.", "You never heard me. That was the point."],
    ["I will dig deeper. I will return.", "Scent lost. Not for long.", "A trap was set. It was not mine."],
    "A close hunt. The best meals are.",
    "Almost. The ground did not help me.",
    "Fleeing prey. The hunt only gets sweeter.",
    "I burrow under, and wait.",
  ),
  "Renata Glasc": P(
    ["Everything has a price. Today, you paid.", "A well-negotiated outcome. For me.", "Good business. Your credit is revoked."],
    ["A loss. I'll find a way to profit from it.", "Debts come due. I will remember this one.", "A temporary setback. My assets are patient."],
    "A narrow margin is still a profit.",
    "Slightly under budget. I'll recoup.",
    "You left the table? I'll bill you for your seat.",
    "I withdraw from this deal. Not from the market.",
  ),
  Renekton: P(
    ["I told you the sands would take you.", "Fury feeds fury. I am well fed.", "That was fun. I want more."],
    ["You are lucky. I won't be gentle again.", "I will crush you next time.", "The rage cools. It does not die."],
    "A close kill. I like them messy.",
    "A hair short. I will rip it out of you next time.",
    "You fled? Run. I can smell you.",
    "I walk away, but only to sharpen the rage.",
  ),
  Rengar: P(
    ["The hunt ends. The trophy is mine.", "You were a worthy prey.", "Silence, then the strike. As always."],
    ["The prey escapes. I will track it.", "You were clever. Not clever enough, next time.", "A trophy lost. Another waits."],
    "Narrow kill. Still a kill.",
    "A claw short of the kill. I'll find your scent again.",
    "You flee the hunt? I always enjoy a chase.",
    "I leave the trail, but I am not done.",
  ),
  Riven: P(
    ["What was broken is mended, a little.", "I don't ask forgiveness. I took the win.", "The blade was broken. The will wasn't."],
    ["Another failure. Another lesson.", "I've lost worse. I'm still here.", "A rough fall. I will stand."],
    "A narrow win. After everything, I'll take it.",
    "A hair short. I've been closer to nothing.",
    "You left. I've been left before. It doesn't change me.",
    "I step back. I've done it before, and I've always come back.",
  ),
  Rumble: P(
    ["Ha! Mechanized and magnificent! Take notes!", "That was science! Real, loud science!", "Rumble wins! Bring the next one!"],
    ["Ouch! Bad calibration! Back to the lab!", "Hey, that wasn't in the specs!", "A setback! A very small one! Barely noticeable!"],
    "That was close! Nobody tell the others I sweated!",
    "Argh, one bolt short! Just one!",
    "Hey, you can't quit on science!",
    "I'm going back to the lab! Don't touch anything!",
  ),
  Seraphine: P(
    ["That was so beautiful! We made it together!", "Hear that? It's the whole room singing!", "Oh, thank you! You made it sparkle!"],
    ["That wasn't the song I wanted, but it was a song.", "A wrong note. I'll try a different key.", "Don't worry. Every song has a rest."],
    "A tiny finish, but the note rang true.",
    "Almost the perfect chord. I'll find the last note.",
    "You left? But the song was almost done!",
    "I'll set my instrument down. For now.",
  ),
  Sett: P(
    ["The Boss wins. Surprise, surprise.", "Don't feel bad. Everybody loses to me eventually.", "Take a seat. Show's over."],
    ["Huh. You hit harder than I thought. Respect.", "One loss. I'll make it two for you.", "Fine, fine. Round two. Same rules."],
    "Took the whole thing to win. I love it.",
    "A hair short! Not the Boss's best moment.",
    "You tapped out? Wasn't even sweating.",
    "I'm taking a breather. Don't think it's over.",
  ),
  Shen: P(
    ["Balance, kept.", "A calm mind. A steady blade.", "Duty done. The world is quiet again."],
    ["I failed my duty. I will correct it.", "I lost my balance. I will find it.", "A hard lesson. I accept it."],
    "A narrow margin, but balance held.",
    "Just short of balance. I will meditate on it.",
    "You left the field. The duty remains mine.",
    "I withdraw. My duty doesn't end here.",
    { hold: ["I stand where I must. Nothing passes."] },
  ),
  Sivir: P(
    ["Easy money. You lose, I get paid.", "Next time, bring a bigger bounty.", "Thanks for the game. Thanks for the gold."],
    ["That cost me. I'll earn it back.", "You got lucky. Lucky only lasts so long.", "Bad contract. Next one's mine."],
    "Close, but I get paid either way.",
    "A single coin short. I'll find it.",
    "You left before payday? Smart. Cowardly, but smart.",
    "I'll take my blade and my coin and go.",
  ),
  Teemo: P(
    ["Scouting report: total victory! Hehe!", "Hehe! You never saw it coming!", "Scouting complete! Everyone's welcome to cheer."],
    ["Aww, mushrooms! Retreating! Strategically!", "Teemo will be back. Teemo is always back.", "I'll just... go hide for a bit."],
    "That was close! I did not squeak. Much.",
    "So close! Next time, extra mushrooms.",
    "You left the scouting mission? How rude.",
    "Strategic retreat! Fully planned!",
    { hold: ["You shall not pass! These mushrooms say so!"] },
  ),
  Vex: P(
    ["Ugh. Fine. You can go. I'm bored.", "Good. Now leave me alone.", "Did I win? Cool. Can I go back to sulking?"],
    ["Whatever. I didn't want it anyway.", "Great. Even losing is boring.", "I hate this. Do it again so I can hate it less."],
    "Won by a nose. Don't make me smile.",
    "Lost by a nose. Typical.",
    "You left? Finally, some quiet.",
    "I'm out. Don't call me.",
  ),
  Vi: P(
    ["Knuckles first, questions later. Done.", "That's how it's handled in Piltover.", "Case closed. Somebody get ice for my fists."],
    ["Ouch. Okay, you earned that one.", "Fine. Round two, and I'm not holding back.", "Next time I punch harder."],
    "That was close. Don't tell anyone I sweated.",
    "One punch short. Argh.",
    "You ran off? Nice. Saved me the trouble.",
    "I'm done for now. Don't push it.",
  ),
  Viktor: P(
    ["The glorious evolution proceeds as expected.", "Inefficiency has been removed. You were part of it.", "Progress demands outcomes. This is one."],
    ["A flaw was found. It will be corrected.", "Not every prototype works. This one will.", "I will iterate. The machine does not tire."],
    "A narrow success. Still within acceptable parameters.",
    "A fraction of a degree short. I will refine.",
    "You abandoned the experiment. Unfortunate.",
    "I will pause the process. It will resume.",
  ),
  Volibear: P(
    ["The storm crowns its king!", "Roar! Let the thunder tell the rest!", "You called the storm. It answered me."],
    ["The storm rests. It does not die.", "You were fierce. I respect that.", "Even thunder has to wait for the clouds."],
    "A narrow victory! The storm is hungry anyway!",
    "A rumble too soft. I'll roar louder.",
    "You fled the storm? It will find you.",
    "I walk off. The sky will remember.",
  ),
  Yasuo: P(
    ["The wind chose its side. It was mine.", "No master. No plan. Still won.", "Well fought. Walk with the wind."],
    ["I lost my footing. It happens.", "You were fast. The wind will be faster.", "A loss. I've survived worse."],
    "A narrow win. The wind had to choose.",
    "A step too slow. I'll catch the next gust.",
    "You left? Even the wind knows when to stop.",
    "I'll walk away. The wind takes me elsewhere.",
  ),
  Zed: P(
    ["Your shadow lost before you did.", "Everything has a weakness. I found yours.", "A good lesson. Thank you for being the student."],
    ["Your shadow bested mine. Impossible, and yet.", "I'll study this. Then I will correct it.", "A flaw in the technique. I'll find it."],
    "A narrow kill. Shadows don't need wide margins.",
    "A shadow's breadth short. It will not repeat.",
    "You left? The shadows will remember.",
    "I withdraw into the dark. Only to return.",
  ),
  Ziggs: P(
    ["Kaboom! That's what I call a finale!", "Everything exploded! Exactly like I planned!", "Did you see that? Of course you did. Everyone did."],
    ["Aww, the fuse was too short. Classic.", "That was a dud! A fantastic, spectacular dud!", "I'll bring bigger bombs next time. Way bigger."],
    "That was close to a misfire! Whoa!",
    "So close to a bigger boom! I'll find more powder!",
    "Hey, where are you going? The best part's next!",
    "I'm leaving, but I'm leaving a surprise.",
  ),
};

/* ------------------------------------------------------------------ resolution */

/** "Jinx, Loose Cannon" -> "Jinx"; "Master Yi, Wuju Bladesman" -> "Master Yi". */
export function legendChampion(name: string | null | undefined): string | null {
  const key = name?.split(",")[0]?.trim();
  return key || null;
}

export function linesForLegend(name: string | null | undefined): ChampionLines {
  const key = legendChampion(name);
  return (key && LEGEND_LINES[key]) || GENERIC_LINES;
}

export interface LineRequest {
  legendName: string | null | undefined;
  won: boolean;
  /** Situations that apply, in priority order (most specific first). */
  situations: EndSituation[];
  /** Stable per-game seed (room code + game number). */
  seed: string;
}

export interface LegendLine {
  text: string;
  attribution: string;
}

/** Small deterministic string hash (FNV-1a) -> [0, 1). */
export function seededUnit(seed: string): number {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

function poolFor(lines: ChampionLines, won: boolean, situation: EndSituation): string[] | undefined {
  switch (situation) {
    case "concession":
      return won ? lines.oppConceded : lines.iConceded;
    case "close":
      return won ? lines.wonClose : lines.lostClose;
    case "conquer":
      return won ? lines.conquer : undefined;
    case "hold":
      return won ? lines.hold : undefined;
    case "blowout":
      return won ? lines.blowout : undefined;
  }
}

/** Candidate lines for a request (exposed for tests): the first situational pool that fits, else the base pool. */
export function candidateLines(request: Pick<LineRequest, "legendName" | "won" | "situations">): string[] {
  const own = linesForLegend(request.legendName);
  for (const situation of request.situations) {
    const pool = poolFor(own, request.won, situation);
    if (pool && pool.length > 0) return pool;
  }
  const base = request.won ? own.win : own.lose;
  return base.length > 0 ? base : request.won ? GENERIC_LINES.win : GENERIC_LINES.lose;
}

export function pickLegendLine(request: LineRequest): LegendLine {
  const pool = candidateLines(request);
  const index = Math.floor(seededUnit(`${request.seed}|${request.legendName ?? ""}|${request.won}`) * pool.length);
  return {
    text: pool[Math.min(index, pool.length - 1)]!,
    attribution: legendChampion(request.legendName) ?? "The Legend",
  };
}
