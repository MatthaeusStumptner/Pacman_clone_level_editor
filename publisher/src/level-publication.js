import { validateLevelDocument } from '@franz-lola/pixel-renderer';

const MAX_BODY_BYTES = 1_000_000;
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function assertSafeObject(value, depth = 0) {
  if (depth > 32) throw new Error('Die JSON-Struktur ist zu tief verschachtelt.');
  if (!value || typeof value !== 'object') return;
  for (const [key, child] of Object.entries(value)) {
    if (DANGEROUS_KEYS.has(key)) throw new Error(`Nicht erlaubter JSON-Schlüssel: ${key}`);
    assertSafeObject(child, depth + 1);
  }
}

export async function readPublishBody(request) {
  if (!request.headers.get('Content-Type')?.toLowerCase().startsWith('application/json')) {
    throw new Error('Veröffentlichungen müssen als JSON gesendet werden.');
  }
  const declaredLength = Number(request.headers.get('Content-Length') || 0);
  if (declaredLength > MAX_BODY_BYTES) throw new Error('Das Level ist größer als 1 MB.');
  const source = await request.text();
  if (new TextEncoder().encode(source).byteLength > MAX_BODY_BYTES) throw new Error('Das Level ist größer als 1 MB.');
  const body = JSON.parse(source);
  assertSafeObject(body);
  return body;
}

function enforceResourceLimits(level) {
  if (level.board.columns > 64 || level.board.rows > 64 || level.board.columns * level.board.rows > 4096) {
    throw new Error('Veröffentlichte Level dürfen höchstens 64 × 64 Felder groß sein.');
  }
  if (level.board.walls.length > 512) throw new Error('Das Level enthält mehr als 512 Wandrechtecke.');
  if (level.actors.cats.length > 16) throw new Error('Das Level enthält mehr als 16 Katzen.');
  if (level.decorations.length > 256) throw new Error('Das Level enthält mehr als 256 Dekorationen.');
}

export function preparePublishedLevel(input, { existing, nextMapOrder }) {
  const result = validateLevelDocument(input);
  if (!result.ok) throw new Error(result.errors.join(' '));
  enforceResourceLimits(result.value);
  const existingSource = existing?.source ?? {};
  const mapOrder = Number.isInteger(existingSource.mapOrder)
    ? existingSource.mapOrder
    : nextMapOrder;
  const value = {
    ...result.value,
    source: {
      ...result.value.source,
      catalog: existing ? existingSource.catalog || 'Geburtstagsspiel' : 'Levelwerkstatt',
      gameLayout: existing && Number.isInteger(existingSource.gameLayout) ? existingSource.gameLayout : nextMapOrder,
      markerClass: existing ? existingSource.markerClass ?? '' : '',
      home: existing ? Boolean(existingSource.home) : false,
      mapOrder,
    },
  };
  return { value, warnings: result.warnings, path: `src/data/levels/${value.id}.level.json` };
}
