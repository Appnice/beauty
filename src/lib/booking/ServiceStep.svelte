<script lang="ts">
  // Step 1: the service. A tap goes on.
  import { page } from '$app/state';
  import { i18n } from '$lib/i18n';
  import LangSwitch from '$lib/ui/LangSwitch.svelte';
  import StepHeader from '$lib/ui/StepHeader.svelte';
  import { b, type PublicSalon, type PublicService } from './state.svelte';

  let { salon, services, next }: { salon: PublicSalon; services: PublicService[]; next: () => void } =
    $props();
  const L = $derived(i18n(page.data.lang));

  function pick(id: string) {
    if (b.serviceId !== id) {
      b.staffId = null;
      b.staffChosen = false;
      b.start = '';
    }
    b.serviceId = id;
    next();
  }
</script>

<main class="wiz">
  <StepHeader step={1} total={5} brand={salon.name} />
  <h1 style="margin: 40px 0 8px">{L.t.booking.service.title}</h1>
  {#if salon.street || salon.city}
    <p class="lead">{[salon.street, salon.city].filter(Boolean).join(', ')}</p>
  {/if}
  <div class="picks" data-testid="services">
    {#each services as s (s.id)}
      <button type="button" class="pick" onclick={() => pick(s.id)}>
        <span class="name">{s.name}</span>
        <span class="side"
          >{L.t.booking.service.duration(s.min)}{s.price !== null ? ` · ${L.price(s.price)}` : ''}</span
        >
      </button>
    {/each}
  </div>
  <div class="grow"></div>
  <div class="langs"><LangSwitch /></div>
</main>

<style>
  .langs {
    display: flex;
    justify-content: center;
  }
</style>
