<script lang="ts">
  // New visit side sheet (NowaWizyta.dc.html): person + day + time prefilled, phone with a returning-client
  // suggestion, name, service chips, "Zapisz · 13:00–14:00".
  import { page } from '$app/state';
  import { api } from '$lib/api';
  import { personColor } from '$lib/colors';
  import { i18n } from '$lib/i18n';
  import { groupDigits, hm, initial, instant, phoneLocal } from '$lib/pl';
  import Avatar from '$lib/ui/Avatar.svelte';
  import Sheet from '$lib/ui/Sheet.svelte';
  import type { Calendar } from './types';

  let {
    slug,
    cal,
    day,
    staffId,
    min,
    pick = false,
    onclose,
    onsaved
  }: {
    slug: string;
    cal: Calendar;
    day: string;
    staffId: string;
    min: number;
    pick?: boolean;
    onclose: () => void;
    onsaved: (msg: string) => void;
  } = $props();

  const L = $derived(i18n(page.data.lang));
  const t = $derived(L.t.panel.newVisit);
  // svelte-ignore state_referenced_locally
  let who = $state(staffId);
  // svelte-ignore state_referenced_locally
  let at = $state(min);
  let phone = $state('');
  let name = $state('');
  let clientId = $state<string | null>(null);
  let hint = $state<{ id: string; name: string; phone: string | null; visit_count: number } | null>(null);
  let error = $state('');
  let busy = $state(false);

  const person = $derived(cal.staff.find((s) => s.id === who)!);
  const pIndex = $derived(cal.staff.findIndex((s) => s.id === who));
  const color = $derived(personColor(person?.color, pIndex));
  const services = $derived(cal.services.filter((s) => person?.services.includes(s.id)));
  let serviceId = $state('');
  $effect(() => {
    if (!services.some((s) => s.id === serviceId)) serviceId = services[0]?.id ?? '';
  });
  const dur = $derived(services.find((s) => s.id === serviceId)?.durationMin ?? 60);
  const TIMES = Array.from({ length: (22 - 6) * 4 + 1 }, (_, i) => 6 * 60 + i * 15);

  let timer: ReturnType<typeof setTimeout> | undefined;
  function typed(e: Event & { currentTarget: HTMLInputElement }) {
    phone = groupDigits(e.currentTarget.value);
    e.currentTarget.value = phone;
    clientId = null;
    clearTimeout(timer);
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 3) return void (hint = null);
    timer = setTimeout(async () => {
      const r = await api<{ clients: NonNullable<typeof hint>[] }>(
        'GET',
        `/api/${slug}/clients?q=${encodeURIComponent(digits)}`
      );
      hint = r.ok ? (r.data.clients[0] ?? null) : null;
    }, 200);
  }

  function useHint() {
    if (!hint) return;
    clientId = hint.id;
    name = hint.name;
    phone = phoneLocal(hint.phone);
    hint = null;
  }

  async function save(e: SubmitEvent) {
    e.preventDefault();
    error = '';
    if (!clientId && name.trim().length < 2) return void (error = t.needName);
    if (!serviceId) return void (error = t.needService);
    busy = true;
    const r = await api('POST', `/api/${slug}/visits`, {
      serviceId,
      staffId: who,
      start: instant(day, at),
      ...(clientId
        ? { clientId }
        : { client: { name: name.trim(), phone: phone.replace(/\D/g, '') ? phone : null } })
    });
    busy = false;
    if (!r.ok) return void (error = r.error);
    onsaved(t.saved(hm(at)));
  }
</script>

<Sheet title={t.title} {onclose}>
  <form class="form" onsubmit={save} novalidate>
    {#if pick}
      <div class="chips" role="radiogroup" aria-label={t.who}>
        {#each cal.staff as s, i (s.id)}
          {@const c = personColor(s.color, i)}
          <button
            type="button"
            role="radio"
            aria-checked={who === s.id}
            class="chip"
            style:background={who === s.id ? c.bg : '#FFFFFF'}
            style:border-color={who === s.id ? c.dot : undefined}
            style:color={who === s.id ? c.ink : undefined}
            onclick={() => (who = s.id)}>{s.name}</button
          >
        {/each}
      </div>
      <label class="field" style="margin-top: 14px">
        {t.time}
        <select class="input" bind:value={at}>
          {#each TIMES as t (t)}<option value={t}>{hm(t)}</option>{/each}
        </select>
      </label>
    {:else}
      <div class="who" style:background={color.bg} style:color={color.ink} data-testid="sheet-who">
        <Avatar name={person.name} bg="#FFFFFF" ink={color.ink} size={28} />
        <span class="wname">{person.name}</span>
        <span class="wwhen">· {L.shortDate(day)} · {hm(at)}</span>
      </div>
    {/if}

    <label class="field" style="margin-top: 22px">
      {t.phone}
      <input class="input phone" value={phone} oninput={typed} inputmode="tel" autocomplete="off" />
    </label>
    {#if hint}
      <button type="button" class="hint" onclick={useHint} data-testid="client-hint">
        <span class="hav">{initial(hint.name)}</span>
        <span class="htext">
          <span class="hname">{hint.name}</span>
          <span class="hsub">{phoneLocal(hint.phone)} · {t.been(hint.name, hint.visit_count)}</span>
        </span>
      </button>
    {/if}

    <label class="field" style="margin-top: 18px">
      {t.name}
      <input class="input" bind:value={name} oninput={() => (clientId = null)} autocomplete="off" />
    </label>

    <p class="label">{t.service}</p>
    <div class="chips">
      {#each services as s (s.id)}
        <button
          type="button"
          class="chip"
          class:on={serviceId === s.id}
          aria-pressed={serviceId === s.id}
          onclick={() => (serviceId = s.id)}>{s.name} · {t.minutes(s.durationMin)}</button
        >
      {/each}
    </div>

    <div class="grow"></div>
    {#if error}<p class="error" role="alert" style="margin-bottom: 12px">{error}</p>{/if}
    <button class="btn" disabled={busy}>{t.save} · {hm(at)}–{hm(at + dur)}</button>
  </form>
</Sheet>

<style>
  .form {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
  }
  .who {
    margin-top: 14px;
    height: 52px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 14px;
    border-radius: var(--radius);
  }
  .wname {
    font-size: 16px;
    font-weight: 700;
  }
  .wwhen {
    font-size: 16px;
  }
  .hint {
    margin-top: 6px;
    height: 60px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 14px;
    border: 1.5px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--surface);
    text-align: left;
  }
  .hav {
    width: 36px;
    height: 36px;
    border-radius: 18px;
    background: var(--accent-soft);
    color: var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    flex-shrink: 0;
  }
  .htext {
    display: flex;
    flex-direction: column;
    flex-grow: 1;
    min-width: 0;
  }
  .hname {
    font-size: 16px;
    font-weight: 700;
    color: var(--ink);
  }
  .hsub {
    font-size: 14px;
    color: var(--muted);
  }
  .label {
    margin: 18px 0 8px;
    font-size: 15px;
    font-weight: 600;
  }
  .chips {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .chip {
    height: 44px;
    padding: 0 14px;
    border-radius: 12px;
    border: 1.5px solid var(--line-strong);
    background: var(--surface);
    color: var(--ink);
    font-size: 15px;
    font-weight: 600;
  }
  .chip.on {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }
  .grow {
    flex-grow: 1;
    min-height: 20px;
  }
  .phone:focus {
    border-width: 2px; /* NowaWizyta.dc.html: the field being typed in */
  }
</style>
