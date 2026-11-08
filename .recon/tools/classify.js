#!/usr/bin/env node
// Classify pretty chunks by keyword density.
const fs = require('fs'), path = require('path');
const dir = process.argv[2];
const groups = {
  i18n: [/translate|locale|i18n|useTranslations|messages/i],
  carddata: [/printedRulesText|cardId|assetPathSegment|publishedSets|schemaVersion/i],
  engine: [/mulligan|showdown|conquer|recycle|exhaust|initiative|priority|subroutine|resolveStack|gameState|game_state/i],
  realtime: [/PartySocket|matchmaking|roomState|socket|wss?:\/\//i],
  boardUI: [/GameCardArt|playmat|battlefield|boardState|handCard|emote|sleeve/i],
  deck: [/deckCode|importDeck|decklist|deckList|sideboard/i],
  reactUI: [/useState|jsx|React/],
  vendor: [/lodash|moment|d3-|framer|zod|rxjs/i],
};
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));
const rows = [];
for (const f of files) {
  const s = fs.readFileSync(path.join(dir, f), 'utf8');
  const size = s.length;
  const row = { f, kb: Math.round(size/1024) };
  for (const [g, res] of Object.entries(groups)) {
    let n = 0;
    for (const r of res) n += (s.match(new RegExp(r.source, 'gi')) || []).length;
    row[g] = n;
  }
  rows.push(row);
}
rows.sort((a,b) => (b.engine + b.boardUI) - (a.engine + a.boardUI));
const hdr = ['file','kb','engine','boardUI','realtime','carddata','deck','i18n','vendor'];
console.log(hdr.join('\t'));
for (const r of rows) console.log([r.f, r.kb, r.engine, r.boardUI, r.realtime, r.carddata, r.deck, r.i18n, r.vendor].join('\t'));
