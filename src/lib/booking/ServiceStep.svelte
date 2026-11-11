<script lang="ts">
  // Step 1: the service. A tap goes on.
  import { price } from '$lib/pl';
  import StepHeader from '$lib/ui/StepHeader.svelte';
  import { b, type PublicSalon, type PublicService } from './state.svelte';

  let { salon, services, next }: { salon: PublicSalon; services: PublicService[]; next: () => void } =
    $props();

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
  <h1 style="margin: 40px 0 8px">Co robimy?</h1>
  {#if salon.street || salon.city}
    <p class="lead">{[salon.street, salon.city].filter(Boolean).join(', ')}</p>
  {/if}
  <div class="picks" data-testid="services">
    {#each services as s (s.id)}
      <button type="button" class="pick" onclick={() => pick(s.id)}>
        <span class="name">{s.name}</span>
        <span class="side">{s.min} min{s.price !== null ? ` · ${price(s.price)}` : ''}</span>
      </button>
    {/each}
  </div>
</main>
