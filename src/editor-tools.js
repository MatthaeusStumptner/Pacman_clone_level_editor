import { reachableTileKeys, tileKey } from '@franz-lola/pixel-renderer';

export function linePoints(start, end) {
  const points = [];
  let x = start.x; let y = start.y;
  const dx = Math.abs(end.x - start.x); const sx = start.x < end.x ? 1 : -1;
  const dy = -Math.abs(end.y - start.y); const sy = start.y < end.y ? 1 : -1;
  let error = dx + dy;
  while (true) {
    points.push({ x, y });
    if (x === end.x && y === end.y) break;
    const twice = error * 2;
    if (twice >= dy) { error += dy; x += sx; }
    if (twice <= dx) { error += dx; y += sy; }
  }
  return points;
}

export function rectanglePoints(start, end, { filled = true } = {}) {
  const left = Math.min(start.x, end.x); const right = Math.max(start.x, end.x);
  const top = Math.min(start.y, end.y); const bottom = Math.max(start.y, end.y);
  const points = [];
  for (let y = top; y <= bottom; y += 1) {
    for (let x = left; x <= right; x += 1) {
      if (filled || x === left || x === right || y === top || y === bottom) points.push({ x, y });
    }
  }
  return points;
}

export function floodFillPoints(start, matchingCells, columns, rows) {
  const expected = matchingCells.has(tileKey(start.x, start.y));
  const visited = new Set();
  const queue = [start];
  const result = [];
  while (queue.length) {
    const point = queue.shift();
    const key = tileKey(point.x, point.y);
    if (visited.has(key) || point.x < 0 || point.y < 0 || point.x >= columns || point.y >= rows) continue;
    visited.add(key);
    if (matchingCells.has(key) !== expected) continue;
    result.push(point);
    queue.push({ x: point.x + 1, y: point.y }, { x: point.x - 1, y: point.y }, { x: point.x, y: point.y + 1 }, { x: point.x, y: point.y - 1 });
  }
  return result;
}

export function previewGuttis(level, difficulty = 'easy') {
  const reachable = reachableTileKeys(level);
  const powerKeys = new Set(level.collectibles.powerUps.map((point) => tileKey(point.x, point.y)));
  const candidates = [...reachable]
    .map((key) => ({ key, coordinates: key.split(',').map(Number) }))
    .filter(({ key, coordinates: [x, y] }) => {
      const inStartArea = x >= 10 && x <= 14 && y >= 11 && y <= 13;
      const atPlayerStart = x === level.actors.player.x && y === level.actors.player.y;
      const insideBoard = x > 0 && x < level.board.columns - 1 && y > 0 && y < level.board.rows - 1;
      return insideBoard && !inStartArea && !atPlayerStart && !powerKeys.has(key);
    })
    .sort((a, b) => {
      const [ax, ay] = a.coordinates; const [bx, by] = b.coordinates; const seed = level.gameplay.pelletSeed;
      return ((ax * 137 + ay * 71 + seed) % 997) - ((bx * 137 + by * 71 + seed) % 997);
    });
  const target = level.gameplay.treatTargets[difficulty] ?? level.gameplay.treatTargets.easy;
  return new Set(candidates.slice(0, target).map(({ key }) => key));
}

export function worldPointFromScreen(camera, clientPoint, canvasRect, level) {
  const localX = clientPoint.x - canvasRect.left;
  const localY = clientPoint.y - canvasRect.top;
  const x = (localX - camera.viewport.x) / camera.viewport.width * camera.source.width + camera.source.x;
  const y = (localY - camera.viewport.y) / camera.viewport.height * camera.source.height + camera.source.y;
  return {
    x: Math.max(0, Math.min(level.board.columns - 1, Math.floor(x / level.board.tileSize))),
    y: Math.max(0, Math.min(level.board.rows - 1, Math.floor(y / level.board.tileSize))),
  };
}
