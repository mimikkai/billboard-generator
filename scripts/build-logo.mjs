import { readFile, writeFile } from 'node:fs/promises';

const bitmap = JSON.parse(await readFile('assets/website-etch/bitmap.json', 'utf8'));
const rows = bitmap.rows.map(row => row.replaceAll('1', '█').replaceAll('0', ' '));
for (const row of rows) if (row.length !== bitmap.width) throw Error(`Bitmap row is ${row.length} wide, expected ${bitmap.width}.`);
if (rows.length !== bitmap.height) throw Error(`Bitmap has ${rows.length} rows, expected ${bitmap.height}.`);
await writeFile('assets/runtime/logo.txt', rows.join('\n') + '\n');

// Compact text-only variant: the emblem owns bitmap columns 0..17, so trim them
// and drop the now-empty margins. 19 rows, one uniform column count, no vertical
// stretch assumptions of its own.
const emblemColumns = 18;
const occupied = Array.from({ length: bitmap.width - emblemColumns }, (_, i) => bitmap.rows.some(row => row[emblemColumns + i] === '1'));
let left = 0; while (left < occupied.length && !occupied[left]) left++;
let right = occupied.length - 1; while (right > left && !occupied[right]) right--;
let text = rows.map(row => row.slice(emblemColumns + left, emblemColumns + right + 1));

// Widen the inter-letter spacing for the compact variant. Column occupancy of the
// trimmed region shows no single empty-column threshold isolates all 8 letters
// ('kk' and the 'A' share tight ink gaps), so letter boundaries are pinned at the
// verified segment edges: M-i-m-i-k-k-A-i.
// letter offsets are relative to the trimmed region, which starts at bitmap col 22.
// Verified by rendering each span from bitmap.json: every span is a whole glyph of
// 'MimikkAi' (M i m i k k A i), pixel-identical to the original region.
const letterColumns = [[0, 10], [12, 13], [16, 24], [26, 28], [30, 36], [38, 45], [47, 55], [57, 58]];
const letterSpacing = 2;
const edgeMargin = 2;
const letters = letterColumns.map(([a, b]) => text.map(row => row.slice(a, b + 1)));
const reSpaced = text.map(() => ' '.repeat(edgeMargin));
for (let n = 0; n < letters.length; n++) {
  letters[n].forEach((row, i) => { reSpaced[i] += row; });
  if (n < letters.length - 1) {
    // keep each pair's natural gap width (blank columns in the source region),
    // widened by 2: a 1-col natural gap becomes 3, etc.
    const naturalGap = letterColumns[n + 1][0] - letterColumns[n][1] - 1;
    letters[n].forEach((_, i) => { reSpaced[i] += ' '.repeat(naturalGap + letterSpacing); });
  }
}
text = reSpaced;
if (new Set(text.map(row => row.length)).size !== 1) throw Error('Text-only rows must share one width.');
await writeFile('assets/runtime/logo-text.txt', text.join('\n') + '\n');