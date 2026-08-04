const clone = (value) => JSON.parse(JSON.stringify(value));
const slug = (value, fallback = 'objekt') => String(value || fallback)
  .normalize('NFKD').replace(/\p{Diacritic}/gu, '').replace(/ß/g, 'ss')
  .toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || fallback;

function appearance(rows, palette, { animation = 'idle', fps = 4 } = {}) {
  return {
    width: rows[0].length,
    height: rows.length,
    palette,
    pixels: rows,
    animations: [{ id: animation, fps, loop: true, frames: [{ pixels: rows }] }],
    stateAnimations: { idle: animation, up: animation, right: animation, down: animation, left: animation },
  };
}

const noteRows = [
  '000000110000', '000000110000', '000000111100', '000000100100',
  '000000100100', '000000100100', '000000100100', '000011100000',
  '000111100000', '000111000000', '000000000000', '000000000000',
];
const lightRows = [
  '1000000000000001', '0100000000000010', '0010000000000100', '0011000000001100',
  '0001000000001000', '0001100000011000', '0000100000010000', '0000110000110000',
  '0000010000100000', '0000011001100000', '0000001010000000', '0000001110000000',
];
const birdRows = [
  '000000000000', '000000110000', '000011111000', '000122211100',
  '001222221110', '001222111000', '000111100000', '000011000000',
  '000110000000', '001100000000', '000000000000', '000000000000',
];

export const DEFAULT_OBJECT_ASSETS = Object.freeze([
  {
    id: 'music-note', name: 'Musiknote', category: 'Bühne', description: 'Animierbare Note aus dem Zauberberg.',
    type: 'custom', width: 2, height: 2, color: '#63d9d4', label: '♪', appearance: appearance(noteRows, ['transparent', '#63d9d4']),
    animation: { type: 'bob', speed: 1.1, amplitude: 0.125 },
  },
  {
    id: 'stage-lights', name: 'Bühnenlichter', category: 'Bühne', description: 'Farbige Lichtkegel für Konzerte und Szenen.',
    type: 'custom', width: 4, height: 3, color: '#ff4f87', label: '⌁', appearance: appearance(lightRows, ['transparent', '#ff4f87']),
    animation: { type: 'pulse', speed: 0.7, amplitude: 0.12 },
  },
  {
    id: 'kingfisher', name: 'Eisvogel', category: 'Passau', description: 'Das Ilz-Easteregg als frei platzierbares Objekt.',
    type: 'custom', width: 2, height: 2, color: '#55d9dd', label: '◆', appearance: appearance(birdRows, ['transparent', '#194b63', '#e9a34b']),
    animation: { type: 'bob', speed: 0.65, amplitude: 0.1 },
  },
  { id: 'tree', name: 'Baum', category: 'Nachbarschaft', description: 'Ein klassischer Pixelbaum.', type: 'tree', width: 2, height: 2, color: '#4f9362', label: '', appearance: null, animation: { type: 'none', speed: 1, amplitude: 0.15 } },
  { id: 'bench', name: 'Parkbank', category: 'Nachbarschaft', description: 'Bank für Bschütt und Gassirunden.', type: 'bench', width: 2, height: 1, color: '#b4794f', label: '', appearance: null, animation: { type: 'none', speed: 1, amplitude: 0.15 } },
  { id: 'sign', name: 'Schild', category: 'Stadt', description: 'Beschriftbares Schild.', type: 'sign', width: 2, height: 1, color: '#d7b56d', label: 'PASSAU', appearance: null, animation: { type: 'none', speed: 1, amplitude: 0.15 } },
]);

export function createBlankObjectAsset(name = 'Neues Objekt') {
  const id = slug(name, `objekt-${Date.now()}`);
  const rows = Array.from({ length: 12 }, () => '0'.repeat(12));
  return {
    id, name, category: 'Eigene Objekte', description: 'Selbst gestaltetes Sprite-Objekt.', type: 'custom', width: 2, height: 2,
    color: '#55d9dd', label: '◆', appearance: appearance(rows, ['transparent', '#55d9dd']), animation: { type: 'none', speed: 1, amplitude: 0.15 },
  };
}

export class ObjectLibrary {
  constructor(storage = globalThis.localStorage, key = 'franz-lola-object-library-v1') {
    this.storage = storage;
    this.key = key;
  }

  readCustom() {
    try {
      const value = JSON.parse(this.storage?.getItem(this.key) ?? '[]');
      return Array.isArray(value) ? value : [];
    } catch { return []; }
  }

  list() {
    const custom = this.readCustom();
    return [...DEFAULT_OBJECT_ASSETS.map(clone), ...custom.map(clone).filter((asset) => !DEFAULT_OBJECT_ASSETS.some((builtIn) => builtIn.id === asset.id))];
  }

  save(asset) {
    const normalized = { ...clone(asset), id: slug(asset.id || asset.name) };
    const custom = this.readCustom().filter((entry) => entry.id !== normalized.id);
    custom.push(normalized);
    this.storage?.setItem(this.key, JSON.stringify(custom));
    return clone(normalized);
  }

  remove(id) {
    const custom = this.readCustom().filter((entry) => entry.id !== id);
    this.storage?.setItem(this.key, JSON.stringify(custom));
  }
}

export function placementFromAsset(asset, point, index = 0) {
  return {
    id: `${asset.id}-${Date.now()}-${index}`,
    assetId: asset.id,
    name: asset.name,
    type: asset.type,
    x: point.x,
    y: point.y,
    width: asset.width,
    height: asset.height,
    color: asset.color,
    label: asset.label,
    appearance: clone(asset.appearance),
    spriteAnimation: asset.appearance?.animations?.[0]?.id ?? '',
    animation: clone(asset.animation),
    layer: 'scenery',
    locked: false,
  };
}
