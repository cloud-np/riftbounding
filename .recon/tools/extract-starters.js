// Extract sealed-format starter kits (preset decks) from the pretty chunk.
const fs = require('fs');
const path = process.argv[2];
const src = fs.readFileSync(path, 'utf8');

// Grab from the `t = (...) => ({` definition through the end of the D array (before `l = {`).
const start = src.indexOf('let t = (e, t, r, n, a, N) => ({');
const end = src.indexOf('      l = {', start);
if (start < 0 || end < 0) throw new Error('anchors not found');
let body = src.slice(start, end);
// `r` is a top-level identifier used by the literal; make it const-declarable.
body = body.replace(/^\s*let /m, 'let ');
body = body.replace(/[\s,]+$/, '');
const fn = new Function(body + `;` + `
  return { radiance: r, unleashed: A, vendetta: D,
           ids: { unleashed: n, vendetta: a, radiance: N, vendettaSealed: o } };
`);
const out = fn();
console.log(JSON.stringify(out, null, 1));
