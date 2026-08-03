import { createLevelDocument, tileKey } from '@franz-lola/pixel-renderer';

const clone = (value) => JSON.parse(JSON.stringify(value));
const rectCells = (walls) => new Set(walls.flatMap((wall) => {
  const cells = [];
  for (let y = wall.y; y < wall.y + wall.height; y += 1) for (let x = wall.x; x < wall.x + wall.width; x += 1) cells.push(tileKey(x, y));
  return cells;
}));

export class EditorState {
  constructor(document) {
    this.history = [];
    this.future = [];
    this.replace(document, false);
  }

  replace(document, remember = true) {
    if (remember && this.document) this.history.push(clone(this.document));
    this.document = createLevelDocument(document);
    this.wallCells = rectCells(this.document.board.walls);
    this.future = [];
    return this.document;
  }

  commit(mutator) {
    this.history.push(clone(this.toDocument()));
    this.future = [];
    mutator(this);
    this.document = this.toDocument();
  }

  setWall(x, y, enabled) {
    const key = tileKey(x, y);
    if (enabled) this.wallCells.add(key); else this.wallCells.delete(key);
  }

  toDocument() {
    return createLevelDocument({
      ...this.document,
      board: {
        ...this.document.board,
        walls: [...this.wallCells].map((key) => {
          const [x, y] = key.split(',').map(Number);
          return { x, y, width: 1, height: 1 };
        }),
      },
    });
  }

  undo() {
    const previous = this.history.pop();
    if (!previous) return false;
    this.future.push(clone(this.toDocument()));
    this.document = createLevelDocument(previous);
    this.wallCells = rectCells(this.document.board.walls);
    return true;
  }

  redo() {
    const next = this.future.pop();
    if (!next) return false;
    this.history.push(clone(this.toDocument()));
    this.document = createLevelDocument(next);
    this.wallCells = rectCells(this.document.board.walls);
    return true;
  }
}

export function createStarterLevel() {
  return createLevelDocument({
    id: 'mein-level',
    name: { standard: 'Mein Passau-Level', dialect: 'Mei Passau-Level' },
    description: { standard: 'Eine selbst gebaute Gassi-Runde.', dialect: 'A selber baute Gassi-Rundn.' },
    mission: { standard: 'Alle Guttis finden', dialect: 'Olle Guttis findn' },
    board: { columns: 25, rows: 25, tileSize: 24, tunnelRows: [12], walls: [] },
    theme: { landmark: 'dog-park' },
    actors: { player: { x: 12, y: 20 }, cats: [] },
  });
}
