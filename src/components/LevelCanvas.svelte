<script>
  import { onMount } from 'svelte';
  import { PassauPixelRenderer, tileKey } from '@franz-lola/pixel-renderer';
  import { worldPointFromScreen, worldTilePointFromScreen } from '../editor-tools.js';

  let { studio, compact = false, ariaLabel = 'Bearbeitbares Levelraster' } = $props();
  let canvas;
  let renderer;
  let renderResult;
  let animationFrame;
  let lastDraw = 0;
  let visible = true;

  function selectionCursor() {
    const selection = studio.selection;
    if (!selection) return null;
    if (studio.isSceneHidden(selection.kind, selection.index)) return null;
    if (selection.kind === 'player') return { x: studio.level.actors.player.x, y: studio.level.actors.player.y, color: 'rgba(245,197,77,.46)' };
    if (selection.kind === 'cat') { const cat = studio.level.actors.cats[selection.index]; return cat ? { x: cat.x, y: cat.y, color: 'rgba(245,197,77,.46)' } : null; }
    if (selection.kind === 'character') { const character = studio.level.actors.characters?.[selection.index]; return character ? { x: character.x, y: character.y, color: 'rgba(85,217,221,.5)' } : null; }
    if (selection.kind === 'decoration') { const item = studio.level.decorations[selection.index]; return item && studio.tool !== 'transform' ? { x: item.x, y: item.y, width: item.width, height: item.height, color: 'rgba(245,197,77,.32)' } : null; }
    if (selection.kind === 'wall') { const wall = studio.level.board.walls[selection.index]; return wall ? { x: wall.x, y: wall.y, width: wall.width, height: wall.height, color: 'rgba(245,197,77,.38)' } : null; }
    if (selection.kind === 'theme-element') return studio.specialElementBounds(studio.level.theme.elements?.[selection.index]?.id);
    if (selection.kind === 'event') { const event = studio.level.events[selection.index]; return event ? { x: Math.floor(event.visual.x), y: Math.floor(event.visual.y), color: 'rgba(245,197,77,.46)' } : null; }
    return null;
  }

  function selectionBounds(selection) {
    if (!selection || studio.isSceneHidden(selection.kind, selection.index)) return null;
    if (selection.kind === 'player') return { x: studio.level.actors.player.x, y: studio.level.actors.player.y };
    if (selection.kind === 'cat') return studio.level.actors.cats[selection.index] ?? null;
    if (selection.kind === 'character') return studio.level.actors.characters?.[selection.index] ?? null;
    if (selection.kind === 'decoration') return studio.level.decorations[selection.index] ?? null;
    if (selection.kind === 'wall') return studio.level.board.walls[selection.index] ?? null;
    if (selection.kind === 'theme-element') return studio.specialElementBounds(studio.level.theme.elements?.[selection.index]?.id);
    if (selection.kind === 'event') { const event = studio.level.events[selection.index]; return event ? { x: event.visual.x - 0.5, y: event.visual.y - 0.5 } : null; }
    return null;
  }

  function selectionOutlines() {
    return studio.selections.map((selection, index) => {
      const bounds = selectionBounds(selection);
      return bounds ? { x: bounds.x, y: bounds.y, width: bounds.width ?? 1, height: bounds.height ?? 1, primary: index === studio.selections.length - 1 } : null;
    }).filter(Boolean);
  }

  function draw(timestamp = performance.now()) {
    if (!renderer || !studio.level) return;
    const level = studio.editorLevel;
    const pellets = studio.showGuttis ? studio.pellets : new Set();
    const powerUps = new Set(level.collectibles.powerUps.map((point) => tileKey(point.x, point.y)));
    const player = studio.isSceneHidden('player', 0) ? { ...level.actors.player, x: -100, y: -100 } : level.actors.player;
    renderResult = renderer.render({ level, player, cats: level.actors.cats, pellets, powerUps, elapsed: timestamp / 1000 }, {
      cameraEnabled: false,
      language: studio.language,
      editor: { showGrid: studio.showGrid, showEvents: studio.showEvents, showEventZones: studio.showEvents, cursor: studio.cursor ?? selectionCursor(), selections: selectionOutlines(), transformSelection: studio.tool === 'transform' ? studio.transformSelection() : null },
    });
  }

  function animate(timestamp) {
    // 10 FPS is sufficient for an editor preview and keeps every tool immediately responsive.
    if (visible && (!lastDraw || timestamp - lastDraw >= 100)) { draw(timestamp); lastDraw = timestamp; }
    animationFrame = requestAnimationFrame(animate);
  }

  function pointFromEvent(event) {
    if (!renderResult) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return worldPointFromScreen(renderResult.camera, { x: event.clientX, y: event.clientY }, { left: rect.left, top: rect.top }, studio.level);
  }

  function precisePointFromEvent(event) {
    if (!renderResult) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return worldTilePointFromScreen(renderResult.camera, { x: event.clientX, y: event.clientY }, { left: rect.left, top: rect.top }, studio.level);
  }

  function pointerDown(event) {
    if (event.button !== 0 && event.button !== 2) return;
    event.preventDefault();
    canvas.setPointerCapture?.(event.pointerId);
    studio.pointerDown(pointFromEvent(event), event.pointerId, event.button === 2, precisePointFromEvent(event), { cycle: event.altKey, additive: event.shiftKey });
  }

  function pointerMove(event) { studio.pointerMove(pointFromEvent(event), event.pointerId, precisePointFromEvent(event)); }
  function pointerUp(event) {
    studio.pointerUp(pointFromEvent(event), event.pointerId);
    if (canvas.hasPointerCapture?.(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
  }

  onMount(() => {
    renderer = new PassauPixelRenderer(canvas, { zoom: 1 });
    renderer.setLevel(studio.editorLevel);
    animationFrame = requestAnimationFrame(animate);
    const resize = new ResizeObserver(() => draw()); resize.observe(canvas);
    const intersection = new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; if (visible) draw(); }); intersection.observe(canvas);
    return () => { cancelAnimationFrame(animationFrame); resize.disconnect(); intersection.disconnect(); };
  });

  $effect(() => {
    studio.revision; studio.sceneRevision; studio.showGrid; studio.showGuttis; studio.showEvents; studio.difficulty; studio.selection; studio.cursor;
    if (renderer && studio.editorLevel) { renderer.setLevel(studio.editorLevel); draw(); }
  });
</script>

<div class:compact class="level-canvas-frame" style:--board-ratio={`${studio.level.board.columns} / ${studio.level.board.rows}`}>
  <canvas
    id="level-canvas"
    bind:this={canvas}
    class:transform-tool={studio.tool === 'transform'}
    aria-label={ariaLabel}
    onpointerdown={pointerDown}
    onpointermove={pointerMove}
    onpointerup={pointerUp}
    onpointercancel={pointerUp}
    onpointerleave={() => studio.leaveCanvas()}
    oncontextmenu={(event) => event.preventDefault()}
    data-selection-count={studio.selectionCount}
    data-selected-entity={studio.selection ? `${studio.selection.kind}:${studio.selection.index}` : ''}
  ></canvas>
</div>
