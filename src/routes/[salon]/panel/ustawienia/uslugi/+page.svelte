<script lang="ts">
  // Usługi: name, minutes, remove; add one at the bottom.
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { api } from '$lib/api';
  import { i18n } from '$lib/i18n';
  import SubHeader from '$lib/panel/SubHeader.svelte';
  import Icon from '$lib/ui/Icon.svelte';
  import { showToast } from '$lib/ui/toast.svelte.ts';

  let { data } = $props();
  const L = $derived(i18n(page.data.lang));
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

  async function patch(s: S, body: Record<string, unknown>, msg?: string) {
    const r = await api('PATCH', `/api/${slug}/services/${s.id}`, body);
    if (!r.ok) return showToast(r.error, 'error');
    showToast(msg ?? L.t.settings.services.saved);
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
  <SubHeader {slug} title={L.t.settings.services.title} />
  <div class="rows">
    {#each list as s (s.id)}
      <div class="rowbox" data-testid="service-row">
        <input
          class="plain"
          aria-label={L.t.settings.services.nameLabel}
          value={s.name}
          onchange={(e) => patch(s, { name: e.currentTarget.value })}
        />
        <select
          class="plain"
          aria-label={L.t.settings.services.duration}
          value={s.duration_min}
          onchange={(e) => patch(s, { durationMin: Number(e.currentTarget.value) })}
        >
          {#each MINS.includes(s.duration_min) ? MINS : [...MINS, s.duration_min].sort((a, b) => a - b) as m (m)}
            <option value={m}>{m} min</option>
          {/each}
        </select>
        <button
          class="icon-btn"
          aria-label={L.t.settings.services.remove(s.name)}
          onclick={() => patch(s, { active: false }, L.t.settings.services.removed)}
        >
          <Icon name="close" size={20} color="#9A918A" />
        </button>
      </div>
    {/each}
    <form class="rowbox new" onsubmit={add}>
      <input
        class="plain"
        aria-label={L.t.settings.services.newService}
        placeholder={L.t.settings.services.newService}
        bind:value={name}
      />
      <button class="soft-btn">{L.t.settings.services.add}</button>
    </form>
  </div>
</main>
