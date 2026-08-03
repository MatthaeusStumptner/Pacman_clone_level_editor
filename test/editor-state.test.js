import test from 'node:test';
import assert from 'node:assert/strict';
import { createStarterLevel, EditorState } from '../src/editor-state.js';

test('edits wall cells and supports undo/redo', () => {
  const state = new EditorState(createStarterLevel());
  state.commit((draft) => draft.setWall(3, 4, true));
  assert.ok(state.wallCells.has('3,4'));
  assert.equal(state.undo(), true);
  assert.equal(state.wallCells.has('3,4'), false);
  assert.equal(state.redo(), true);
  assert.ok(state.wallCells.has('3,4'));
});
