<script lang="ts">
  // One day row (Godziny.dc.html): day name, the hours (tap to change), the on/off switch.
  import { hoursLabel } from '$lib/pl';
  import { page } from '$app/state';
  import { i18n } from '$lib/i18n';
  import Toggle from './Toggle.svelte';

  let {
    weekday,
    open = $bindable(),
    opens = $bindable(),
    closes = $bindable(),
    onchange
  }: {
    weekday: number;
    open: boolean;
    opens: string;
    closes: string;
    onchange?: () => void;
  } = $props();
  const L = $derived(i18n(page.data.lang));
  let edit = $state(false);
  const TIMES: string[] = [];
  for (let m = 6 * 60; m <= 23 * 60; m += 30)
    TIMES.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);
  const short = (t: string) => t.replace(/^0/, '');
</script>

<div class="day">
  <span class="dname" class:off={!open}>{L.weekdays[weekday - 1]}</span>
  {#if open && edit}
    <span class="edit">
      <select aria-label={L.t.common.from} bind:value={opens} onchange={() => onchange?.()}>
        {#each TIMES.filter((t) => t < closes) as t (t)}<option value={t}>{short(t)}</option>{/each}
      </select>
      <select aria-label={L.t.common.to} bind:value={closes} onchange={() => onchange?.()}>
        {#each TIMES.filter((t) => t > opens) as t (t)}<option value={t}>{short(t)}</option>{/each}
      </select>
    </span>
  {:else if open}
    <button type="button" class="hours" onclick={() => (edit = true)}>{hoursLabel(opens, closes)}</button>
  {:else}
    <span class="closed">{L.t.common.closed}</span>
  {/if}
  <Toggle
    bind:on={open}
    label={L.weekdays[weekday - 1]}
    onchange={() => {
      edit = false;
      onchange?.();
    }}
  />
</div>

<style>
  .day {
    /* as in the design: 58 px content-box, the border adds to it */
    box-sizing: content-box;
    height: 58px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 14px;
    border-bottom: 1px solid var(--row-line);
  }
  .dname {
    width: 92px;
    flex-shrink: 0;
    font-size: 17px;
    font-weight: 600;
  }
  .dname.off {
    color: var(--muted);
  }
  .hours {
    flex-grow: 1;
    height: 40px;
    border: 0;
    border-radius: 10px;
    background: var(--surface-2);
    color: var(--ink);
    font-size: 16px;
    font-weight: 500;
  }
  .closed {
    flex-grow: 1;
    text-align: center;
    font-size: 16px;
    color: var(--muted);
  }
  .edit {
    flex-grow: 1;
    display: flex;
    gap: 6px;
    min-width: 0;
  }
  select {
    flex: 1 1 0;
    min-width: 0;
    height: 40px;
    border: 1.5px solid var(--accent);
    border-radius: 10px;
    background: var(--surface);
    color: var(--ink);
    font-size: 16px;
    padding: 0 6px;
  }
</style>
