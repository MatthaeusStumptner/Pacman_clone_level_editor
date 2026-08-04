<script>
  import { onMount } from 'svelte';
  import { drawDecorationPreview } from '@franz-lola/pixel-renderer';

  let { asset, language = 'standard', label = asset?.name ?? 'Objektvorschau' } = $props();
  let canvas;
  let frame;

  function draw(timestamp = 0) {
    if (!canvas || !asset) return;
    const ratio = Math.min(2, globalThis.devicePixelRatio || 1);
    const bounds = canvas.getBoundingClientRect();
    const width = Math.max(36, Math.round((bounds.width || 44) * ratio));
    const height = Math.max(36, Math.round((bounds.height || 44) * ratio));
    if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
    const context = canvas.getContext('2d');
    context.setTransform(ratio, 0, 0, ratio, 0, 0); context.clearRect(0, 0, width / ratio, height / ratio); context.imageSmoothingEnabled = false;
    drawDecorationPreview(context, { ...asset, x: 0, y: 0 }, { left: 2, top: 2, width: width / ratio - 4, height: height / ratio - 4 }, timestamp / 1000, language);
  }

  function animate(timestamp) { draw(timestamp); frame = requestAnimationFrame(animate); }
  onMount(() => { frame = requestAnimationFrame(animate); return () => cancelAnimationFrame(frame); });
  $effect(() => { asset; language; draw(); });
</script>

<canvas class="object-thumbnail" bind:this={canvas} aria-label={label}></canvas>
