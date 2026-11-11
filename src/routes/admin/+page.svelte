<script lang="ts">
  // Platform admin (Admin.dc.html): new salons with every "O salonie" field; "Odrzuć" / "Akceptuj".
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import { phoneLocal, whenLabel } from '$lib/pl';
  import Icon from '$lib/ui/Icon.svelte';
  import { showToast } from '$lib/ui/toast.svelte.ts';

  type Status = 'pending' | 'active' | 'rejected';
  interface S {
    id: string;
    slug: string;
    name: string;
    city: string;
    street: string;
    about: string;
    team_size: string | null;
    phone: string | null;
    link: string;
    reject_reason: string;
    submitted_at: string;
    decided_at: string | null;
  }
  let status = $state<Status>('pending');
  let salons = $state<S[]>([]);
  let counts = $state<Record<Status, number>>({ pending: 0, active: 0, rejected: 0 });
  let rejecting = $state<string | null>(null);
  let reason = $state('');
  let loaded = $state(false);

  async function refresh() {
    const r = await api<{ salons: S[]; counts: Record<Status, number> }>(
      'GET',
      `/api/admin/salons?status=${status}`
    );
    if (r.status === 401) return void (location.href = '/admin/login');
    if (!r.ok) return showToast(r.error, 'error');
    salons = r.data.salons;
    counts = r.data.counts;
    loaded = true;
  }
  onMount(refresh);

  function show(s: Status) {
    status = s;
    rejecting = null;
    refresh();
  }

  async function decide(s: S, action: 'accept' | 'reject') {
    const r = await api('POST', `/api/admin/salons/${s.id}`, { action, reason: reason.trim() || undefined });
    if (!r.ok) return showToast(r.error, 'error');
    rejecting = null;
    reason = '';
    showToast(action === 'accept' ? `Przyjęty: ${s.name}` : `Odrzucony: ${s.name}`);
    refresh();
  }

  const href = (l: string) =>
    l.startsWith('@') ? `https://instagram.com/${l.slice(1)}` : /^https?:\/\//i.test(l) ? l : `https://${l}`;
</script>

<svelte:head>
  <title>Nowe salony</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main class="admin">
  <div class="head">
    <h1>Nowe salony <span class="n">{counts.pending}</span></h1>
    <div class="grow"></div>
    <div role="group" aria-label="Filtr" class="seg">
      <button class:on={status === 'pending'} onclick={() => show('pending')}>Czekają</button>
      <button class:on={status === 'active'} onclick={() => show('active')}>Przyjęte · {counts.active}</button
      >
      <button class:on={status === 'rejected'} onclick={() => show('rejected')}>
        Odrzucone · {counts.rejected}
      </button>
    </div>
  </div>

  <div class="list">
    {#each salons as s (s.id)}
      <div class="card" data-testid="salon-card">
        <div class="body">
          <div class="title">
            <span class="name">{s.name}</span>
            <span class="where">{s.city}{s.street ? ` · ${s.street}` : ''}</span>
          </div>
          <span class="about">{s.about}</span>
          <div class="meta">
            <span>{s.team_size} os.</span>
            <span>{phoneLocal(s.phone)}</span>
            {#if s.link}<a href={href(s.link)} target="_blank" rel="noopener noreferrer nofollow">{s.link}</a
              >{/if}
            <span>{whenLabel(s.submitted_at)}</span>
            {#if status !== 'pending' && s.reject_reason}<span>Powód: {s.reject_reason}</span>{/if}
          </div>
          {#if rejecting === s.id}
            <div class="why">
              <!-- svelte-ignore a11y_autofocus -->
              <input class="input" placeholder="Powód (można pominąć)" bind:value={reason} autofocus />
              <button class="btn small secondary" onclick={() => (rejecting = null)}>Anuluj</button>
              <button class="btn small" onclick={() => decide(s, 'reject')}>Odrzuć salon</button>
            </div>
          {/if}
        </div>
        {#if status === 'pending' && rejecting !== s.id}
          <button class="b2 ghost" onclick={() => ((rejecting = s.id), (reason = ''))}>Odrzuć</button>
          <button class="b2" onclick={() => decide(s, 'accept')}>
            <Icon name="check" size={18} stroke={2.6} />
            Akceptuj
          </button>
        {/if}
      </div>
    {:else}
      {#if loaded}<p class="muted empty">Nic tu nie ma.</p>{/if}
    {/each}
  </div>
</main>

<style>
  .admin {
    max-width: 1280px;
    margin: 0 auto;
    padding: 32px 48px;
  }
  .head {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
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
  .seg button {
    height: 38px;
    padding: 0 16px;
    border: 0;
    border-radius: 9px;
    background: transparent;
    color: var(--muted);
    font-size: 15px;
    font-weight: 600;
  }
  .seg button.on {
    background: var(--surface);
    color: var(--ink);
    box-shadow: 0 1px 2px rgba(34, 28, 25, 0.12);
  }
  .list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 24px;
  }
  .card {
    display: flex;
    align-items: center;
    gap: 24px;
    padding: 20px 20px 20px 24px;
    border: 1.5px solid var(--line-strong);
    border-radius: 18px;
    background: var(--surface);
  }
  .body {
    flex-grow: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .title {
    display: flex;
    align-items: baseline;
    gap: 10px;
    flex-wrap: wrap;
  }
  .name {
    font-size: 20px;
    font-weight: 700;
  }
  .where {
    font-size: 15px;
    color: var(--muted);
  }
  .about {
    font-size: 15px;
    overflow-wrap: anywhere;
  }
  .meta {
    display: flex;
    gap: 16px;
    flex-wrap: wrap;
    font-size: 14px;
    color: var(--muted);
  }
  .meta a {
    font-weight: 600;
    overflow-wrap: anywhere;
  }
  .why {
    display: flex;
    gap: 8px;
    margin-top: 8px;
  }
  .why .input {
    height: 44px;
    font-size: 16px;
  }
  .b2 {
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
    flex-shrink: 0;
  }
  .b2.ghost {
    padding: 0 20px;
    border: 1.5px solid var(--line-strong);
    background: var(--surface);
    color: var(--ink);
  }
  .empty {
    font-size: 16px;
  }
  @media (max-width: 700px) {
    .admin {
      padding: 24px 16px;
    }
    .card {
      flex-wrap: wrap;
      gap: 12px;
    }
    .body {
      flex-basis: 100%;
    }
  }
</style>
