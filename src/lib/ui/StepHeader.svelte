<script lang="ts">
  // Wizard top bar: logo (step 1) or back arrow, "N z 6", and the progress bar.
  import Icon from './Icon.svelte';
  import Logo from './Logo.svelte';
  let {
    step,
    total = 6,
    onback,
    brand
  }: { step: number; total?: number; onback?: () => void; brand?: string } = $props();
</script>

<div class="bar">
  {#if onback}
    <button type="button" class="icon-btn back" aria-label="Wstecz" onclick={onback}
      ><Icon name="back" /></button
    >
  {:else if brand}
    <div class="brand salon">{brand}</div>
  {:else}
    <div class="brand"><Logo /> beauty</div>
  {/if}
  <span class="count">{step} z {total}</span>
</div>
<div class="track"><div class="fill" style:width="{Math.round((step / total) * 100)}%"></div></div>

<style>
  .bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 44px;
  }
  .back {
    margin-left: -10px;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 700;
    font-size: 17px;
  }
  .salon {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .count {
    font-size: 14px;
    color: var(--muted);
  }
  .track {
    height: 4px;
    border-radius: 2px;
    background: var(--line);
    margin-top: 12px;
  }
  .fill {
    height: 4px;
    border-radius: 2px;
    background: var(--accent);
  }
</style>
