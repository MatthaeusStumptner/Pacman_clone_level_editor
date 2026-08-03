import test from 'node:test';
import assert from 'node:assert/strict';
import { createStarterLevel, EditorState, compactWallCells, wallRectanglesToCells } from '../src/editor-state.js';

test('compacts edited wall cells without changing their occupied area', () => {
  const cells = new Set(['1,1', '2,1', '3,1', '1,2', '2,2', '3,2', '6,4']);
  const rectangles = compactWallCells(cells);
  assert.deepEqual(rectangles, [{ x: 1, y: 1, width: 3, height: 2 }, { x: 6, y: 4, width: 1, height: 1 }]);
  assert.deepEqual(wallRectanglesToCells(rectangles), cells);
});

test('keeps original wall rectangles byte-for-byte equivalent until a wall is edited', () => {
  const level = createStarterLevel();
  level.board.walls = [{ x: 1, y: 1, width: 5, height: 1 }, { x: 1, y: 2, width: 1, height: 4 }];
  const state = new EditorState(level);
  assert.deepEqual(state.toDocument().board.walls, level.board.walls);
  state.mutate('Wand', (draft) => draft.setWall(8, 8, true));
  assert.ok(state.toDocument().board.walls.some((wall) => wall.x === 8 && wall.y === 8));
});

test('groups a complete drawing gesture into one undo step', () => {
  const state = new EditorState(createStarterLevel());
  state.beginTransaction('Freihand');
  state.setWall(3, 4, true);
  state.setWall(4, 4, true);
  state.setWall(5, 4, true);
  state.endTransaction();
  assert.equal(state.history.length, 1);
  assert.equal(state.undo(), true);
  assert.equal(state.wallCells.has('3,4'), false);
  assert.equal(state.wallCells.has('5,4'), false);
  assert.equal(state.redo(), true);
  assert.equal(state.wallCells.has('4,4'), true);
});

test('honors the history limit', () => {
  const state = new EditorState(createStarterLevel(), { historyLimit: 2 });
  state.mutate('eins', (draft) => draft.setWall(2, 2, true));
  state.mutate('zwei', (draft) => draft.setWall(3, 2, true));
  state.mutate('drei', (draft) => draft.setWall(4, 2, true));
  assert.equal(state.history.length, 2);
  assert.equal(state.undo(), true);
  assert.equal(state.undo(), true);
  assert.equal(state.undo(), false);
  assert.equal(state.wallCells.has('2,2'), true);
});

test('supports empty cat lists, decorations and custom actor pixels', () => {
  const state = new EditorState(createStarterLevel());
  state.mutate('Katzen leeren', (draft) => { draft.document.actors.cats = []; });
  assert.deepEqual(state.toDocument().actors.cats, []);
  state.mutate('Deko', (draft) => draft.addDecoration({ x: 2, y: 3 }, { type: 'sign', width: 2, height: 1, color: '#55d9dd', label: 'ILZ' }));
  assert.equal(state.toDocument().decorations[0].label, 'ILZ');
  state.selected = { kind: 'player', index: 0 };
  state.mutate('Pixel', (draft) => draft.setSelectedAppearance({ width: 4, height: 4, palette: ['transparent', '#ffffff'], pixels: ['0110', '1111', '1001', '0110'] }));
  assert.equal(state.toDocument().actors.player.renderer, 'pixel-art');
  assert.deepEqual(state.toDocument().actors.player.appearance.pixels, ['0110', '1111', '1001', '0110']);
});

test('preserves player state-to-animation mappings through undo, redo and export', () => {
  const state = new EditorState(createStarterLevel()); state.selected = { kind: 'player', index: 0 };
  state.mutate('Spielerzustände', (draft) => draft.setSelectedAppearance({ width: 4, height: 4, palette: ['transparent', '#ffffff'], pixels: ['0110', '1111', '1001', '0110'], animations: ['idle', 'left', 'right', 'up', 'down'].map((id) => ({ id, frames: [{ pixels: ['0110', '1111', '1001', '0110'] }] })), stateAnimations: { idle: 'idle', left: 'left', right: 'right', up: 'up', down: 'down' } }));
  assert.equal(state.toDocument().actors.player.appearance.stateAnimations.right, 'right');
  assert.equal(state.undo(), true); assert.equal(state.toDocument().actors.player.appearance, null);
  assert.equal(state.redo(), true); assert.equal(state.toDocument().actors.player.appearance.stateAnimations.up, 'up');
});

test('placing walls removes conflicting cats and power-ups', () => {
  const level = createStarterLevel();
  level.actors.cats = [{ x: 5, y: 5, color: '#ff6b5f', accent: '#9e302e' }];
  level.collectibles.powerUps = [{ x: 5, y: 5 }];
  const state = new EditorState(level);
  state.mutate('Wand', (draft) => draft.setWall(5, 5, true));
  assert.deepEqual(state.toDocument().actors.cats, []);
  assert.deepEqual(state.toDocument().collectibles.powerUps, []);
});

test('keeps localized event triggers and visuals through history and export', () => {
  const state = new EditorState(createStarterLevel());
  state.mutate('Ereignis', (draft) => { draft.document.events.push({ id: 'eisvogel', name: { standard: 'Eisvogel', dialect: 'Eisvogl' }, message: { standard: 'Entdeckt', dialect: 'Gfundn' }, reward: 150, trigger: { type: 'zone', zones: [{ x: 1, y: 12, width: 2, height: 1 }] }, visual: { type: 'kingfisher', x: 0.375, y: 6 } }); });
  const exported = state.toDocument(); assert.equal(exported.events[0].message.dialect, 'Gfundn'); assert.equal(exported.events[0].visual.type, 'kingfisher');
  assert.equal(state.undo(), true); assert.equal(state.toDocument().events.length, 0); assert.equal(state.redo(), true); assert.equal(state.toDocument().events[0].reward, 150);
});
