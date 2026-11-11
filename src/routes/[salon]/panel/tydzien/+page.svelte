<script lang="ts">
  // The week view: 7 days, one lane per person in the person's colour. A day name opens that day.
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { api } from '$lib/api';
  import { personColor } from '$lib/colors';
  import { addDays, isoWeekday, MONTHS_GEN, today, WEEKDAYS_SHORT, zoned } from '$lib/pl';
  import DayBar from '$lib/panel/DayBar.svelte';
  import VisitSheet from '$lib/panel/VisitSheet.svelte';
  import { HOUR_PX, blocksOf, dayRange, minOn, visitsOf } from '$lib/panel/layout';
  import { refreshPending } from '$lib/panel/panel.svelte.ts';
  import type { Calendar, PVisit } from '$lib/panel/types';
  import { showToast } from '$lib/ui/toast.svelte.ts';

  let { data } = $props();
  const slug = $derived(data.salon.slug);
  const picked = $derived(page.url.searchParams.get('d') ?? today());
  const monday = $derived(addDays(picked, 1 - isoWeekday(picked)));
  const days = $derived(Array.from({ length: 7 }, (_, i) => addDays(monday, i)));
  let cal = $state<Calendar | null>(null);
  let open = $state<PVisit | null>(null);

  async function load() {
    const r = await api<Calendar>('GET', `/api/${slug}/calendar?date=${monday}&days=7`);
    if (r.ok) cal = r.data;
    else showToast(r.error, 'error');
  }
  $effect(() => {
    void monday;
    load();
  });

  const range = $derived.by(() => {
    if (!cal) return { start: 9, end: 18 };
    const rs = days.map((d) => dayRange(cal!, d));
    return { start: Math.min(...rs.map((r) => r.start)), end: Math.max(...rs.map((r) => r.end)) };
  });
  const PX = HOUR_PX * 0.75;
  const y = (min: number) => ((min - range.start * 60) / 60) * PX;
  const title = $derived.by(() => {
    const [, m1, d1] = monday.split('-').map(Number);
    const [, m2, d2] = days[6].split('-').map(Number);
    return m1 === m2
      ? `${d1} – ${d2} ${MONTHS_GEN[m2 - 1]}`
      : `${d1} ${MONTHS_GEN[m1 - 1]} – ${d2} ${MONTHS_GEN[m2 - 1]}`;
  });
  const isThisWeek = $derived(days.includes(zoned(new Date()).day));
  const go = (d: string) => goto(`/${slug}/panel/tydzien?d=${d}`, { noScroll: true });
</script>

<main class="week">
  <DayBar
    {title}
    isToday={isThisWeek}
    view="week"
    prev={() => go(addDays(monday, -7))}
    next={() => go(addDays(monday, 7))}
    prevLabel="Poprzedni tydzień"
    nextLabel="Następny tydzień"
    dayHref="/{slug}/panel?d={picked}"
    weekHref="/{slug}/panel/tydzien?d={picked}"
  />
  {#if cal}
    <div class="scroller">
      <div class="inner">
        <div class="heads">
          {#each days as d (d)}
            <a class="dh" class:today={d === zoned(new Date()).day} href="/{slug}/panel?d={d}">
              <span>{WEEKDAYS_SHORT[isoWeekday(d) - 1]}</span>
              <b>{Number(d.slice(8))}</b>
            </a>
          {/each}
        </div>
        <div class="grid" style:height="{(range.end - range.start) * PX + 16}px">
          <div class="hours">
            {#each Array.from({ length: range.end - range.start + 1 }, (_, i) => range.start + i) as h (h)}
              <span style:top="{(h - range.start) * PX}px">{h}:00</span>
            {/each}
          </div>
          {#each days as d (d)}
            <div class="col" style:height="{(range.end - range.start) * PX}px" data-testid="week-day">
              {#each cal.staff as s, i (s.id)}
                {@const c = personColor(s.color, i)}
                {@const w = 100 / cal.staff.length}
                {#each blocksOf(cal, s.id, d) as b (b.id)}
                  {@const a = Math.max(minOn(b.start, d), range.start * 60)}
                  {@const z = Math.min(minOn(b.end, d), range.end * 60)}
                  <div
                    class="it block"
                    title={b.reason}
                    style:left="{i * w}%"
                    style:width="{w}%"
                    style:top="{y(a)}px"
                    style:height="{y(z) - y(a)}px"
                  ></div>
                {/each}
                {#each visitsOf(cal, s.id, d) as v (v.id)}
                  {@const a = minOn(v.start, d)}
                  {@const z = minOn(v.end, d)}
                  <button
                    class="it"
                    class:pending={v.status === 'oczekuje'}
                    title="{v.clientName} · {v.serviceName}"
                    style:left="{i * w}%"
                    style:width="{w}%"
                    style:top="{y(a)}px"
                    style:height="{Math.max(y(z) - y(a), 14)}px"
                    style:background={v.status === 'oczekuje' ? '#FFFFFF' : c.bg}
                    style:color={c.ink}
                    style:border={v.status === 'oczekuje' ? `1.5px dashed ${c.dot}` : '0'}
                    onclick={() => (open = v)}
                  >
                    {v.clientName}
                  </button>
                {/each}
              {/each}
            </div>
          {/each}
        </div>
      </div>
    </div>
    <div class="legend">
      {#each cal.staff as s, i (s.id)}
        <span><i style:background={personColor(s.color, i).dot}></i>{s.name}</span>
      {/each}
    </div>
  {/if}
</main>

{#if open && cal}
  <VisitSheet
    {slug}
    {cal}
    visit={open}
    onclose={() => (open = null)}
    ondone={(m) => {
      open = null;
      showToast(m);
      load();
      refreshPending();
    }}
  />
{/if}

<style>
  .week {
    flex-grow: 1;
    min-width: 0;
    padding: 14px 16px 16px;
  }
  .scroller {
    overflow-x: auto;
  }
  .inner {
    min-width: 620px;
  }
  .heads {
    display: flex;
    margin-top: 10px;
    padding-left: 52px;
  }
  .dh {
    flex: 1 1 0;
    height: 52px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: var(--muted);
    text-decoration: none;
    font-size: 13px;
    font-weight: 600;
    border-radius: 12px;
  }
  .dh b {
    font-size: 18px;
    color: var(--ink);
  }
  .dh.today {
    background: var(--accent-soft);
    color: var(--accent);
  }
  .grid {
    position: relative;
    display: flex;
    margin-top: 6px;
  }
  .hours {
    width: 52px;
    flex-shrink: 0;
    position: relative;
  }
  .hours span {
    position: absolute;
    width: 44px;
    text-align: right;
    font-size: 12px;
    color: var(--muted);
    transform: translateY(-7px);
  }
  .col {
    flex: 1 1 0;
    min-width: 0;
    position: relative;
    margin: 0 2px;
    border-radius: 10px;
    background-color: var(--surface);
    background-image: repeating-linear-gradient(
      to bottom,
      var(--grid) 0,
      var(--grid) 1px,
      transparent 1px,
      transparent 48px
    );
  }
  .it {
    position: absolute;
    box-sizing: border-box;
    padding: 2px 4px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    text-align: left;
    border: 0;
    box-shadow: 0 0 0 1px #fff;
  }
  .it.block {
    background: var(--hatch);
  }
  .legend {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
    margin-top: 12px;
    font-size: 14px;
    font-weight: 600;
  }
  .legend span {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .legend i {
    width: 10px;
    height: 10px;
    border-radius: 5px;
  }
</style>
