import test from 'node:test';
import assert from 'node:assert/strict';
import { createLevelDocument, tileKey } from '@franz-lola/pixel-renderer';
import { PlaytestEngine } from '../src/playtest-engine.js';

function level(overrides = {}) {
  return createLevelDocument({
    kind: 'franz-lola-level', schemaVersion: 1, id: 'testlauf',
    board: { columns: 7, rows: 7, tileSize: 24, tunnelRows: [3], walls: overrides.walls ?? [] },
    actors: { player: overrides.player ?? { x: 3, y: 3 }, cats: [] },
    collectibles: { powerUps: [] }, gameplay: { pelletSeed: 0, treatTargets: { easy: 1, normal: 2, hard: 3 } },
  });
}

test('moves one tile, queues turns and stops at walls', () => {
  const engine = new PlaytestEngine(level({ walls: [{ x: 4, y: 3, width: 1, height: 1 }] }));
  engine.setDirection('right'); engine.step();
  assert.deepEqual({ x: engine.player.x, y: engine.player.y }, { x: 3, y: 3 });
  engine.setDirection('up'); engine.step();
  assert.deepEqual({ x: engine.player.x, y: engine.player.y }, { x: 3, y: 2 });
});

test('wraps through declared tunnel rows', () => {
  const engine = new PlaytestEngine(level({ player: { x: 0, y: 3 } }));
  engine.setDirection('left'); engine.step();
  assert.equal(engine.player.x, 6);
  assert.equal(engine.player.y, 3);
});

test('collects Guttis and reaches the completed state', () => {
  const engine = new PlaytestEngine(level());
  engine.pellets = new Set([tileKey(3, 2)]);
  engine.setDirection('up'); engine.step();
  assert.equal(engine.collected, 1);
  assert.equal(engine.pellets.size, 0);
  assert.equal(engine.state, 'won');
});
