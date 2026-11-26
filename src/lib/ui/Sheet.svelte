<script lang="ts">
  // Side sheet over the panel (NowaWizyta.dc.html): 420 px on the right, full width on a phone.
  import type { Snippet } from 'svelte';
  import { page } from '$app/state';
  import { i18n } from '$lib/i18n';
  import Icon from './Icon.svelte';
  let { title, onclose, children }: { title: string; onclose: () => void; children: Snippet } = $props();
  const L = $derived(i18n(page.data.lang));
</script>

<svelte:window onkeydown={(e) => e.key === 'Escape' && onclose()} />
<button class="dim" aria-label={L.t.common.close} onclick={onclose}></button>
<div class="sheet" aria-label={title} role="dialog" aria-modal="true">
  <div class="head">
    <h2>{title}</h2>
    <button class="icon-btn close" aria-label={L.t.common.close} onclick={onclose}
      ><Icon name="close" size={22} /></button
    >
  </div>
  {@render children()}
</div>

<style>
  .dim {
    position: fixed;
    inset: 0;
    background: var(--dim);
    border: 0;
    z-index: 40;
    cursor: default;
  }
  .sheet {
    position: fixed;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(420px, 100vw);
    background: var(--bg);
    box-shadow: -12px 0 32px rgba(34, 28, 25, 0.18);
    display: flex;
    flex-direction: column;
    padding: 20px 24px 24px;
    z-index: 41;
    overflow-y: auto;
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  h2 {
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.01em;
  }
  .close {
    margin-right: -10px;
  }
</style>
