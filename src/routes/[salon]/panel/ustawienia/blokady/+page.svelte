<script lang="ts">
  // Urlopy i przerwy: the blocks of the next 60 days; add one for a person; remove.
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import { personColor } from '$lib/colors';
  import { addDays, hm, instant, shortDate, today, zoned } from '$lib/pl';
  import SubHeader from '$lib/panel/SubHeader.svelte';
  import { BLOCK_KINDS, type Calendar } from '$lib/panel/types';
  import Icon from '$lib/ui/Icon.svelte';
  import { showToast } from '$lib/ui/toast.svelte.ts';

  let { data } = $props();
  const slug = $derived(data.salon.slug);
  interface B {
    id: string;
    staff_id: string;
    starts_at: string;
    ends_at: string;
    reason: string;
  }
  let cal = $state<Calendar | null>(null);
  let list = $state<B[]>([]);
  let who = $state('');
  let kind = $state<string>('Urlop');
  let from = $state(today());
  let to = $state(today());
  let t1 = $state(12 * 60);
  let t2 = $state(13 * 60);
  const TIMES = Array.from({ length: (22 - 6) * 4 + 1 }, (_, i) => 6 * 60 + i * 15);

  async function load() {
    const d = today();
    const [c, b] = await Promise.all([
      api<Calendar>('GET', `/api/${slug}/calendar?date=${d}&days=1`),
      api<{ blocks: B[] }>(
        'GET',
        `/api/${slug}/blocks?from=${encodeURIComponent(instant(d, 0))}&to=${encodeURIComponent(instant(addDays(d, 60), 0))}`
      )
    ]);
    if (c.ok) {
      cal = c.data;
      if (!who) who = cal.staff[0]?.id ?? '';
    }
    if (b.ok) list = b.data.blocks;
  }
  onMount(load);

  async function add(e: SubmitEvent) {
    e.preventDefault();
    const whole = kind === 'Urlop';
    const start = whole ? instant(from, 0) : instant(from, t1);
    const end = whole ? instant(addDays(to < from ? from : to, 1), 0) : instant(from, t2);
    const r = await api('POST', `/api/${slug}/blocks`, { staffId: who, start, end, reason: kind });
    if (!r.ok) return showToast(r.error, 'error');
    showToast(`Dodano: ${kind}`);
    load();
  }
  async function remove(id: string) {
    const r = await api('DELETE', `/api/${slug}/blocks/${id}`);
    if (!r.ok) return showToast(r.error, 'error');
    load();
  }
  function label(b: B): string {
    const a = zoned(b.starts_at);
    const z = zoned(new Date(Date.parse(b.ends_at) - 1));
    if (a.min === 0 && zoned(b.ends_at).min === 0)
      return a.day === z.day ? shortDate(a.day) : `${shortDate(a.day)} – ${shortDate(z.day)}`;
    return `${shortDate(a.day)} · ${hm(a.min)}–${hm(zoned(b.ends_at).min)}`;
  }
</script>

<main class="page">
  <SubHeader {slug} title="Urlopy i przerwy" />
  <div class="rows">
    {#each list as b (b.id)}
      {@const i = cal?.staff.findIndex((s) => s.id === b.staff_id) ?? 0}
      {@const c = personColor(cal?.staff[i]?.color, i)}
      <div class="rowbox" data-testid="block-row">
        <span class="dot" style:background={c.dot}></span>
        <span class="bname">{cal?.staff[i]?.name} · {b.reason || 'Blokada'}</span>
        <span class="muted">{label(b)}</span>
        <button class="icon-btn" aria-label="Usuń" onclick={() => remove(b.id)}
          ><Icon name="close" size={20} color="#9A918A" /></button
        >
      </div>
    {/each}
  </div>

  <form class="add" onsubmit={add} novalidate>
    <p class="label">Kto</p>
    <div class="chips">
      {#each cal?.staff ?? [] as s (s.id)}
        <button
          type="button"
          class="chip"
          class:on={who === s.id}
          aria-pressed={who === s.id}
          onclick={() => (who = s.id)}>{s.name}</button
        >
      {/each}
    </div>
    <p class="label">Co</p>
    <div class="chips">
      {#each BLOCK_KINDS as k (k)}
        <button
          type="button"
          class="chip"
          class:on={kind === k}
          aria-pressed={kind === k}
          onclick={() => (kind = k)}>{k}</button
        >
      {/each}
    </div>
    <div class="two">
      <label class="field"
        >{kind === 'Urlop' ? 'Od' : 'Dzień'}<input class="input" type="date" bind:value={from} /></label
      >
      {#if kind === 'Urlop'}
        <label class="field">Do<input class="input" type="date" bind:value={to} /></label>
      {:else}
        <label class="field"
          >Od<select class="input" bind:value={t1}
            >{#each TIMES as t (t)}<option value={t}>{hm(t)}</option>{/each}</select
          ></label
        >
        <label class="field"
          >Do<select class="input" bind:value={t2}
            >{#each TIMES as t (t)}<option value={t}>{hm(t)}</option>{/each}</select
          ></label
        >
      {/if}
    </div>
    <button class="btn" style="margin-top: 20px">Dodaj</button>
  </form>
</main>

<style>
  .dot {
    width: 12px;
    height: 12px;
    border-radius: 6px;
    flex-shrink: 0;
  }
  .bname {
    flex-grow: 1;
    font-size: 16px;
    font-weight: 600;
  }
  .add {
    max-width: 520px;
    margin-top: 12px;
  }
  .two {
    display: flex;
    gap: 12px;
    margin-top: 18px;
  }
  .two .field {
    flex: 1 1 0;
    min-width: 0;
  }
</style>
