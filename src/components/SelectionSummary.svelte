<script>
  let { studio } = $props();
  let workspaceLabel = $derived(studio.selection?.kind === 'wall' ? 'Levelbau' : ['player', 'cat', 'character'].includes(studio.selection?.kind) ? 'Figurenatelier' : studio.selection?.kind === 'event' ? 'Ereignisregie' : 'Objektwerkstatt');
</script>

{#if studio.selection}
  <div class="selection-summary" role="status">
    <span class="eyebrow">AUSWAHL IM LEVEL</span>
    <div><span>{studio.selection.kind === 'player' ? 'FL' : studio.selection.kind === 'event' ? '!' : studio.selection.kind === 'wall' ? '▦' : '◆'}</span><div><strong>{studio.selectionLabel()}</strong><small>{studio.selectionCount > 1 ? `${studio.selectionCount} Elemente ausgewählt` : 'Ausgewählt · Arbeitsbereich bleibt erhalten'}</small></div></div>
    <p>Ein Klick wählt nur aus. Öffne den spezialisierten Editor bewusst oder per Doppelklick.</p>
    <div class="selection-summary-actions"><button class="primary" onclick={() => studio.openSelectionWorkspace()}>In {workspaceLabel} öffnen →</button><button aria-label="Auswahl aufheben" onclick={() => studio.clearSelection()}>×</button></div>
  </div>
{/if}
