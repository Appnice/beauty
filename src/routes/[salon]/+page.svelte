<script lang="ts">
  // The client booking page: one choice per screen, the step in ?krok=<name> (the phone's Back works).
  // A pending salon shows only its name and "Zapisy online wkrótce".
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { allowed, b, load, save, STEPS, type Step } from '$lib/booking/state.svelte';
  import ServiceStep from '$lib/booking/ServiceStep.svelte';
  import PersonStep from '$lib/booking/PersonStep.svelte';
  import TimeStep from '$lib/booking/TimeStep.svelte';
  import DetailsStep from '$lib/booking/DetailsStep.svelte';
  import CodeStep from '$lib/booking/CodeStep.svelte';
  import DoneStep from '$lib/booking/DoneStep.svelte';

  let { data } = $props();
  const slug = $derived(data.salon.slug);
  let ready = $state(false);

  onMount(() => {
    load(slug);
    // "Zarezerwuj ponownie" from the visit page: ?usluga=<id>&osoba=<id|obojetnie>
    const q = page.url.searchParams;
    const svc = q.get('usluga');
    if (svc && data.services.some((s) => s.id === svc)) {
      b.done = null;
      b.serviceId = svc;
      b.start = '';
      b.taken = false;
      const who = q.get('osoba');
      const person = data.staff.find((p) => p.id === who && p.services.includes(svc));
      b.staffChosen = !!who && (who === 'obojetnie' || !!person);
      b.staffId = person?.id ?? null;
      goto(`/${slug}?krok=${b.staffChosen ? 'termin' : 'osoba'}`, { replaceState: true });
    }
    ready = true;
  });

  $effect(() => {
    if (!ready) return;
    JSON.stringify(b);
    save(slug);
  });

  const asked = $derived((page.url.searchParams.get('krok') ?? 'usluga') as Step);
  const step = $derived(ready ? allowed(STEPS.includes(asked) ? asked : 'usluga') : 'usluga');
  const service = $derived(data.services.find((s) => s.id === b.serviceId));
  const person = $derived(data.staff.find((p) => p.id === b.staffId) ?? null);

  const to = (s: Step, replace = false) => goto(`/${slug}?krok=${s}`, { replaceState: replace });
  const back = () => history.back();
  const done = () => to('gotowe', true);
  const taken = () => to('termin', true);
  function again() {
    b.done = null;
    b.start = '';
    to('usluga');
  }
</script>

<svelte:head>
  <title>{data.salon.name}</title>
  {#if !data.online}<meta name="robots" content="noindex" />{/if}
</svelte:head>

{#if !data.online}
  <main class="wiz">
    <h1 style="margin: 40px 0 8px">{data.salon.name}</h1>
    <p class="lead">Zapisy online wkrótce</p>
  </main>
{:else if step === 'usluga' || !service}
  <ServiceStep salon={data.salon} services={data.services} next={() => to('osoba')} />
{:else if step === 'osoba'}
  <PersonStep {service} staff={data.staff} next={() => to('termin')} {back} />
{:else if step === 'termin'}
  {#key `${b.serviceId}|${b.staffId}`}
    <TimeStep {slug} {service} {person} next={() => to('dane')} {back} />
  {/key}
{:else if step === 'dane'}
  <DetailsStep
    {slug}
    {service}
    staffName={person?.name ?? 'Obojętnie'}
    next={() => to('kod')}
    {done}
    {taken}
    {back}
  />
{:else if step === 'kod'}
  <CodeStep {slug} staffName={person?.name ?? ''} {done} {taken} {back} />
{:else}
  <DoneStep {slug} {service} {again} />
{/if}
