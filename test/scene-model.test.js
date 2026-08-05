import test from 'node:test';
import assert from 'node:assert/strict';
import { chooseSceneCandidate, sceneCandidatesAt, sceneGroups, sceneSelectionKey, workspaceForSelection } from '../src/scene-model.js';

const level = {
  actors: { player: { id: 'player', x: 3, y: 3 }, cats: [{ id: 'rock-katze', x: 3, y: 3, behavior: { strategy: 'guard' } }] },
  decorations: [
    { id: 'bank', name: 'Bank', type: 'bench', layer: 'scenery', x: 2, y: 2, width: 3, height: 2 },
    { id: 'text', name: 'Text', type: 'text', layer: 'foreground', x: 3, y: 3, width: 2, height: 1 },
  ],
  events: [{ id: 'eisvogel', name: { standard: 'Eisvogel' }, trigger: { type: 'zone' }, visual: { x: 3.5, y: 3.5, label: '!' } }],
  theme: { elements: [{ id: 'stage-note' }] },
};

test('builds a grouped scene tree with stable document identities', () => {
  const groups = sceneGroups(level);
  assert.deepEqual(groups.map((group) => group.id), ['actors', 'objects', 'events', 'theme']);
  assert.equal(groups[0].nodes[1].key, 'cat:rock-katze');
  assert.equal(groups[1].nodes[1].detail, 'Textblock');
  assert.equal(groups[2].nodes[0].key, 'event:eisvogel');
  assert.equal(groups[3].nodes[0].label, 'Zauberberg-Note');
});

test('orders overlapping candidates like the renderer and cycles with Alt', () => {
  const candidates = sceneCandidatesAt(level, { x: 3, y: 3 }, { themeBounds: () => ({ x: 3, y: 3, width: 1, height: 1 }) });
  assert.deepEqual(candidates.map((selection) => sceneSelectionKey(level, selection)), [
    'player:player', 'cat:rock-katze', 'event:eisvogel', 'decoration:text', 'decoration:bank', 'theme-element:stage-note',
  ]);
  assert.equal(sceneSelectionKey(level, chooseSceneCandidate(level, candidates, candidates[0], true)), 'cat:rock-katze');
  assert.equal(sceneSelectionKey(level, chooseSceneCandidate(level, candidates, candidates.at(-1), true)), 'player:player');
});

test('does not offer editor-hidden candidates', () => {
  const hidden = new Set(['player:player', 'decoration:text']);
  const candidates = sceneCandidatesAt(level, { x: 3, y: 3 }, { hidden });
  assert.equal(candidates.some((selection) => sceneSelectionKey(level, selection) === 'player:player'), false);
  assert.equal(candidates.some((selection) => sceneSelectionKey(level, selection) === 'decoration:text'), false);
});

test('routes an explicit open action to the corresponding specialist workspace', () => {
  assert.equal(workspaceForSelection({ kind: 'player' }), 'characters');
  assert.equal(workspaceForSelection({ kind: 'event' }), 'events');
  assert.equal(workspaceForSelection({ kind: 'decoration' }), 'objects');
});
