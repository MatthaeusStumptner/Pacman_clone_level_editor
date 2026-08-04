import test from 'node:test';
import assert from 'node:assert/strict';
import { createLevelDocument } from '@franz-lola/pixel-renderer';
import { assertSafeObject, preparePublishedLevel, readPublishBody } from '../src/level-publication.js';

function level() {
  return createLevelDocument({
    kind: 'franz-lola-level', schemaVersion: 1, id: 'hals',
    board: { columns: 9, rows: 9, tileSize: 24, tunnelRows: [4], walls: [] },
    actors: { player: { x: 4, y: 6 }, cats: [] },
    collectibles: { powerUps: [{ x: 1, y: 1 }] },
  });
}

test('publication preserves protected map metadata, sprites, objects and level-bound cutscenes', () => {
  const input = level();
  input.actors.player.appearance = {
    width: 4, height: 4,
    palette: ['transparent', ...Array.from({ length: 11 }, (_, index) => `#${(index + 1).toString(16).padStart(6, '0')}`)],
    pixels: ['0ab0', '1ab1', '1ab1', '0ab0'],
  };
  input.decorations = [{
    id: 'note', assetId: 'music-note', name: 'Musiknote', type: 'custom', x: 2, y: 2, width: 2, height: 2,
    color: '#55d9dd', label: '♪', appearance: input.actors.player.appearance, spriteAnimation: 'idle',
    animation: { type: 'bob', speed: 1, amplitude: 0.1 },
  }];
  input.cutscenes = [{
    id: 'intro', kind: 'intro', name: { standard: 'Ankunft', dialect: 'Oikemma' }, duration: 3, skippable: true,
    tracks: [
      { id: 'camera', type: 'camera', target: 'camera', keyframes: [{ id: 'start', time: 0, x: 1, y: 6, zoom: 1.35 }, { id: 'end', time: 3, x: 4, y: 6, zoom: 1.12 }] },
      { id: 'note', type: 'object', target: 'note', keyframes: [{ id: 'start', time: 0, x: 2, y: 2, visible: true }, { id: 'end', time: 3, x: 4, y: 2, visible: true }] },
    ],
  }];
  const result = preparePublishedLevel(input, {
    existing: { source: { catalog: 'Geburtstagsspiel', gameLayout: 0, markerClass: 'water', home: false, mapOrder: 1 } },
    nextMapOrder: 9,
  });
  assert.equal(result.value.source.mapOrder, 1);
  assert.equal(result.value.source.catalog, 'Geburtstagsspiel');
  assert.equal(result.value.actors.player.appearance.palette.length, 12);
  assert.equal(result.value.decorations[0].appearance.palette.length, 12);
  assert.equal(result.value.cutscenes[0].tracks[1].target, 'note');
  assert.equal(result.value.cutscenes[0].tracks[1].keyframes[1].x, 4);
  assert.equal(result.path, 'src/data/levels/hals.level.json');
});

test('publication rejects prototype keys, oversized bodies and oversized boards', async () => {
  assert.throws(() => assertSafeObject(JSON.parse('{"__proto__":{"admin":true}}')), /Nicht erlaubter/);
  const request = new Request('https://publisher.test/api/publish', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Content-Length': '1000001' }, body: '{}',
  });
  await assert.rejects(readPublishBody(request), /größer als 1 MB/);
  const huge = level(); huge.board.columns = 65;
  assert.throws(() => preparePublishedLevel(huge, { nextMapOrder: 0 }), /64 × 64/);
});

test('new levels cannot claim protected map presentation metadata', () => {
  const input = level();
  input.id = 'neuer-ort';
  input.source = { catalog: 'Angreifer', gameLayout: 99, markerClass: 'home admin', home: true, mapOrder: 0 };
  const result = preparePublishedLevel(input, { existing: null, nextMapOrder: 9 });
  assert.deepEqual(result.value.source, {
    catalog: 'Levelwerkstatt', gameLayout: 9, markerClass: '', home: false, mapOrder: 9,
  });
});
