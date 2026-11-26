<script lang="ts">
  // The bar over the calendar: arrows, the day, "Dziś", Dzień / Tydzień, "+ Wizyta".
  import { page } from '$app/state';
  import { i18n } from '$lib/i18n';
  import Icon from '$lib/ui/Icon.svelte';
  let {
    title,
    isToday,
    view,
    prev,
    next,
    dayHref,
    weekHref,
    onadd,
    prevLabel,
    nextLabel
  }: {
    title: string;
    isToday: boolean;
    view: 'day' | 'week';
    prev: () => void;
    next: () => void;
    dayHref: string;
    weekHref: string;
    onadd?: () => void;
    prevLabel?: string;
    nextLabel?: string;
  } = $props();
  const t = $derived(i18n(page.data.lang).t.panel.bar);
</script>

<div class="bar">
  <div class="nav">
    <button class="icon-btn boxed" aria-label={prevLabel ?? t.prevDay} onclick={prev}
      ><Icon name="back" size={20} /></button
    >
    <button class="icon-btn boxed" aria-label={nextLabel ?? t.nextDay} onclick={next}
      ><Icon name="forward" size={20} /></button
    >
    <h1>{title}</h1>
    {#if isToday}<span class="today">{t.today}</span>{/if}
  </div>
  <div class="grow"></div>
  <div class="tools">
    <div role="group" aria-label={t.view} class="seg">
      <a href={dayHref} class:on={view === 'day'}>{t.day}</a>
      <a href={weekHref} class:on={view === 'week'}>{t.week}</a>
    </div>
    {#if onadd}
      <button class="add" onclick={onadd}><Icon name="plus" size={18} stroke={2.4} /> {t.add}</button>
    {/if}
  </div>
</div>

<style>
  .bar {
    min-height: 56px;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .nav,
  .tools {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 0;
  }
  .icon-btn.boxed {
    border-radius: 12px;
  }
  h1 {
    margin-left: 8px;
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.01em;
    white-space: nowrap;
  }
  .today {
    height: 28px;
    padding: 0 10px;
    border-radius: 8px;
    background: var(--accent-soft);
    color: var(--accent);
    font-size: 13px;
    font-weight: 700;
    display: flex;
    align-items: center;
  }
  .grow {
    flex-grow: 1;
  }
  .seg {
    height: 44px;
    display: flex;
    padding: 3px;
    border-radius: 12px;
    background: var(--seg);
  }
  .seg a {
    height: 38px;
    padding: 0 16px;
    border-radius: 9px;
    color: var(--muted);
    font-size: 15px;
    font-weight: 600;
    display: flex;
    align-items: center;
    text-decoration: none;
  }
  .seg a.on {
    background: var(--surface);
    color: var(--ink);
    box-shadow: 0 1px 2px rgba(34, 28, 25, 0.12);
  }
  .add {
    height: 44px;
    padding: 0 18px;
    border: 0;
    border-radius: 12px;
    background: var(--accent);
    color: #fff;
    font-size: 16px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  @media (max-width: 700px) {
    h1 {
      font-size: 19px;
    }
    .tools {
      width: 100%;
      justify-content: space-between;
    }
  }
</style>
