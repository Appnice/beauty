<script lang="ts">
  // Step 3: a day, then a free time. Only starts the engine offers for this service (length + buffer fit).
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { api } from '$lib/api';
  import { i18n } from '$lib/i18n';
  import { addDays, hm, isoWeekday, toMin, today } from '$lib/pl';
  import StepHeader from '$lib/ui/StepHeader.svelte';
  import { b, type PublicPerson, type PublicService } from './state.svelte';

  let {
    slug,
    service,
    person,
    next,
    back
  }: {
    slug: string;
    service: PublicService;
    person: PublicPerson | null;
    next: () => void;
    back: () => void;
  } = $props();
  const L = $derived(i18n(page.data.lang));

  const DAYS = 14;
  interface Slot {
    start: string;
    date: string;
    time: string;
  }
  let from = $state(today());
  let slots = $state<Slot[] | null>(null);
  let error = $state('');
  let day = $state('');
  const days = $derived(Array.from({ length: DAYS }, (_, i) => addDays(from, i)));
  const byDay = $derived.by(() => {
    const m: Record<string, Slot[]> = {};
    for (const s of slots ?? []) (m[s.date] ??= []).push(s);
    return m;
  });

  async function fetchSlots() {
    slots = null;
    // a throwaway query string, not state
    // eslint-disable-next-line svelte/prefer-svelte-reactivity
    const q = new URLSearchParams({ service: service.id, date: from, days: String(DAYS) });
    if (b.staffId) q.set('staff', b.staffId);
    const r = await api<{ slots: Slot[] }>('GET', `/api/${slug}/availability?${q}`);
    if (!r.ok) return void (error = r.error);
    slots = r.data.slots;
    day = days.find((d) => byDay[d]?.length) ?? days[0];
  }
  onMount(fetchSlots);

  function later() {
    from = addDays(from, DAYS);
    fetchSlots();
  }

  function pick(s: Slot) {
    b.start = s.start;
    b.taken = false;
    next();
  }
</script>

<main class="wiz">
  <StepHeader step={3} total={5} onback={back} />
  <h1 style="margin: 40px 0 8px">{L.t.booking.time.title}</h1>
  <p class="lead">{service.name} · {person?.name ?? L.t.booking.person.any}</p>
  {#if b.taken}<p class="error taken" role="alert">{L.t.booking.time.taken}</p>{/if}

  <div class="days" data-testid="days">
    {#each days as d (d)}
      {@const n = byDay[d]?.length ?? 0}
      <button
        type="button"
        class="day"
        class:on={d === day}
        disabled={slots !== null && n === 0}
        aria-pressed={d === day}
        onclick={() => (day = d)}
      >
        <span class="wd">{L.weekdaysShort[isoWeekday(d) - 1]}</span>
        <span class="dd">{Number(d.slice(8))}.{d.slice(5, 7)}</span>
      </button>
    {/each}
  </div>

  {#if error}
    <p class="error" role="alert" style="margin-top: 20px">{error}</p>
  {:else if slots === null}
    <p class="lead" style="margin-top: 20px">…</p>
  {:else if slots.length === 0}
    <p class="lead" style="margin-top: 20px">{L.t.booking.time.none}</p>
    <button type="button" class="btn secondary" style="margin-top: 16px" onclick={later}
      >{L.t.booking.time.later}</button
    >
  {:else}
    <div class="times" data-testid="times">
      {#each byDay[day] ?? [] as s (s.start)}
        <button type="button" class="time" onclick={() => pick(s)}>{hm(toMin(s.time))}</button>
      {/each}
    </div>
    <button type="button" class="more" onclick={later}>{L.t.booking.time.later}</button>
  {/if}
</main>

<style>
  .taken {
    margin-top: 16px;
  }
  .days {
    display: flex;
    gap: 8px;
    margin: 28px -24px 0;
    padding: 0 24px 4px;
    overflow-x: auto;
    scrollbar-width: none;
  }
  .day {
    flex-shrink: 0;
    width: 60px;
    height: 64px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    border: 1.5px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--ink);
  }
  .day:disabled {
    opacity: 0.4;
    cursor: default;
  }
  .day.on {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }
  .wd {
    font-size: 13px;
    font-weight: 500;
  }
  .dd {
    font-size: 16px;
    font-weight: 700;
  }
  .times {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
    margin-top: 20px;
  }
  .time {
    height: 48px;
    border: 1.5px solid var(--line-strong);
    border-radius: 12px;
    background: var(--surface);
    color: var(--ink);
    font-size: 16px;
    font-weight: 600;
  }
  .time:hover {
    border-color: var(--accent);
  }
  .more {
    margin-top: 16px;
    align-self: flex-start;
    min-height: 44px;
    border: 0;
    background: none;
    padding: 0;
    color: var(--accent);
    font-size: 15px;
    font-weight: 600;
  }
</style>
