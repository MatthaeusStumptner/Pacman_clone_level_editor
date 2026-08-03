import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLevelDocument, validateLevelDocument } from '@franz-lola/pixel-renderer';
import { catalogDocument, catalogLevel, passauCatalog, searchCatalog } from '../src/catalog.js';
import { EditorState } from '../src/editor-state.js';
import { previewGuttis } from '../src/editor-tools.js';

const expected = [
  ['home', 2, 16, 'brahmahof-home'], ['hals', 0, 18, 'dog-park'], ['oberhaus', 3, 16, 'dog-park'],
  ['dom', 1, 19, 'dog-park'], ['dreifluesseeck', 4, 18, 'dog-park'], ['uni', 5, 18, 'dog-park'],
  ['bschuett', 6, 18, 'bschuett'], ['tabakfabrik', 7, 17, 'tabakfabrik'], ['zauberberg', 8, 16, 'zauberberg'],
];
const expectedEvents = {
  home: ['ilzvogel', 'hundewiese'], hals: ['ilzvogel'], oberhaus: ['kirchenglockn'], dom: ['kirchenglockn'], dreifluesseeck: ['ilzvogel'], uni: [], bschuett: ['ilzvogel', 'hundewiese'], tabakfabrik: [], zauberberg: [],
};

test('catalog is pinned to the reviewed Geburtstagsspiel source snapshot', () => {
  const catalog = catalogDocument();
  assert.equal(catalog.kind, 'franz-lola-level-catalog');
  assert.equal(catalog.sourceHash, '6e5d444844d4d09e1707762d24c9842a8f5748bfa6aa197e1f206210a4b40578');
  assert.equal(catalog.generatedFrom, 'Geburtstagsspiel/src/main.js');
});

test('contains all nine original levels in map order with exact layout assignments', () => {
  assert.equal(passauCatalog.length, 9);
  assert.deepEqual(passauCatalog.map((level) => [level.id, level.source.gameLayout, level.board.walls.length, level.theme.landmark]), expected);
  assert.equal(new Set(passauCatalog.map((level) => level.id)).size, 9);
});

test('every original level validates and produces exact difficulty Gutti counts', () => {
  for (const level of passauCatalog) {
    const validation = validateLevelDocument(level);
    assert.equal(validation.ok, true, `${level.id}: ${validation.errors.join('; ')}`);
    assert.equal(previewGuttis(level, 'easy').size, 70, `${level.id} easy`);
    assert.equal(previewGuttis(level, 'normal').size, 110, `${level.id} normal`);
    assert.equal(previewGuttis(level, 'hard').size, 160, `${level.id} hard`);
    assert.equal(level.actors.player.behavior.controller, 'user');
    assert.equal(level.actors.cats.length, 3);
    assert.deepEqual(level.actors.cats.map((cat) => cat.behavior.strategy), ['chase', 'ambush', 'scatter-chase']);
    assert.equal(level.gameplay.difficulties.easy.lives, 5);
    assert.deepEqual(level.events.map((event) => event.id), expectedEvents[level.id], `${level.id} events`);
    level.events.forEach((event) => { assert.ok(event.message.standard); assert.ok(event.message.dialect); assert.ok(event.reward > 0); });
    assert.deepEqual(level.collectibles.powerUps, [{ x: 1, y: 1 }, { x: 23, y: 1 }, { x: 1, y: 23 }, { x: 23, y: 23 }]);
  }
});

test('loading and exporting an untouched original preserves every wall rectangle', () => {
  for (const source of passauCatalog) {
    const exported = new EditorState(source).toDocument();
    assert.deepEqual(exported.board.walls, source.board.walls, source.id);
    assert.deepEqual(exported.name, source.name, source.id);
    assert.deepEqual(exported.location, source.location, source.id);
    assert.deepEqual(exported.theme, source.theme, source.id);
    assert.deepEqual(exported.source, source.source, source.id);
    const imported = parseLevelDocument(JSON.stringify(exported));
    assert.equal(imported.ok, true, source.id);
    assert.deepEqual(imported.value.board.walls, source.board.walls, source.id);
  }
});

test('catalog lookup returns safe clones and search understands place, mission and dialect', () => {
  const home = catalogLevel('home');
  home.board.walls.length = 0;
  assert.equal(catalogLevel('home').board.walls.length, 16);
  assert.deepEqual(searchCatalog('tabak').map((level) => level.id), ['tabakfabrik']);
  assert.deepEqual(searchCatalog('Bschütt').map((level) => level.id), ['bschuett']);
  assert.ok(searchCatalog('gutti').length > 0);
});
