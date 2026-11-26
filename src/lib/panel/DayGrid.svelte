<script lang="ts">
  // The day calendar (Kalendarz.dc.html): one column per person in the person's colour, 64 px per hour.
  // Tap a free time: "+ Dodaj wizytę". Drag a visit to another time or person (pointer events).
  import { page } from '$app/state';
  import { personColor } from '$lib/colors';
  import { i18n } from '$lib/i18n';
  import { hm, isoWeekday, zoned } from '$lib/pl';
  import Avatar from '$lib/ui/Avatar.svelte';
  import { blocksOf, dayRange, HOUR_PX, isFree, minOn, timeRange, visitsOf } from './layout';
  import type { Calendar, PVisit } from './types';

  let {
    cal,
    day,
    nowMin = null,
    canEdit = true,
    selecting = false,
    onfree,
    onopen,
    onmove
  }: {
    cal: Calendar;
    day: string;
    nowMin?: number | null;
    canEdit?: boolean;
    /** The new-visit sheet is open: the chosen free time stays marked under it. */
    selecting?: boolean;
    onfree: (staffId: string, min: number) => void;
    onopen: (v: PVisit) => void;
    onmove: (v: PVisit, staffId: string, min: number) => void;
  } = $props();

  const L = $derived(i18n(page.data.lang));
  const range = $derived(dayRange(cal, day));
  const colH = $derived((range.end - range.start) * HOUR_PX);
  const y = (min: number) => ((min - range.start * 60) / 60) * HOUR_PX;
  const hours = $derived(Array.from({ length: range.end - range.start + 1 }, (_, i) => range.start + i));

  let free = $state<{ staffId: string; min: number; dur: number } | null>(null);
  $effect(() => {
    void day;
    free = null;
  });
  let wasSelecting = false;
  $effect(() => {
    if (wasSelecting && !selecting) free = null;
    wasSelecting = selecting;
  });

  function durFor(staffId: string): number {
    const s = cal.staff.find((x) => x.id === staffId);
    const svc = cal.services.find((x) => s?.services.includes(x.id)) ?? cal.services[0];
    return svc?.durationMin ?? 60;
  }

  function tapColumn(e: MouseEvent, staffId: string) {
    if (!canEdit || drag?.moved) return;
    const box = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const min = range.start * 60 + Math.floor((((e.clientY - box.top) / HOUR_PX) * 60) / 30) * 30;
    const dur = durFor(staffId);
    const end = Math.min(min + dur, range.end * 60);
    free = isFree(cal, staffId, day, min, end) ? { staffId, min, dur: end - min } : null;
  }

  function headCount(staffId: string): string {
    const off = blocksOf(cal, staffId, day).find(
      (b) =>
        /urlop/i.test(b.reason) &&
        minOn(b.start, day) <= range.start * 60 &&
        minOn(b.end, day) >= range.end * 60
    );
    if (off) return L.t.panel.day.onLeave;
    return L.t.panel.day.visits(visitsOf(cal, staffId, day).length);
  }

  function blockSub(end: string): string {
    const last = zoned(new Date(Date.parse(end) - 1)).day;
    return last > day ? L.t.panel.day.until(L.weekdaysUntil[isoWeekday(last) - 1]) : '';
  }

  // ---------- drag and drop ----------
  let drag = $state<{
    v: PVisit;
    x0: number;
    y0: number;
    dx: number;
    dy: number;
    moved: boolean;
    over: string;
  } | null>(null);

  function down(e: PointerEvent, v: PVisit) {
    e.stopPropagation();
    if (e.button !== 0) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag = { v, x0: e.clientX, y0: e.clientY, dx: 0, dy: 0, moved: false, over: v.staffId };
  }

  function move(e: PointerEvent) {
    if (!drag) return;
    drag.dx = e.clientX - drag.x0;
    drag.dy = e.clientY - drag.y0;
    if (Math.abs(drag.dx) + Math.abs(drag.dy) > 6) drag.moved = canEdit;
    const col = document
      .elementsFromPoint(e.clientX, e.clientY)
      .find((el) => (el as HTMLElement).dataset?.col) as HTMLElement | undefined;
    if (col) drag.over = col.dataset.col!;
  }

  function up() {
    const d = drag;
    if (!d) return;
    setTimeout(() => (drag = null));
    if (!d.moved) return onopen(d.v);
    const start = minOn(d.v.start, day);
    const min = Math.max(range.start * 60, Math.round((start + (d.dy / HOUR_PX) * 60) / 15) * 15);
    if (min === start && d.over === d.v.staffId) return;
    onmove(d.v, d.over, min);
  }
</script>

<div class="scroller">
  <div class="inner" style:min-width="{52 + cal.staff.length * 146}px">
    <div class="heads">
      {#each cal.staff as s, i (s.id)}
        {@const c = personColor(s.color, i)}
        <div class="head" data-testid="col-head">
          <Avatar name={s.name} bg={c.bg} ink={c.ink} size={28} />
          <span class="hname">{s.name}</span>
          <span class="hcount">{headCount(s.id)}</span>
        </div>
      {/each}
    </div>

    <div class="grid" style:height="{colH + 24}px">
      <div class="hours">
        {#each hours as h (h)}
          <span style:top="{(h - range.start) * HOUR_PX}px">{h}:00</span>
        {/each}
      </div>
      {#each cal.staff as s, i (s.id)}
        {@const c = personColor(s.color, i)}
        <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
        <div
          class="col"
          class:over={drag?.moved && drag.over === s.id}
          data-col={s.id}
          data-testid="col-{s.name}"
          style:height="{colH}px"
          onclick={(e) => tapColumn(e, s.id)}
        >
          {#each blocksOf(cal, s.id, day) as b (b.id)}
            {@const a = Math.max(minOn(b.start, day), range.start * 60)}
            {@const z = Math.min(minOn(b.end, day), range.end * 60)}
            <div
              class="item block"
              style:top="{y(a) + 1}px"
              style:height="{y(z) - y(a) - 2}px"
              data-testid="block"
            >
              <span class="t">{timeRange(a, z)}</span>
              <span class="title">{L.t.panel.block.kind(b.reason) || L.t.panel.block.fallback}</span>
              <span class="sub">{blockSub(b.end)}</span>
            </div>
          {/each}
          {#each visitsOf(cal, s.id, day) as v (v.id)}
            {@const a = minOn(v.start, day)}
            {@const z = minOn(v.end, day)}
            {@const dragging = drag?.moved && drag.v.id === v.id}
            <button
              type="button"
              class="item visit"
              class:pending={v.status === 'oczekuje'}
              class:dragging
              data-testid="visit"
              data-visit={v.id}
              data-source={v.source}
              style:top="{y(a) + 1}px"
              style:height="{Math.max(y(z) - y(a) - 2, 18)}px"
              style:background={v.status === 'oczekuje' ? '#FFFFFF' : c.bg}
              style:color={c.ink}
              style:border={v.status === 'oczekuje' ? `1.5px dashed ${c.dot}` : '0'}
              style:transform={dragging ? `translate(${drag!.dx}px, ${drag!.dy}px)` : undefined}
              onpointerdown={(e) => down(e, v)}
              onpointermove={move}
              onpointerup={up}
              onpointercancel={() => (drag = null)}
              onclick={(e) => e.stopPropagation()}
            >
              <span class="t">{timeRange(a, z)}</span>
              <span class="title">{L.t.panel.client(v.clientName)}</span>
              <span class="sub">{v.status === 'oczekuje' ? L.t.panel.day.waitingForYou : v.serviceName}</span>
            </button>
          {/each}
          {#if free && free.staffId === s.id}
            <button
              type="button"
              class="item free"
              data-testid="free"
              style:top="{y(free.min) + 1}px"
              style:height="{y(free.min + free.dur) - y(free.min) - 2}px"
              onclick={(e) => {
                e.stopPropagation();
                onfree(s.id, free!.min);
              }}
            >
              <span class="t"></span>
              <span class="title">{L.t.panel.day.addVisit}</span>
              <span class="sub">{hm(free.min)}</span>
            </button>
          {/if}
        </div>
      {/each}
      {#if nowMin !== null && nowMin >= range.start * 60 && nowMin <= range.end * 60}
        <div class="now" aria-hidden="true" style:top="{y(nowMin)}px"><span></span></div>
      {/if}
    </div>
  </div>
</div>

<style>
  .scroller {
    overflow-x: auto;
    overflow-y: visible;
    margin: 0 -4px;
    padding: 0 4px;
  }
  .heads {
    display: flex;
    margin-top: 10px;
    padding-left: 52px;
  }
  .head {
    flex: 1 1 0;
    min-width: 0;
    height: 44px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 10px;
  }
  .hname {
    font-size: 15px;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .hcount {
    font-size: 13px;
    color: var(--muted);
    white-space: nowrap;
  }
  .grid {
    position: relative;
    display: flex;
  }
  .hours {
    width: 52px;
    flex-shrink: 0;
    position: relative;
  }
  .hours span {
    position: absolute;
    left: 0;
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
    margin: 0 3px;
    border-radius: 12px;
    background-color: var(--surface);
    background-image: repeating-linear-gradient(
      to bottom,
      var(--grid) 0,
      var(--grid) 1px,
      transparent 1px,
      transparent 64px
    );
    touch-action: pan-y;
  }
  .col.over {
    outline: 2px solid var(--accent-soft);
  }
  .item {
    position: absolute;
    left: 4px;
    right: 4px;
    padding: 6px 10px;
    border-radius: 10px;
    overflow: hidden;
    display: flex;
    flex-direction: column;
    gap: 1px;
    text-align: left;
    font: inherit;
  }
  .visit {
    cursor: grab;
    touch-action: none;
    user-select: none;
  }
  .visit.dragging {
    z-index: 5;
    cursor: grabbing;
    box-shadow: 0 8px 20px rgba(34, 28, 25, 0.2);
    opacity: 0.92;
  }
  .block {
    background: var(--hatch);
    color: var(--muted);
    pointer-events: none;
  }
  .free {
    background: transparent;
    color: var(--accent);
    border: 1.5px dashed var(--accent);
  }
  .t {
    font-size: 12px;
    font-weight: 600;
    opacity: 0.85;
  }
  .title {
    font-size: 14px;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .sub {
    font-size: 13px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .now {
    position: absolute;
    left: 46px;
    right: 0;
    height: 2px;
    background: var(--accent);
    pointer-events: none;
  }
  .now span {
    position: absolute;
    left: -5px;
    top: -4px;
    width: 10px;
    height: 10px;
    border-radius: 5px;
    background: var(--accent);
  }
</style>
