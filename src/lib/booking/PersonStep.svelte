<script lang="ts">
  // Step 2: who, or "Obojętnie" (the first free person).
  import { personColor } from '$lib/colors';
  import Avatar from '$lib/ui/Avatar.svelte';
  import Icon from '$lib/ui/Icon.svelte';
  import StepHeader from '$lib/ui/StepHeader.svelte';
  import { b, type PublicPerson, type PublicService } from './state.svelte';

  let {
    service,
    staff,
    next,
    back
  }: { service: PublicService; staff: PublicPerson[]; next: () => void; back: () => void } = $props();
  const people = $derived(staff.filter((p) => p.services.includes(service.id)));

  function pick(id: string | null) {
    if (b.staffId !== id) b.start = '';
    b.staffId = id;
    b.staffChosen = true;
    next();
  }
</script>

<main class="wiz">
  <StepHeader step={2} total={5} onback={back} />
  <h1 style="margin: 40px 0 8px">Do kogo?</h1>
  <p class="lead">{service.name}</p>
  <div class="picks">
    <button type="button" class="pick" onclick={() => pick(null)}>
      <span class="any"><Icon name="team" size={18} /></span>
      <span class="name">Obojętnie</span>
    </button>
    {#each people as p, i (p.id)}
      {@const c = personColor(p.color, i)}
      <button type="button" class="pick" onclick={() => pick(p.id)}>
        <Avatar name={p.name} bg={c.bg} ink={c.avatarInk} size={36} />
        <span class="name">{p.name}</span>
      </button>
    {/each}
  </div>
</main>

<style>
  .any {
    width: 36px;
    height: 36px;
    border-radius: 18px;
    background: var(--accent-soft);
    color: var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
</style>
