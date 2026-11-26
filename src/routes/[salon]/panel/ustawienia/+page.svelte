<script lang="ts">
  // Ustawienia (Ustawienia.dc.html): four tiles, the confirmation mode and the SMS counter of this month.
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import { i18n } from '$lib/i18n';
  import { instant, today } from '$lib/pl';
  import type { Calendar } from '$lib/panel/types';
  import Icon from '$lib/ui/Icon.svelte';
  import LangSwitch from '$lib/ui/LangSwitch.svelte';
  import { showToast } from '$lib/ui/toast.svelte.ts';

  let { data } = $props();
  const L = $derived(i18n(page.data.lang));
  const slug = $derived(data.salon.slug);
  let cal = $state<Calendar | null>(null);
  // svelte-ignore state_referenced_locally
  let mode = $state(data.salon.confirmationMode);
  // svelte-ignore state_referenced_locally
  let hours = $state(data.salon.managerReminderHours);
  let sms = $state<{ count: number; limit: number } | null>(null);
  const month = Number(today().slice(5, 7));

  onMount(async () => {
    // the month of the tablet's clock, midnight to midnight in the salon zone
    const d = today();
    const [y, m] = d.split('-').map(Number);
    const first = `${y}-${String(m).padStart(2, '0')}-01`;
    const next = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;
    const [c, s] = await Promise.all([
      api<Calendar>('GET', `/api/${slug}/calendar?date=${d}&days=1`),
      api<{ count: number; limit: number }>(
        'GET',
        `/api/${slug}/sms?since=${encodeURIComponent(instant(first, 0))}&until=${encodeURIComponent(instant(next, 0))}`
      )
    ]);
    if (c.ok) cal = c.data;
    if (s.ok) sms = s.data;
  });

  async function setMode(m: 'auto' | 'manual') {
    mode = m;
    const r = await api('PATCH', `/api/${slug}/settings`, { confirmationMode: m });
    if (!r.ok) showToast(r.error, 'error');
  }
  async function setHours() {
    const r = await api('PATCH', `/api/${slug}/settings`, { managerReminderHours: Number(hours) });
    if (!r.ok) showToast(r.error, 'error');
  }
  async function logout() {
    await api('POST', `/api/${slug}/auth/logout`);
    goto('/login');
  }

  const n = $derived(cal?.services.length ?? 0);
  const tiles = $derived([
    {
      href: 'uslugi',
      icon: 'scissors',
      title: L.t.settings.main.services,
      sub: cal ? L.t.settings.main.servicesCount(n) : ''
    },
    {
      href: 'zespol',
      icon: 'team',
      title: L.t.settings.main.team,
      sub: cal?.staff.map((s) => s.name).join(', ') ?? ''
    },
    {
      href: 'godziny',
      icon: 'hours',
      title: L.t.settings.main.hours,
      sub: cal ? L.hoursSummary(cal.hours) : ''
    },
    { href: 'link', icon: 'link', title: L.t.settings.main.link, sub: `${data.publicHost}/${slug}` }
  ]);
  const pct = $derived(sms ? Math.min(100, Math.round((sms.count / sms.limit) * 100)) : 0);
  // The package is used up: SMS stop until the 1st of the next month (codes refuse, reminders wait).
  const full = $derived(!!sms && sms.count >= sms.limit);
</script>

<main class="set">
  <h1>{data.salon.name}</h1>

  <div class="tiles">
    {#each tiles as t (t.href)}
      <a class="tile" href="/{slug}/panel/ustawienia/{t.href}">
        <span class="ic"><Icon name={t.icon} size={24} /></span>
        <span class="tx">
          <span class="tt">{t.title}</span>
          {#if t.sub}<span class="ts">{t.sub}</span>{/if}
        </span>
        <Icon name="forward" size={20} color="#9A918A" />
      </a>
    {/each}
  </div>

  <div class="two">
    <div class="box" style="gap: 14px">
      <span class="bt">{L.t.settings.main.newBookings}</span>
      <div role="radiogroup" aria-label={L.t.settings.main.newBookings} class="radios">
        <button
          role="radio"
          aria-checked={mode === 'auto'}
          class:on={mode === 'auto'}
          onclick={() => setMode('auto')}
        >
          <span class="dot"></span>{L.t.settings.main.modeAuto}
        </button>
        <button
          role="radio"
          aria-checked={mode === 'manual'}
          class:on={mode === 'manual'}
          onclick={() => setMode('manual')}
        >
          <span class="dot"></span>{L.t.settings.main.modeManual}
        </button>
      </div>
      {#if mode === 'manual'}
        <label class="remind">
          {L.t.settings.main.remindAfter}
          <select bind:value={hours} onchange={setHours}>
            {#each [1, 2, 4, 8, 24] as h (h)}<option value={h}>{h} h</option>{/each}
          </select>
        </label>
      {/if}
    </div>

    <div class="box" class:full data-testid="sms">
      <span class="bt">{L.t.settings.main.smsIn(L.monthsIn[month - 1])}</span>
      <span class="big"
        >{sms?.count ?? 0} <span class="of">{L.t.settings.main.smsOf(sms?.limit ?? 300)}</span></span
      >
      <div class="track"><div class="fill" style:width="{pct}%"></div></div>
      {#if full}
        <span class="ts limit" role="status">{L.t.settings.main.smsLimit(L.monthsOfDay[month % 12])}</span>
      {:else}
        <span class="ts">{L.t.settings.main.smsNote}</span>
      {/if}
    </div>
  </div>

  <button class="out" onclick={logout}><Icon name="logout" size={18} /> {L.t.settings.main.logout}</button>
  <LangSwitch />
</main>

<style>
  .set {
    padding: 28px 40px;
  }
  h1 {
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -0.01em;
  }
  .tiles,
  .two {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
    margin-top: 24px;
  }
  .two {
    margin-top: 12px;
  }
  .tile {
    height: 96px;
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 0 20px;
    border: 1.5px solid var(--line-strong);
    border-radius: 18px;
    background: var(--surface);
    text-decoration: none;
    min-width: 0;
  }
  .ic {
    width: 48px;
    height: 48px;
    border-radius: var(--radius);
    background: var(--accent-soft);
    color: var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .tx {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex-grow: 1;
    min-width: 0;
  }
  .tt {
    font-size: 18px;
    font-weight: 700;
    color: var(--ink);
  }
  .ts {
    font-size: 15px;
    color: var(--muted);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .box {
    padding: 20px;
    border: 1.5px solid var(--line-strong);
    border-radius: 18px;
    background: var(--surface);
    display: flex;
    flex-direction: column;
    gap: 12px;
    min-width: 0;
  }
  .bt {
    font-size: 18px;
    font-weight: 700;
  }
  .radios {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .radios button {
    height: 52px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 14px;
    border: 1.5px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--surface);
    font-size: 16px;
    font-weight: 500;
    color: var(--ink);
    text-align: left;
  }
  .radios button.on {
    border: 2px solid var(--accent);
    font-weight: 600;
  }
  .dot {
    width: 20px;
    height: 20px;
    border-radius: 10px;
    border: 1.5px solid var(--check);
    flex-shrink: 0;
  }
  .on .dot {
    border: 6px solid var(--accent);
  }
  .remind {
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 15px;
    color: var(--muted);
  }
  .remind select {
    height: 44px;
    border: 1.5px solid var(--line-strong);
    border-radius: 12px;
    background: var(--surface);
    font-size: 16px;
    padding: 0 8px;
  }
  .big {
    font-size: 32px;
    font-weight: 700;
    letter-spacing: -0.02em;
  }
  .of {
    font-size: 18px;
    font-weight: 500;
    color: var(--muted);
  }
  .track {
    height: 10px;
    border-radius: 5px;
    background: var(--seg);
  }
  .fill {
    height: 10px;
    border-radius: 5px;
    background: var(--accent);
  }
  .full .fill {
    background: var(--danger);
  }
  .limit {
    color: var(--danger);
    font-weight: 600;
    white-space: normal;
  }
  .out {
    margin-top: 24px;
    height: 44px;
    border: 0;
    background: none;
    color: var(--muted);
    font-size: 15px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0;
  }
  @media (max-width: 700px) {
    .set {
      padding: 20px 16px;
    }
    .tiles,
    .two {
      grid-template-columns: 1fr;
    }
  }
</style>
