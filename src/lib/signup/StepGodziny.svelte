<script lang="ts">
  // Step 6 (Godziny.dc.html): opening hours; the button sends the salon for approval and creates it.
  import { api } from '$lib/api';
  import HoursRow from '$lib/ui/HoursRow.svelte';
  import StepHeader from '$lib/ui/StepHeader.svelte';
  import { w } from './state.svelte';

  let {
    done,
    back,
    goto,
    approval
  }: { done: () => void; back: () => void; goto: (step: number) => void; approval: boolean } = $props();
  let error = $state('');
  let busy = $state(false);

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    error = '';
    const openingHours = w.hours
      .filter((d) => d.open)
      .map((d) => ({ weekday: d.weekday, opens: d.opens, closes: d.closes }));
    if (openingHours.length === 0) return void (error = 'Salon musi być otwarty co najmniej jeden dzień.');
    if (w.password.length < 8) {
      error = 'Wpisz hasło jeszcze raz.';
      return goto(1);
    }
    busy = true;
    const r = await api<{ salon: { slug: string; name: string; status: string } }>('POST', '/api/signup', {
      code: w.invite || undefined,
      website: w.website,
      phoneToken: w.phoneToken,
      name: w.name.trim(),
      slug: w.slug,
      password: w.password,
      city: w.city,
      street: w.street,
      teamSize: w.teamSize,
      link: w.link,
      about: w.about,
      team: w.team,
      services: w.services.filter((s) => s.on).map((s) => ({ name: s.name, durationMin: s.min })),
      openingHours
    });
    busy = false;
    if (!r.ok) {
      error = r.error;
      if (r.data && (r.data as { error?: { code?: string } }).error?.code === 'BAD_CODE') goto(2);
      return;
    }
    w.done = r.data.salon;
    done();
  }
</script>

<form class="wiz" onsubmit={submit} novalidate>
  <StepHeader step={6} onback={back} />
  <h1 style="margin: 32px 0 6px">Kiedy otwarte?</h1>
  <p class="lead">Stuknij godzinę, żeby zmienić.</p>

  <div class="days">
    {#each w.hours as d (d.weekday)}
      <HoursRow weekday={d.weekday} bind:open={d.open} bind:opens={d.opens} bind:closes={d.closes} />
    {/each}
  </div>

  <div class="grow"></div>
  {#if error}<p class="error msg" role="alert">{error}</p>{/if}
  <button class="btn" disabled={busy}>{approval ? 'Wyślij do akceptacji' : 'Gotowe'}</button>
</form>

<style>
  .days {
    display: flex;
    flex-direction: column;
    margin-top: 20px;
    border: 1.5px solid var(--line-strong);
    border-radius: 16px;
    background: var(--surface);
    overflow: hidden;
  }
</style>
