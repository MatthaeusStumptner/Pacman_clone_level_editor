export const PLAYER_STATES = Object.freeze(['idle', 'up', 'right', 'down', 'left']);

function createFrame(direction, step = 0) {
  const width = 12;
  const height = 12;
  const grid = Array.from({ length: height }, () => Array(width).fill('0'));
  const paint = (x, y, paintWidth, paintHeight, token) => {
    for (let row = y; row < y + paintHeight; row += 1) {
      for (let column = x; column < x + paintWidth; column += 1) {
        if (row >= 0 && row < height && column >= 0 && column < width) grid[row][column] = token;
      }
    }
  };

  // Franz: Hut, Gesicht, weißer Bart, Jacke und zwei gehende Beine.
  paint(4, 1, 5, 1, '4'); paint(5, 2, 3, 3, '2'); paint(4, 3, 1, 2, '3'); paint(8, 3, 1, 2, '3');
  paint(5, 4, 3, 2, '3'); paint(4, 6, 5, 3, '1'); paint(3, 6, 1, 3, '2'); paint(9, 6, 1, 3, '2');
  paint(4 + step, 9, 2, 3, '5'); paint(7 - step, 9, 2, 3, '5');

  const dog = direction === 'left' ? { x: 0, y: 7, noseX: 0 }
    : direction === 'up' ? { x: 8, y: 1, noseX: 10 }
      : direction === 'down' ? { x: 8, y: 9, noseX: 10 }
        : { x: 9, y: 7, noseX: 11 };
  paint(Math.min(9, dog.x), dog.y, 3, 2, '6'); paint(Math.min(9, dog.x + (direction === 'left' ? 0 : 1)), dog.y - 1, 2, 2, '7');
  paint(dog.noseX, dog.y, 1, 1, '8'); paint(Math.min(11, dog.x + (step ? 0 : 2)), dog.y + 2, 1, 1, '6');

  // Leine als kleine goldene Pixelkette zwischen Franz und Lola.
  const leashTargetX = Math.max(0, Math.min(11, dog.x + 1));
  const leashTargetY = Math.max(0, Math.min(11, dog.y));
  const leashSteps = Math.max(Math.abs(leashTargetX - 8), Math.abs(leashTargetY - 7), 1);
  for (let index = 0; index <= leashSteps; index += 1) {
    const x = Math.round(8 + (leashTargetX - 8) * index / leashSteps);
    const y = Math.round(7 + (leashTargetY - 7) * index / leashSteps);
    if (grid[y]?.[x] === '0') grid[y][x] = '9';
  }
  return grid.map((row) => row.join(''));
}

export function createFranzLolaAppearance() {
  const palette = ['transparent', '#3f7969', '#d99a78', '#f4eee0', '#223a42', '#13201e', '#d8b27b', '#f1d7aa', '#241b18', '#e7a84c'];
  const animations = PLAYER_STATES.map((state) => ({
    id: state,
    fps: state === 'idle' ? 2 : 8,
    loop: true,
    frames: [
      { pixels: createFrame(state, 0) },
      { pixels: createFrame(state, 1) },
    ],
  }));
  return {
    width: 12,
    height: 12,
    palette,
    pixels: [...animations[0].frames[0].pixels],
    animations,
    stateAnimations: Object.fromEntries(PLAYER_STATES.map((state) => [state, state])),
  };
}
