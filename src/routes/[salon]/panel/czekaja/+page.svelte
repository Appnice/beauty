<script lang="ts">
  // "Czekają na Ciebie" (Czekaja.dc.html): online bookings that wait; "Odrzuć" frees the time.
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import { personColor } from '$lib/colors';
  import { hm, MONTHS_SHORT, phoneLocal, WEEKDAYS_SHORT, isoWeekday, zoned } from '$lib/pl';
  import { panel, POLL_MS, refreshPending } from '$lib/panel/panel.svelte.ts';
  import Icon from '$lib/ui/Icon.svelte';
  import { showToast } from '$lib/ui/toast.svelte.ts';

  let { data } = $props();
  const slug = $derived(data.salon.slug);
  interface V {
    id: string;
    staff_id: string;
    starts_at: string;
    service_name: string;
    client_name: string;
    client_phone: string | null;
    staff_name: string;
  }
  let items = $state<V[]>([]);
  let staff = $state<{ id: string; color: string }[]>([]);
  let loaded = $state(false);

  async function load() {
    const [v, s] = await Promise.all([
      api<{ visits: V[] }>('GET', `/api/${slug}/pending`),
      api<{ staff: { id: string; color: string }[] }>('GET', `/api/${slug}/staff`)
    ]);
    if (v.ok) {
      items = v.data.visits.sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));
      panel.pending = items.length;
    }
    if (s.ok) staff = s.data.staff;
    loaded = true;
  }
  onMount(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  });

  function colorOf(id: string) {
    const i = staff.findIndex((s) => s.id === id);
    return personColor(staff[i]?.color, Math.max(i, 0));
  }

  async function decide(v: V, action: 'confirm' | 'cancel') {
    const r = await api('PATCH', `/api/${slug}/visits/${v.id}`, { action });
    if (!r.ok) return showToast(r.error, 'error');
    showToast(action === 'confirm' ? `Przyjęta: ${v.client_name}` : `Odrzucona: ${v.client_name}`);
    await load();
    refreshPending();
  }
</script>

<main class="wait">
  <h1>Czekają na Ciebie <span class="n">{items.length}</span></h1>

  <div class="list">
    {#each items as v (v.id)}
      {@const z = zoned(v.starts_at)}
      {@const c = colorOf(v.staff_id)}
      <div class="card" data-testid="pending-card">
        <div class="date">
          <span class="dow">{WEEKDAYS_SHORT[isoWeekday(z.day) - 1]}</span>
          <span class="dd">{Number(z.day.slice(8))}</span>
          <span class="mm">{MONTHS_SHORT[Number(z.day.slice(5, 7)) - 1]}</span>
        </div>
        <div class="body">
          <span class="what">{hm(z.min)} · {v.service_name}</span>
          <span class="who">{v.client_name} · {phoneLocal(v.client_phone)}</span>
          <span class="staff" style:color={c.ink}><i style:background={c.dot}></i>{v.staff_name}</span>
        </div>
        <div class="acts">
          <button class="b ghost" onclick={() => decide(v, 'cancel')}>Odrzuć</button>
          <button class="b" onclick={() => decide(v, 'confirm')}>
            <Icon name="check" size={18} stroke={2.6} /> Przyjmij
          </button>
        </div>
      </div>
    {:else}
      {#if loaded}<p class="muted empty">Nic nie czeka.</p>{/if}
    {/each}
  </div>
  {#if items.length}<p class="note">Klient dostanie SMS od razu.</p>{/if}
</main>

<style>
  .wait {
    padding: 28px 40px;
  }
  h1 {
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -0.01em;
  }
  .n {
    color: var(--muted);
    font-weight: 600;
  }
  .list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 24px;
    max-width: 760px;
  }
  .card {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 18px 18px 18px 20px;
    border: 1.5px solid var(--line-strong);
    border-radius: 18px;
    background: var(--surface);
  }
  .date {
    width: 64px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  .dow,
  .mm {
    font-size: 13px;
    color: var(--muted);
  }
  .dow {
    font-weight: 600;
  }
  .dd {
    font-size: 26px;
    font-weight: 700;
    line-height: 1.1;
  }
  .body {
    flex-grow: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .what {
    font-size: 18px;
    font-weight: 700;
  }
  .who {
    font-size: 15px;
    color: var(--muted);
  }
  .staff {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    font-weight: 600;
  }
  .staff i {
    width: 10px;
    height: 10px;
    border-radius: 5px;
  }
  .acts {
    display: flex;
    gap: 16px;
  }
  .b {
    height: 52px;
    padding: 0 22px;
    border: 0;
    border-radius: var(--radius);
    background: var(--accent);
    color: #fff;
    font-size: 16px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .b.ghost {
    padding: 0 20px;
    border: 1.5px solid var(--line-strong);
    background: var(--surface);
    color: var(--ink);
  }
  .note {
    margin-top: 20px;
    font-size: 15px;
    color: var(--muted);
  }
  .empty {
    font-size: 16px;
  }
  @media (max-width: 700px) {
    .wait {
      padding: 20px 16px;
    }
    .card {
      flex-wrap: wrap;
    }
    .acts {
      width: 100%;
    }
    .acts .b {
      flex: 1 1 0;
      justify-content: center;
    }
  }
</style>
