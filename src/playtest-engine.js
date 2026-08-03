import { compileWallGrid, tileKey } from '@franz-lola/pixel-renderer';
import { previewGuttis } from './editor-tools.js';

export const DIRECTIONS = Object.freeze({
  none: { name: 'none', x: 0, y: 0 }, left: { name: 'left', x: -1, y: 0 }, right: { name: 'right', x: 1, y: 0 }, up: { name: 'up', x: 0, y: -1 }, down: { name: 'down', x: 0, y: 1 },
});

export class PlaytestEngine {
  constructor(level, difficulty = 'easy') {
    this.level = level;
    this.grid = compileWallGrid(level);
    this.pellets = previewGuttis(level, difficulty);
    this.powerUps = new Set(level.collectibles.powerUps.map((point) => tileKey(point.x, point.y)));
    this.player = { ...level.actors.player, dir: DIRECTIONS.none, nextDir: DIRECTIONS.none };
    this.collected = 0;
    this.state = 'playing';
  }

  setDirection(name) {
    if (DIRECTIONS[name]) this.player.nextDir = DIRECTIONS[name];
  }

  canMove(direction) {
    if (direction.name === 'none') return false;
    let x = this.player.x + direction.x; const y = this.player.y + direction.y;
    if (y < 0 || y >= this.level.board.rows) return false;
    if (x < 0 || x >= this.level.board.columns) {
      if (!this.level.board.tunnelRows.includes(y)) return false;
      x = x < 0 ? this.level.board.columns - 1 : 0;
    }
    return !this.grid[y][x];
  }

  step() {
    if (this.state !== 'playing') return;
    if (this.canMove(this.player.nextDir)) this.player.dir = this.player.nextDir;
    if (!this.canMove(this.player.dir)) this.player.dir = DIRECTIONS.none;
    this.player.x += this.player.dir.x;
    this.player.y += this.player.dir.y;
    if (this.player.x < 0) this.player.x = this.level.board.columns - 1;
    if (this.player.x >= this.level.board.columns) this.player.x = 0;
    const key = tileKey(this.player.x, this.player.y);
    if (this.pellets.delete(key)) this.collected += 1;
    this.powerUps.delete(key);
    if (this.pellets.size === 0) this.state = 'won';
  }
}
