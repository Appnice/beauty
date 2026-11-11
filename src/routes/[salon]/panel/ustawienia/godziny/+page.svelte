<script lang="ts">
  // Godziny otwarcia of the salon, and the weekly hours of one person.
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import { today } from '$lib/pl';
  import SubHeader from '$lib/panel/SubHeader.svelte';
  import type { Calendar } from '$lib/panel/types';
  import HoursRow from '$lib/ui/HoursRow.svelte';
  import { showToast } from '$lib/ui/toast.svelte.ts';

  let { data } = $props();
  const slug = $derived(data.salon.slug);
  type Day = { weekday: number; open: boolean; opens: string; closes: string };
  let cal = $state<Calendar | null>(null);
  let who = $state(''); // '' = the salon
  let days = $state<Day[]>([]);

  function fill() {
    if (!cal) return;
    days = [1, 2, 3, 4, 5, 6, 7].map((weekday) => {
      const h = who
        ? cal!.schedules
            .filter((s) => s.staffId === who && s.weekday === weekday)
            .map((s) => ({ opens: s.starts, closes: s.ends }))[0]
        : cal!.hours.find((x) => x.weekday === weekday);
      return { weekday, open: !!h, opens: h?.opens ?? '09:00', closes: h?.closes ?? '18:00' };
    });
  }
  async function load() {
    const r = await api<Calendar>('GET', `/api/${slug}/calendar?date=${today()}&days=1`);
    if (r.ok) cal = r.data;
    fill();
  }
  onMount(load);

  async function save() {
    const on = days.filter((d) => d.open);
    const r = who
      ? await api(
          'PUT',
          `/api/${slug}/staff/${who}/schedule`,
          on.map((d) => ({ weekday: d.weekday, starts: d.opens, ends: d.closes }))
        )
      : await api(
          'PUT',
          `/api/${slug}/hours`,
          on.map((d) => ({ weekday: d.weekday, opens: d.opens, closes: d.closes }))
        );
    if (!r.ok) return showToast(r.error, 'error');
    showToast('Zapisano');
    load();
  }
</script>

<main class="page">
  <SubHeader {slug} title="Godziny otwarcia" />
  <div class="chips" role="radiogroup" aria-label="Czyje godziny" style="margin-top: 20px">
    <button
      role="radio"
      aria-checked={who === ''}
      class="chip"
      class:on={who === ''}
      onclick={() => ((who = ''), fill())}>Salon</button
    >
    {#each cal?.staff ?? [] as s (s.id)}
      <button
        role="radio"
        aria-checked={who === s.id}
        class="chip"
        class:on={who === s.id}
        onclick={() => ((who = s.id), fill())}>{s.name}</button
      >
    {/each}
  </div>
  <div class="days">
    {#each days as d (d.weekday)}
      <HoursRow weekday={d.weekday} bind:open={d.open} bind:opens={d.opens} bind:closes={d.closes} />
    {/each}
  </div>
  <button class="btn" style="margin-top: 20px; max-width: 420px" onclick={save}>Zapisz</button>
</main>

<style>
  .days {
    max-width: 520px;
    display: flex;
    flex-direction: column;
    margin-top: 16px;
    border: 1.5px solid var(--line-strong);
    border-radius: 16px;
    background: var(--surface);
    overflow: hidden;
  }
</style>
