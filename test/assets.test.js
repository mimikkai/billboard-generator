import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

test('extracted assets and licensed fallback fonts match recorded provenance', async () => {
  const manifest = JSON.parse(await readFile(new URL('../assets/provenance.json', import.meta.url), 'utf8'));
  const fonts = JSON.parse(await readFile(new URL('../assets/fonts/provenance.json', import.meta.url), 'utf8'));
  for (const entry of [...manifest.files, ...fonts]) {
    assert.ok(/^(assets|web)\//.test(entry.file) && !entry.file.includes('..'));
    const bytes = await readFile(new URL('../' + entry.file, import.meta.url));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), entry.sha256, entry.file);
  }
  const logo = await readFile(new URL('../assets/runtime/logo.txt', import.meta.url), 'utf8');
  const lines = logo.trimEnd().split('\n');
  assert.equal(lines.length, 19);
  assert.equal(Math.max(...lines.map(l => [...l].length)), 81);
  const textLogo = await readFile(new URL('../assets/runtime/logo-text.txt', import.meta.url), 'utf8');
  const textLines = textLogo.split('\n').slice(0, -1); // trailing newline, rows stay unpadded-trimmed
  assert.equal(textLines.length, 19);
  assert.equal(new Set(textLines.map(l => [...l].length)).size, 1);
  assert.ok([...textLines][0].length >= 30);
  // runs of >= 3 consecutive all-space columns across every row (the widened letter gaps)
  const gapRows = textLines.map(l => [...l].map(c => c === ' '));
  const isBlankCol = i => gapRows.every(row => row[i]);
  let gaps = 0;
  for (let i = 0; i < textLines[0].length;) {
    if (isBlankCol(i)) {
      let j = i; while (j < textLines[0].length && isBlankCol(j)) j++;
      if (j - i >= 3) gaps++;
      i = j;
    } else i++;
  }
  assert.ok(gaps >= 7, `expected at least 7 runs of 3+ all-space columns (widened letter gaps), found ${gaps}`);
});
