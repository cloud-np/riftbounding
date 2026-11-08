#!/usr/bin/env node
// Extract the embedded card catalog array from the pretty chunk (public bundle data).
const fs = require('fs');
const src = fs.readFileSync(process.argv[2], 'utf8');
const anchor = 'let i = [';
const at = src.indexOf(anchor);
if (at < 0) throw new Error('anchor not found');
let i = at + anchor.length - 1; // at '['
let depth = 0, j = i, inStr = null, esc = false;
for (; j < src.length; j++) {
  const c = src[j];
  if (inStr) {
    if (esc) esc = false;
    else if (c === '\\') esc = true;
    else if (c === inStr) inStr = null;
    continue;
  }
  if (c === '"' || c === "'" || c === '`') { inStr = c; continue; }
  if (c === '[') depth++;
  else if (c === ']') { depth--; if (depth === 0) break; }
}
const text = src.slice(i, j + 1);
const arr = new Function('return ' + text)();
const cards = {};
for (const c of arr) cards[c.id] = c;
fs.writeFileSync(process.argv[3], JSON.stringify({ schemaVersion: 'embedded-v1', extractedFrom: process.argv[2], count: arr.length, cards }, null, 1));
console.log('cards:', arr.length, 'types:', [...new Set(arr.map(c => c.type))].join(','));
