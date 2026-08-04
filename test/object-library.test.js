import test from 'node:test';
import assert from 'node:assert/strict';
import { ObjectLibrary, createBlankObjectAsset, placementFromAsset } from '../src/object-library.js';

class MemoryStorage {
  constructor() { this.values = new Map(); }
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, String(value)); }
}

test('ships reusable Passau objects independently from a particular map', () => {
  const library = new ObjectLibrary(new MemoryStorage());
  const assets = library.list();
  assert.deepEqual(assets.map((asset) => asset.id), ['music-note', 'stage-lights', 'kingfisher', 'tree', 'bench', 'sign']);
  assert.equal(assets.find((asset) => asset.id === 'music-note').appearance.animations[0].id, 'idle');
  assets[0].name = 'verändert';
  assert.equal(library.list()[0].name, 'Musiknote');
});

test('saves an arbitrary pixel object and restores it from browser storage', () => {
  const storage = new MemoryStorage();
  const library = new ObjectLibrary(storage);
  const asset = createBlankObjectAsset('Lolas Bühne');
  asset.appearance.animations[0].frames[0].pixels[0] = `1${'0'.repeat(11)}`;
  const saved = library.save(asset);
  const restored = new ObjectLibrary(storage).list().find((entry) => entry.id === 'lolas-buhne');
  assert.equal(saved.id, 'lolas-buhne');
  assert.equal(restored.appearance.animations[0].frames[0].pixels[0], `1${'0'.repeat(11)}`);
});

test('places a self-contained sprite instance that survives without the editor library', () => {
  const asset = createBlankObjectAsset('Konzertplakat');
  asset.animation = { type: 'pulse', speed: 2, amplitude: 0.2 };
  const placement = placementFromAsset(asset, { x: 7, y: 9 }, 3);
  assert.equal(placement.assetId, 'konzertplakat');
  assert.equal(placement.x, 7);
  assert.equal(placement.y, 9);
  assert.equal(placement.spriteAnimation, 'idle');
  assert.notStrictEqual(placement.appearance, asset.appearance);
  assert.deepEqual(placement.animation, asset.animation);
});
