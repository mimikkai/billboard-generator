import { readFile } from 'node:fs/promises';
const blocks = { '█': [0, 0, 1, 1], '▀': [0, 0, 1, .5], '▄': [0, .5, 1, .5], '▐': [.5, 0, .5, 1], '▌': [0, 0, .5, 1] };
// The supplied FIGlet font has no digits. These are local block constructions,
// not purported original font glyphs. Three-cell stems match the lettering weight.
const digits = {
  '0': [' ####### ', '###   ###', '###   ###', '###   ###', '###   ###', '###   ###', '###   ###', ' ####### '],
  '1': ['   ###   ', ' #####   ', '   ###   ', '   ###   ', '   ###   ', '   ###   ', '   ###   ', ' ####### '],
  '2': [' ####### ', '###   ###', '      ###', '    #### ', '  ####   ', ' ###     ', '###      ', '#########'],
  '3': ['######## ', '      ###', '      ###', '  ###### ', '      ###', '      ###', '###   ###', ' ####### '],
  '4': ['###   ###', '###   ###', '###   ###', '#########', '      ###', '      ###', '      ###', '      ###'],
  '5': ['#########', '###      ', '###      ', '######## ', '      ###', '      ###', '###   ###', ' ####### '],
  '6': [' ####### ', '###      ', '###      ', '######## ', '###   ###', '###   ###', '###   ###', ' ####### '],
  '7': ['#########', '      ###', '     ### ', '    ###  ', '   ###   ', '  ###    ', ' ###     ', '###      '],
  '8': [' ####### ', '###   ###', '###   ###', ' ####### ', '###   ###', '###   ###', '###   ###', ' ####### '],
  '9': [' ####### ', '###   ###', '###   ###', ' ########', '      ###', '      ###', '      ###', ' ####### '],
};

function fontRows(font, char) {
  const lines = font.split(/\r?\n/), header = lines[0].split(/\s+/);
  if (header[0] !== 'flf2a$' || Number(header[1]) !== 9) throw Error('Unsupported suffix font format.');
  if (!/^[A-Z0-9-]$/.test(char)) throw Error('Suffix font glyph must be a letter, digit or hyphen.');
  const start = 1 + Number(header[5]), height = Number(header[1]), end = lines[start].at(-1);
  return lines.slice(start + (char.charCodeAt(0) - 32) * height, start + (char.charCodeAt(0) - 31) * height)
    .map(line => { while (line.endsWith(end)) line = line.slice(0, -1); return line.replaceAll('$', ' '); });
}
export function fontGlyph(font, char) {
  if (digits[char]) return [...digits[char], '         '].map(row => row.replaceAll('#', '█'));
  let rows = fontRows(font, char);
  // The historical D removes one interior column, keeping stems and terminals.
  if (char === 'D') rows = rows.map(row => row.slice(0, 5) + row.slice(6));
  const occupied = rows.flatMap(row => [...row].flatMap((c, i) => c === ' ' ? [] : [i]));
  if (!occupied.length) throw Error(`Empty suffix glyph: ${char}`);
  const left = Math.min(...occupied), right = Math.max(...occupied);
  return rows.map(row => row.padEnd(right + 1).slice(left, right + 1));
}

export async function buildWordmark(tld) {
  // MimikkAi mark + smooth Inter-lettered domain suffix ("dot + letters").
  // The suffix comes from assets/inter-suffix.json: rect decompositions of
  // Inter Bold outlines with cap height 190 px and a baseline at y = 0.
  if (!/^\.[A-Z0-9-]+(?:\.[A-Z0-9-]+)*$/.test(tld)) throw Error('Invalid normalized suffix.');
  const svg = await readFile(new URL('../assets/official-wordmark.svg', import.meta.url), 'utf8');
  const suffixFont = JSON.parse(await readFile(new URL('../assets/inter-suffix.json', import.meta.url), 'utf8'));
  const base = [...svg.matchAll(/<rect\s+([^>]+)\/>/g)].map(([, attributes]) => {
    return Object.fromEntries(['x', 'y', 'width', 'height'].map(k => {
      const value = Number(attributes.match(new RegExp(`${k}="([\\d.]+)"`))?.[1]) / 10;
      if (!Number.isFinite(value)) throw Error('Unsupported wordmark geometry.');
      return [k, value];
    }));
  });
  if (!base.length) throw Error('Wordmark SVG must contain rectangles.');
  const markWidth = Math.max(...base.map(r => r.x + r.width)), markHeight = Math.max(...base.map(r => r.y + r.height));
  const cellW = markWidth / 81, cellH = markHeight / 19;
  // Suffix cap height spans 9 bitmap rows (~38% of the mark); the baseline
  // rises a third of the unshrunk cap height above the mark's bottom line.
  const capH = cellH * 9, baseline = markHeight - capH / 3;
  // Inter glyphs read denser than the block lettering, so the suffix is
  // scaled below the row-derived cap height to keep visible weight matched.
  const scale = capH * .8 / suffixFont.capH, gap = cellW * 2, suffix = [], glyphs = [];
  let x0 = markWidth + gap;
  for (const char of '.' + tld.slice(1)) {
    const glyph = suffixFont.glyphs.find(g => g.char === char);
    if (!glyph) throw Error(`Suffix lettering lacks ${char}; check assets/inter-suffix.json.`);
    for (const [dx, dy, w, h] of glyph.rects) suffix.push({ x: x0 + dx * scale, y: baseline - (dy + h) * scale, width: w * scale, height: h * scale });
    const advance = suffixFont.advances[char] * scale;
    glyphs.push({ char, x: x0, width: advance });
    x0 += advance + gap;
  }
  return { base, suffix, glyphs, baseWidth: markWidth, fullWidth: x0 - gap, height: markHeight };
}
