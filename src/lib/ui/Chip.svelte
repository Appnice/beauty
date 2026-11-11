<script lang="ts">
  import type { Snippet } from 'svelte';
  let {
    on = false,
    onclick,
    children,
    testid
  }: { on?: boolean; onclick?: () => void; children: Snippet; testid?: string } = $props();
</script>

<button type="button" class="chip" class:on aria-pressed={on} {onclick} data-testid={testid}>
  {@render children()}
</button>

<style>
  .chip {
    min-height: var(--tap);
    padding: 0 14px;
    border-radius: 12px;
    border: 1.5px solid var(--line-strong);
    background: var(--surface);
    color: var(--ink);
    font-size: 15px;
    font-weight: 600;
    text-align: left;
  }
  .chip.on {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }
</style>
