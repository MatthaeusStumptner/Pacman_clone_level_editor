<script>
  import { onMount } from 'svelte';
  import { PassauPixelRenderer, tileKey } from '@franz-lola/pixel-renderer';
  import { worldPointFromScreen } from '../editor-tools.js';

  let { studio, compact = false, ariaLabel = 'Bearbeitbares Levelraster' } = $props();
  let canvas;
  let renderer;
  let renderResult;
  let animationFrame;

  function selectionCursor() {
    const selection = studio.selection;
    if (!selection) return null;
    if (selection.kind === 'player') return { x: studio.level.actors.player.x, y: studio.level.actors.player.y, color: 'rgba(245,197,77,.46)' };
    if (selection.kind === 'cat') { const cat = studio.level.actors.cats[selection.index]; return cat ? { x: cat.x, y: cat.y, color: 'rgba(245,197,77,.46)' } : null; }
    if (selection.kind === 'decoration') { const item = studio.level.decorations[selection.index]; return item ? { x: item.x, y: item.y, width: item.width, height: item.height, color: 'rgba(245,197,77,.32)' } : null; }
    if (selection.kind === 'theme-element') return studio.specialElementBounds(studio.level.theme.elements?.[selection.index]?.id);
    if (selection.kind === 'event') { const event = studio.level.events[selection.index]; return event ? { x: Math.floor(event.visual.x), y: Math.floor(event.visual.y), color: 'rgba(245,197,77,.46)' } : null; }
    return null;
  }

  function draw(timestamp = performance.now()) {
    if (!renderer || !studio.level) return;
    const level = studio.level;
    const pellets = studio.showGuttis ? studio.pellets : new Set();
    const powerUps = new Set(level.collectibles.powerUps.map((point) => tileKey(point.x, point.y)));
    renderResult = renderer.render({ level, player: level.actors.player, cats: level.actors.cats, pellets, powerUps, elapsed: timestamp / 1000 }, {
      cameraEnabled: false,
      editor: { showGrid: studio.showGrid, showEvents: studio.showEvents, showEventZones: studio.showEvents, cursor: studio.cursor ?? selectionCursor() },
    });
  }

  function animate(timestamp) {
    draw(timestamp);
    animationFrame = requestAnimationFrame(animate);
  }

  function pointFromEvent(event) {
    if (!renderResult) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return worldPointFromScreen(renderResult.camera, { x: event.clientX, y: event.clientY }, { left: rect.left, top: rect.top }, studio.level);
  }

  function pointerDown(event) {
    if (event.button !== 0 && event.button !== 2) return;
    event.preventDefault();
    canvas.setPointerCapture?.(event.pointerId);
    studio.pointerDown(pointFromEvent(event), event.pointerId, event.button === 2);
  }

  function pointerMove(event) { studio.pointerMove(pointFromEvent(event), event.pointerId); }
  function pointerUp(event) {
    studio.pointerUp(pointFromEvent(event), event.pointerId);
    if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  }

  onMount(() => {
    renderer = new PassauPixelRenderer(canvas, { zoom: 1 });
    renderer.setLevel(studio.level);
    animationFrame = requestAnimationFrame(animate);
    const resize = new ResizeObserver(() => draw()); resize.observe(canvas);
    return () => { cancelAnimationFrame(animationFrame); resize.disconnect(); };
  });

  $effect(() => {
    studio.revision; studio.showGrid; studio.showGuttis; studio.showEvents; studio.difficulty; studio.selection; studio.cursor;
    if (renderer && studio.level) { renderer.setLevel(studio.level); draw(); }
  });
</script>

<div class:compact class="level-canvas-frame" style:--board-ratio={`${studio.level.board.columns} / ${studio.level.board.rows}`}>
  <canvas
    id="level-canvas"
    bind:this={canvas}
    aria-label={ariaLabel}
    onpointerdown={pointerDown}
    onpointermove={pointerMove}
    onpointerup={pointerUp}
    onpointercancel={pointerUp}
    onpointerleave={() => studio.leaveCanvas()}
    oncontextmenu={(event) => event.preventDefault()}
  ></canvas>
</div>
