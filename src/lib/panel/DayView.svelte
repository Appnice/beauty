<script lang="ts">
  // The owner's day: the calendar, a new visit from a free time, drag and drop, the visit card.
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { api } from '$lib/api';
  import { i18n } from '$lib/i18n';
  import { addDays, instant, today, zoned } from '$lib/pl';
  import { showToast } from '$lib/ui/toast.svelte.ts';
  import DayBar from './DayBar.svelte';
  import DayGrid from './DayGrid.svelte';
  import NewVisitSheet from './NewVisitSheet.svelte';
  import VisitSheet from './VisitSheet.svelte';
  import { minOn } from './layout';
  import { refreshPending } from './panel.svelte.ts';
  import type { Calendar, PVisit } from './types';

  let { slug }: { slug: string } = $props();
  const L = $derived(i18n(page.data.lang));
  const day = $derived(page.url.searchParams.get('d') ?? today());
  let cal = $state<Calendar | null>(null);
  let now = $state(Date.now());
  let adding = $state<{ staffId: string; min: number; pick: boolean } | null>(null);
  let open = $state<PVisit | null>(null);

  async function load() {
    const r = await api<Calendar>('GET', `/api/${slug}/calendar?date=${day}&days=1`);
    if (r.ok) cal = r.data;
    else showToast(r.error, 'error');
  }
  $effect(() => {
    void day;
    load();
  });
  $effect(() => {
    const t = setInterval(() => (now = Date.now()), 30_000);
    return () => clearInterval(t);
  });
  const nowZ = $derived(zoned(new Date(now)));
  const isToday = $derived(day === nowZ.day);

  const go = (d: string) => goto(`/${slug}/panel?d=${d}`, { keepFocus: true, noScroll: true });

  async function moveVisit(v: PVisit, staffId: string, min: number) {
    if (!cal) return;
    const before = { ...v };
    const dur = minOn(v.end, day) - minOn(v.start, day);
    const target = cal.visits.find((x) => x.id === v.id)!;
    Object.assign(target, { staffId, start: instant(day, min), end: instant(day, min + dur) });
    const r = await api('PATCH', `/api/${slug}/visits/${v.id}`, {
      action: 'move',
      start: instant(day, min),
      staffId
    });
    if (!r.ok) {
      Object.assign(target, before);
      showToast(r.error, 'error');
      return;
    }
    load();
  }

  function addNow() {
    if (!cal?.staff.length) return;
    const m = isToday ? Math.ceil((nowZ.min + 1) / 15) * 15 : 9 * 60;
    adding = { staffId: cal.staff[0].id, min: Math.min(m, 21 * 60), pick: true };
  }

  function done(msg: string) {
    adding = null;
    open = null;
    showToast(msg);
    load();
    refreshPending();
  }
</script>

<main class="day">
  <DayBar
    title={L.longDate(day)}
    {isToday}
    view="day"
    prev={() => go(addDays(day, -1))}
    next={() => go(addDays(day, 1))}
    dayHref="/{slug}/panel?d={day}"
    weekHref="/{slug}/panel/tydzien?d={day}"
    onadd={addNow}
  />
  {#if cal}
    <DayGrid
      {cal}
      {day}
      nowMin={isToday ? nowZ.min : null}
      selecting={!!adding}
      onfree={(staffId, min) => (adding = { staffId, min, pick: false })}
      onopen={(v) => (open = v)}
      onmove={moveVisit}
    />
  {/if}
</main>

{#if adding && cal}
  <NewVisitSheet
    {slug}
    {cal}
    {day}
    staffId={adding.staffId}
    min={adding.min}
    pick={adding.pick}
    onclose={() => (adding = null)}
    onsaved={done}
  />
{/if}
{#if open && cal}
  <VisitSheet {slug} {cal} visit={open} onclose={() => (open = null)} ondone={done} />
{/if}

<style>
  .day {
    flex-grow: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    padding: 14px 16px 16px;
  }
</style>
