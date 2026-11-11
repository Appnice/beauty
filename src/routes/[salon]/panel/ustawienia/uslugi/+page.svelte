<script lang="ts">
  // Usługi: name, minutes, remove; add one at the bottom.
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import SubHeader from '$lib/panel/SubHeader.svelte';
  import Icon from '$lib/ui/Icon.svelte';
  import { showToast } from '$lib/ui/toast.svelte.ts';

  let { data } = $props();
  const slug = $derived(data.salon.slug);
  interface S {
    id: string;
    name: string;
    duration_min: number;
    active: boolean;
  }
  let list = $state<S[]>([]);
  let name = $state('');
  const MINS = [15, 20, 30, 45, 60, 75, 90, 105, 120, 150, 180, 240];

  async function load() {
    const r = await api<{ services: S[] }>('GET', `/api/${slug}/services`);
    if (r.ok) list = r.data.services.filter((s) => s.active);
  }
  onMount(load);

  async function patch(s: S, body: Record<string, unknown>, msg = 'Zapisano') {
    const r = await api('PATCH', `/api/${slug}/services/${s.id}`, body);
    if (!r.ok) return showToast(r.error, 'error');
    showToast(msg);
    load();
  }
  async function add(e: SubmitEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const r = await api('POST', `/api/${slug}/services`, {
      name: name.trim(),
      durationMin: 60,
      sort: list.length
    });
    if (!r.ok) return showToast(r.error, 'error');
    name = '';
    load();
  }
</script>

<main class="page">
  <SubHeader {slug} title="Usługi" />
  <div class="rows">
    {#each list as s (s.id)}
      <div class="rowbox" data-testid="service-row">
        <input
          class="plain"
          aria-label="Nazwa usługi"
          value={s.name}
          onchange={(e) => patch(s, { name: e.currentTarget.value })}
        />
        <select
          class="plain"
          aria-label="Czas"
          value={s.duration_min}
          onchange={(e) => patch(s, { durationMin: Number(e.currentTarget.value) })}
        >
          {#each MINS.includes(s.duration_min) ? MINS : [...MINS, s.duration_min].sort((a, b) => a - b) as m (m)}
            <option value={m}>{m} min</option>
          {/each}
        </select>
        <button
          class="icon-btn"
          aria-label="Usuń: {s.name}"
          onclick={() => patch(s, { active: false }, 'Usunięto')}
        >
          <Icon name="close" size={20} color="#9A918A" />
        </button>
      </div>
    {/each}
    <form class="rowbox new" onsubmit={add}>
      <input class="plain" aria-label="Nowa usługa" placeholder="Nowa usługa" bind:value={name} />
      <button class="soft-btn">Dodaj</button>
    </form>
  </div>
</main>
