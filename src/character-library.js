import { createFranzLolaAppearance, PLAYER_STATES } from './character-template.js';

const clone = (value) => JSON.parse(JSON.stringify(value));
const slug = (value, fallback = 'figur') => String(value || fallback)
  .normalize('NFKD').replace(/\p{Diacritic}/gu, '').replace(/ß/g, 'ss')
  .toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || fallback;

const PIXEL_FIGURE = Object.freeze([
  '000011110000',
  '000122221000',
  '000121121000',
  '000122221000',
  '000011110000',
  '000113311000',
  '001133331100',
  '001133331100',
  '000113311000',
  '000110011000',
  '001100001100',
  '001100001100',
]);

function appearanceFromRows(rows, palette) {
  const animations = PLAYER_STATES.map((state) => ({
    id: state,
    fps: state === 'idle' ? 2 : 6,
    duration: 0.5,
    loop: true,
    keyframes: [{ id: `${state}-1`, time: 0, easing: 'step', pixels: [...rows] }],
    frames: [{ pixels: [...rows] }],
  }));
  return {
    width: rows[0].length,
    height: rows.length,
    palette,
    pixels: [...rows],
    animations,
    stateAnimations: Object.fromEntries(PLAYER_STATES.map((state) => [state, state])),
  };
}

function templateAppearance(template) {
  if (template === 'franz-lola') return createFranzLolaAppearance();
  if (template === 'empty') return appearanceFromRows(Array.from({ length: 12 }, () => '0'.repeat(12)), ['transparent', '#55d9dd']);
  return appearanceFromRows(PIXEL_FIGURE, ['transparent', '#f5e7bd', '#55d9dd', '#f5c451']);
}

export function createBlankCharacterAsset(name = 'Neue Figur', template = 'pixel') {
  return {
    id: slug(name, `figur-${Date.now()}`),
    name: String(name || 'Neue Figur').trim() || 'Neue Figur',
    description: 'Levelübergreifende, selbst gestaltete Pixel-Figur.',
    color: '#55d9dd',
    accent: '#f5c451',
    appearance: templateAppearance(template),
    effects: [],
    behavior: { controller: 'stationary', speedMultiplier: 1 },
  };
}

export class CharacterLibrary {
  constructor(storage = globalThis.localStorage, key = 'franz-lola-character-library-v1') {
    this.storage = storage;
    this.key = key;
  }

  list() {
    try {
      const entries = JSON.parse(this.storage?.getItem(this.key) ?? '[]');
      return Array.isArray(entries) ? entries.map(clone) : [];
    } catch { return []; }
  }

  save(asset) {
    const normalized = { ...clone(asset), id: slug(asset.id || asset.name) };
    const entries = this.list().filter((entry) => entry.id !== normalized.id);
    entries.push(normalized);
    this.storage?.setItem(this.key, JSON.stringify(entries));
    return clone(normalized);
  }

  remove(id) {
    this.storage?.setItem(this.key, JSON.stringify(this.list().filter((entry) => entry.id !== id)));
  }
}

export function characterPlacement(asset, point, index = 0) {
  return {
    id: `${asset.id}-${Date.now()}-${index}`,
    characterId: asset.id,
    name: asset.name,
    x: point.x,
    y: point.y,
    renderer: 'pixel-art',
    state: 'idle',
    animation: '',
    color: asset.color,
    accent: asset.accent,
    appearance: clone(asset.appearance),
    effects: clone(asset.effects ?? []),
    behavior: clone(asset.behavior ?? { controller: 'stationary', speedMultiplier: 1 }),
  };
}
