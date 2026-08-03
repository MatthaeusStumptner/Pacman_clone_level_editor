import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, resolve } from 'node:path';
import vm from 'node:vm';

function extractLiteral(source, constantName) {
  const declaration = `const ${constantName} =`;
  const declarationIndex = source.indexOf(declaration);
  if (declarationIndex < 0) throw new Error(`${constantName} wurde nicht gefunden.`);
  const start = source.indexOf('[', declarationIndex + declaration.length);
  if (start < 0) throw new Error(`${constantName} besitzt kein Array-Literal.`);
  let depth = 0;
  let quote = null;
  let escaped = false;
  for (let index = start; index < source.length; index += 1) {
    const character = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === quote) quote = null;
      continue;
    }
    if (character === "'" || character === '"' || character === '`') { quote = character; continue; }
    if (character === '[' || character === '{' || character === '(') depth += 1;
    if (character === ']' || character === '}' || character === ')') depth -= 1;
    if (depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`${constantName} ist nicht abgeschlossen.`);
}

const gameSourcePath = resolve(process.argv[2] ?? '../Pacman_clone/src/main.js');
const outputPath = resolve(process.argv[3] ?? 'src/data/passau-levels.json');
const source = await readFile(gameSourcePath, 'utf8');
const locationLiteral = extractLiteral(source, 'PASSAU_LEVELS');
const layoutLiteral = extractLiteral(source, 'LEVEL_BLOCKS');
const locations = vm.runInNewContext(`(${locationLiteral})`, Object.create(null));
const layouts = vm.runInNewContext(`(${layoutLiteral})`, Object.create(null));
const player = { x: 12, y: 20, renderer: 'franz-lola' };
const cats = [
  { x: 11, y: 12, renderer: 'cat', color: '#ff6b5f', accent: '#9e302e' },
  { x: 12, y: 12, renderer: 'cat', color: '#f2a65a', accent: '#a6532c' },
  { x: 13, y: 12, renderer: 'cat', color: '#b792e8', accent: '#66509d' },
];
const powerUps = [{ x: 1, y: 1 }, { x: 23, y: 1 }, { x: 1, y: 23 }, { x: 23, y: 23 }];

const levels = locations.map((location) => ({
  kind: 'franz-lola-level',
  schemaVersion: 1,
  id: location.id,
  icon: location.icon,
  name: location.name,
  description: location.description,
  mission: location.mission,
  location: { latitude: location.lat, longitude: location.lon, area: location.river },
  board: {
    columns: 25,
    rows: 25,
    tileSize: 24,
    tunnelRows: [12],
    walls: layouts[location.layout].map(([x, y, width, height]) => ({ x, y, width, height })),
  },
  theme: {
    id: location.theme ?? 'neighborhood',
    landmark: location.home ? 'brahmahof-home' : (location.theme ?? 'dog-park'),
    palette: location.palette,
  },
  actors: { player, cats },
  collectibles: { powerUps },
  gameplay: {
    pelletSeed: location.layout * 97,
    treatTargets: { easy: 70, normal: 110, hard: 160 },
  },
  source: {
    catalog: 'Geburtstagsspiel',
    gameLayout: location.layout,
    markerClass: location.markerClass ?? '',
    home: Boolean(location.home),
  },
  decorations: [],
}));

const catalog = {
  kind: 'franz-lola-level-catalog',
  schemaVersion: 1,
  generatedFrom: 'Geburtstagsspiel/src/main.js',
  sourceHash: createHash('sha256').update(`${locationLiteral}\n${layoutLiteral}`).digest('hex'),
  levels,
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8');
console.log(`Katalog mit ${levels.length} Leveln: ${outputPath}`);
