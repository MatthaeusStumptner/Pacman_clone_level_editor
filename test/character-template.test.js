import test from 'node:test';
import assert from 'node:assert/strict';
import { createLevelDocument, selectAppearanceFrame, stateAnimationId } from '@franz-lola/pixel-renderer';
import { PLAYER_STATES, createFranzLolaAppearance } from '../src/character-template.js';

test('Franz and Lola template ships editable frames for idle and every direction', () => {
  const appearance = createFranzLolaAppearance();
  assert.deepEqual(Object.keys(appearance.stateAnimations), PLAYER_STATES);
  assert.equal(appearance.animations.length, 5);
  PLAYER_STATES.forEach((state) => {
    assert.equal(stateAnimationId(appearance, state), state);
    assert.equal(appearance.animations.find((animation) => animation.id === state).frames.length, 2);
    assert.equal(selectAppearanceFrame(appearance, { state, elapsed: 0 }).length, 12);
  });
});

test('template survives the public intermediate level format', () => {
  const level = createLevelDocument({ board: { columns: 9, rows: 9 }, actors: { cats: [], player: { x: 4, y: 4, appearance: createFranzLolaAppearance() } } });
  assert.equal(level.actors.player.appearance.stateAnimations.left, 'left');
  assert.equal(level.actors.player.appearance.animations.find((animation) => animation.id === 'up').fps, 8);
});
