const decorationLabel = (item, index) => item.name || item.content?.standard || item.label || `Objekt ${index + 1}`;
const themeLabel = (item) => item.id === 'stage-note' ? 'Zauberberg-Note' : item.id === 'stage-lights' ? 'Bühnenlichter' : item.id;

export function sceneEntity(level, selection) {
  if (!selection || !level) return null;
  if (selection.kind === 'player') return level.actors.player;
  if (selection.kind === 'cat') return level.actors.cats[selection.index] ?? null;
  if (selection.kind === 'decoration') return level.decorations[selection.index] ?? null;
  if (selection.kind === 'wall') return level.board?.walls?.[selection.index] ?? null;
  if (selection.kind === 'event') return level.events[selection.index] ?? null;
  if (selection.kind === 'theme-element') return level.theme.elements?.[selection.index] ?? null;
  return null;
}

export function sceneSelectionKey(level, selection) {
  if (!selection) return '';
  if (selection.kind === 'player') return `player:${level?.actors.player.id || 'player'}`;
  const entity = sceneEntity(level, selection);
  return entity ? `${selection.kind}:${entity.id ?? selection.index}` : '';
}

export function sceneGroups(level) {
  if (!level) return [];
  return [
    {
      id: 'actors', label: 'Figuren', icon: 'FL',
      nodes: [
        { kind: 'player', index: 0, label: 'Franz & Lola', detail: 'Spieler', icon: 'FL', canHide: true, canLock: false, canReorder: false },
        ...level.actors.cats.map((cat, index) => ({ kind: 'cat', index, label: `Katze ${index + 1}`, detail: cat.behavior?.strategy || 'Katze', icon: '◆', canHide: true, canLock: false, canReorder: false })),
      ],
    },
    {
      id: 'walls', label: 'Wände', icon: '▦',
      nodes: (level.board?.walls ?? []).map((wall, index) => ({
        kind: 'wall', index, label: wall.name || 'Wand ' + (index + 1),
        detail: wall.width + '×' + wall.height + ' · ' + (wall.pattern || 'Theme'),
        icon: '▦', canHide: false, canLock: false, canReorder: false,
      })),
    },
    {
      id: 'objects', label: 'Objekte & Texte', icon: '◆',
      nodes: level.decorations.map((item, index) => ({ kind: 'decoration', index, label: decorationLabel(item, index), detail: item.type === 'text' ? 'Textblock' : `${item.layer || 'scenery'} · ${item.type}`, icon: item.type === 'text' ? 'T' : '◆', canHide: true, canLock: true, canReorder: true })),
    },
    {
      id: 'events', label: 'Ereignisse', icon: '!',
      nodes: level.events.map((event, index) => ({ kind: 'event', index, label: event.name.standard, detail: event.trigger.type, icon: event.visual.label || '!', canHide: true, canLock: false, canReorder: false })),
    },
    {
      id: 'theme', label: 'Systemkulisse', icon: 'SYS',
      nodes: (level.theme.elements ?? []).map((item, index) => ({ kind: 'theme-element', index, label: themeLabel(item), detail: 'Theme-Element', icon: '◇', canHide: false, canLock: false, canReorder: false })),
    },
  ].map((group) => ({ ...group, nodes: group.nodes.map((node) => ({ ...node, key: sceneSelectionKey(level, node) })) }));
}

const sameTile = (entity, point) => entity && entity.x === point.x && entity.y === point.y;
const contains = (item, point) => item && point.x >= item.x && point.x < item.x + item.width && point.y >= item.y && point.y < item.y + item.height;

export function sceneCandidatesAt(level, point, { hidden = new Set(), themeBounds = () => null } = {}) {
  const candidates = [];
  const add = (kind, index) => {
    const selection = { kind, index };
    if (!hidden.has(sceneSelectionKey(level, selection))) candidates.push(selection);
  };

  if (sameTile(level.actors.player, point)) add('player', 0);
  for (let index = level.actors.cats.length - 1; index >= 0; index -= 1) if (sameTile(level.actors.cats[index], point)) add('cat', index);
  for (let index = level.events.length - 1; index >= 0; index -= 1) {
    const visual = level.events[index].visual;
    if (Math.abs(visual.x - (point.x + 0.5)) <= 0.75 && Math.abs(visual.y - (point.y + 0.5)) <= 0.75) add('event', index);
  }
  for (let index = level.decorations.length - 1; index >= 0; index -= 1) if (contains(level.decorations[index], point)) add('decoration', index);
  for (let index = (level.theme.elements?.length ?? 0) - 1; index >= 0; index -= 1) {
    const bounds = themeBounds(level.theme.elements[index].id);
    if (contains(bounds, point)) add('theme-element', index);
  }
  for (let index = level.board.walls.length - 1; index >= 0; index -= 1) {
    if (contains(level.board.walls[index], point)) add('wall', index);
  }
  return candidates;
}

export function chooseSceneCandidate(level, candidates, current, cycle = false) {
  if (!candidates.length) return null;
  if (!cycle || !current) return candidates[0];
  const currentKey = sceneSelectionKey(level, current);
  const index = candidates.findIndex((candidate) => sceneSelectionKey(level, candidate) === currentKey);
  return candidates[(index + 1 + candidates.length) % candidates.length];
}

export function workspaceForSelection(selection) {
  if (!selection) return 'level';
  if (selection.kind === 'player' || selection.kind === 'cat') return 'characters';
  if (selection.kind === 'event') return 'events';
  if (selection.kind === 'wall') return 'level';
  return 'objects';
}
