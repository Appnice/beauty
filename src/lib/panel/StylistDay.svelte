<script lang="ts">
  // The stylist on her phone: my day today and tomorrow, add or remove my own block. Nothing else.
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { api } from '$lib/api';
  import { personColor } from '$lib/colors';
  import { i18n } from '$lib/i18n';
  import { addDays, hm, instant, today } from '$lib/pl';
  import Icon from '$lib/ui/Icon.svelte';
  import Sheet from '$lib/ui/Sheet.svelte';
  import { showToast } from '$lib/ui/toast.svelte.ts';
  import { blocksOf, minOn, timeRange, visitsOf } from './layout';
  import { BLOCK_KINDS, type Calendar } from './types';

  let { slug, name }: { slug: string; name: string } = $props();
  const L = $derived(i18n(page.data.lang));
  const t = $derived(L.t.panel.stylist);
  let which = $state<0 | 1>(0);
  const day = $derived(addDays(today(), which));
  let cal = $state<Calendar | null>(null);
  let adding = $state(false);
  /** The stored reason: one of `BLOCK_KINDS` (Polish in the data), shown through `block.kind`. */
  let kind = $state<string>('Przerwa');
  let from = $state(12 * 60);
  let to = $state(13 * 60);
  const TIMES = Array.from({ length: (22 - 6) * 4 + 1 }, (_, i) => 6 * 60 + i * 15);

  async function load() {
    const r = await api<Calendar>('GET', `/api/${slug}/calendar?date=${day}&days=1`);
    if (r.ok) cal = r.data;
  }
  $effect(() => {
    void day;
    load();
  });

  const me = $derived(cal?.staff[0]);
  const c = $derived(personColor(me?.color, 0));
  const items = $derived(
    cal && me
      ? [
          ...visitsOf(cal, me.id, day).map((v) => ({
            kind: 'visit' as const,
            id: v.id,
            a: minOn(v.start, day),
            z: minOn(v.end, day),
            title: L.t.panel.client(v.clientName),
            sub: v.serviceName,
            pending: v.status === 'oczekuje'
          })),
          ...blocksOf(cal, me.id, day).map((b) => ({
            kind: 'block' as const,
            id: b.id,
            a: Math.max(minOn(b.start, day), 0),
            z: Math.min(minOn(b.end, day), 24 * 60),
            title: L.t.panel.block.kind(b.reason) || L.t.panel.block.fallback,
            sub: '',
            pending: false
          }))
        ].sort((x, y) => x.a - y.a)
      : []
  );

  async function addBlock(e: SubmitEvent) {
    e.preventDefault();
    if (!me) return;
    if (to <= from) return showToast(t.endAfterStart, 'error');
    const r = await api('POST', `/api/${slug}/blocks`, {
      staffId: me.id,
      start: instant(day, from),
      end: instant(day, to),
      reason: kind
    });
    if (!r.ok) return showToast(r.error, 'error');
    adding = false;
    showToast(t.added(L.t.panel.block.kind(kind)));
    load();
  }

  async function removeBlock(id: string) {
    const r = await api('DELETE', `/api/${slug}/blocks/${id}`);
    if (!r.ok) return showToast(r.error, 'error');
    showToast(t.removed);
    load();
  }

  async function logout() {
    await api('POST', `/api/${slug}/auth/logout`);
    goto('/login');
  }
</script>

<main class="wiz me">
  <div class="top">
    <span class="hello">{name}</span>
    <button class="icon-btn" aria-label={t.logout} onclick={logout}><Icon name="logout" size={22} /></button>
  </div>
  <div role="group" aria-label={t.dayGroup} class="seg">
    <button class:on={which === 0} onclick={() => (which = 0)}>{t.today}</button>
    <button class:on={which === 1} onclick={() => (which = 1)}>{t.tomorrow}</button>
  </div>
  <h1>{L.longDate(day)}</h1>

  <div class="list" data-testid="my-day">
    {#each items as it (it.id)}
      {#if it.kind === 'visit'}
        <div
          class="item"
          data-testid="my-visit"
          style:background={it.pending ? '#FFFFFF' : c.bg}
          style:color={c.ink}
          style:border={it.pending ? `1.5px dashed ${c.dot}` : '0'}
        >
          <span class="t">{timeRange(it.a, it.z)}</span>
          <span class="title">{it.title}</span>
          <span class="sub">{it.pending ? t.waiting : it.sub}</span>
        </div>
      {:else}
        <div class="item block" data-testid="my-block">
          <span class="grow-col">
            <span class="t">{timeRange(it.a, it.z)}</span>
            <span class="title">{it.title}</span>
          </span>
          <button
            class="icon-btn"
            aria-label={t.remove(it.title, hm(it.a))}
            onclick={() => removeBlock(it.id)}
          >
            <Icon name="close" size={20} />
          </button>
        </div>
      {/if}
    {:else}
      {#if cal}<p class="muted empty">{t.empty}</p>{/if}
    {/each}
  </div>

  <div class="grow"></div>
  <button class="btn" onclick={() => (adding = true)}
    ><Icon name="plus" size={20} stroke={2.4} /> {t.addBreak}</button
  >
</main>

{#if adding}
  <Sheet title={t.sheetTitle} onclose={() => (adding = false)}>
    <form class="form" onsubmit={addBlock} novalidate>
      <div class="chips" role="radiogroup" aria-label={t.reason}>
        {#each BLOCK_KINDS as k (k)}
          <button
            type="button"
            role="radio"
            aria-checked={kind === k}
            class="chip"
            class:on={kind === k}
            onclick={() => (kind = k)}>{L.t.panel.block.kind(k)}</button
          >
        {/each}
      </div>
      <div class="two">
        <label class="field"
          >{t.from}<select class="input" bind:value={from}
            >{#each TIMES as t (t)}<option value={t}>{hm(t)}</option>{/each}</select
          ></label
        >
        <label class="field"
          >{t.to}<select class="input" bind:value={to}
            >{#each TIMES as t (t)}<option value={t}>{hm(t)}</option>{/each}</select
          ></label
        >
      </div>
      <div class="grow"></div>
      <button class="btn">{t.save} · {L.longDate(day)}</button>
    </form>
  </Sheet>
{/if}

<style>
  .top {
    height: 44px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  .hello {
    font-size: 17px;
    font-weight: 700;
  }
  .seg {
    margin-top: 12px;
    height: 44px;
    display: flex;
    padding: 3px;
    border-radius: 12px;
    background: var(--seg);
  }
  .seg button {
    flex: 1 1 0;
    border: 0;
    border-radius: 9px;
    background: transparent;
    color: var(--muted);
    font-size: 15px;
    font-weight: 600;
  }
  .seg button.on {
    background: var(--surface);
    color: var(--ink);
    box-shadow: 0 1px 2px rgba(34, 28, 25, 0.12);
  }
  h1 {
    margin: 24px 0 0;
    font-size: 26px;
  }
  .list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 16px;
  }
  .item {
    min-height: 64px;
    padding: 8px 12px;
    border-radius: 12px;
    display: flex;
    flex-direction: column;
    gap: 1px;
  }
  .item.block {
    background: var(--hatch);
    color: var(--muted);
    flex-direction: row;
    align-items: center;
  }
  .grow-col {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
  }
  .t {
    font-size: 13px;
    font-weight: 600;
    opacity: 0.85;
  }
  .title {
    font-size: 16px;
    font-weight: 700;
  }
  .sub {
    font-size: 14px;
  }
  .empty {
    font-size: 16px;
  }
  .form {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    margin-top: 18px;
  }
  .chips {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .chip {
    height: 44px;
    padding: 0 14px;
    border-radius: 12px;
    border: 1.5px solid var(--line-strong);
    background: var(--surface);
    color: var(--ink);
    font-size: 15px;
    font-weight: 600;
  }
  .chip.on {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }
  .two {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
    margin-top: 18px;
  }
</style>
