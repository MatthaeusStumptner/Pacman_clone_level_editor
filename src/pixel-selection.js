const key = (x, y) => `${x}:${y}`;
const point = (value) => { const [x, y] = String(value).split(':').map(Number); return { x, y }; };

export function rectanglePixelKeys(start, end, width, height) {
  const left = Math.max(0, Math.min(start.x, end.x)); const right = Math.min(width - 1, Math.max(start.x, end.x));
  const top = Math.max(0, Math.min(start.y, end.y)); const bottom = Math.min(height - 1, Math.max(start.y, end.y));
  const result = [];
  for (let y = top; y <= bottom; y += 1) for (let x = left; x <= right; x += 1) result.push(key(x, y));
  return result;
}

export function selectPixelRectangle(selection, start, end, width, height, additive = false) {
  return [...new Set([...(additive ? selection : []), ...rectanglePixelKeys(start, end, width, height)])];
}

export function selectPixelsByToken(rows, token) {
  const result = [];
  rows.forEach((row, y) => [...row].forEach((value, x) => { if (value === token) result.push(key(x, y)); }));
  return result;
}

export function invertPixelSelection(selection, width, height) {
  const selected = new Set(selection); const result = [];
  for (let y = 0; y < height; y += 1) for (let x = 0; x < width; x += 1) if (!selected.has(key(x, y))) result.push(key(x, y));
  return result;
}

export function applyTokenToSelection(rows, selection, token) {
  const next = [...rows];
  for (const value of selection) {
    const { x, y } = point(value); if (!next[y] || x < 0 || x >= next[y].length) continue;
    next[y] = `${next[y].slice(0, x)}${token}${next[y].slice(x + 1)}`;
  }
  return next;
}

export function moveSelectedPixels(rows, selection, dx, dy) {
  const height = rows.length; const width = rows[0]?.length ?? 0; const selected = new Set(selection);
  const moved = selection.map((value) => { const source = point(value); return { source, target: { x: source.x + dx, y: source.y + dy }, token: rows[source.y]?.[source.x] ?? '0' }; });
  if (moved.some(({ target }) => target.x < 0 || target.y < 0 || target.x >= width || target.y >= height)) return { rows, selection, moved: false };
  let next = rows.map((row, y) => [...row].map((token, x) => selected.has(key(x, y)) ? '0' : token).join(''));
  const nextSelection = [];
  for (const entry of moved) {
    const { x, y } = entry.target; next[y] = `${next[y].slice(0, x)}${entry.token}${next[y].slice(x + 1)}`; nextSelection.push(key(x, y));
  }
  return { rows: next, selection: nextSelection, moved: true };
}
