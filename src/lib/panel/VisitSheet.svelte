<script lang="ts">
  // The visit card: who, when, what; accept a waiting visit, cancel, "nie przyszła", "zakończona", a note.
  import { api } from '$lib/api';
  import { personColor } from '$lib/colors';
  import { hm, isFemaleName, phoneLocal, shortDate, zoned } from '$lib/pl';
  import Avatar from '$lib/ui/Avatar.svelte';
  import Sheet from '$lib/ui/Sheet.svelte';
  import type { Calendar, PVisit } from './types';

  const ERASED = 'Usunięty klient';

  let {
    slug,
    cal,
    visit,
    onclose,
    ondone
  }: {
    slug: string;
    cal: Calendar;
    visit: PVisit;
    onclose: () => void;
    ondone: (msg: string) => void;
  } = $props();

  // svelte-ignore state_referenced_locally
  let note = $state(visit.note);
  let error = $state('');
  let busy = $state(false);
  const i = $derived(cal.staff.findIndex((s) => s.id === visit.staffId));
  const person = $derived(cal.staff[i]);
  const c = $derived(personColor(person?.color, i));
  const a = $derived(zoned(visit.start));
  const z = $derived(zoned(visit.end));
  const started = $derived(Date.parse(visit.start) <= Date.now());
  const she = $derived(isFemaleName(visit.clientName));

  async function act(action: string, msg: string) {
    error = '';
    busy = true;
    const r = await api('PATCH', `/api/${slug}/visits/${visit.id}`, { action });
    busy = false;
    if (!r.ok) return void (error = r.error);
    ondone(msg);
  }

  let erase = $state(false);
  async function eraseClient() {
    error = '';
    busy = true;
    const r = await api('DELETE', `/api/${slug}/clients/${visit.clientId}`);
    busy = false;
    if (!r.ok) return void (error = r.error);
    ondone('Dane klienta usunięte');
  }

  async function saveNote() {
    busy = true;
    const r = await api('PATCH', `/api/${slug}/visits/${visit.id}`, { action: 'note', note });
    busy = false;
    if (!r.ok) return void (error = r.error);
    ondone('Notatka zapisana');
  }
</script>

<Sheet title={visit.clientName} {onclose}>
  <div class="who" style:background={c.bg} style:color={c.ink}>
    <Avatar name={person?.name ?? '?'} bg="#FFFFFF" ink={c.ink} size={28} />
    <span class="wname">{person?.name}</span>
    <span>· {shortDate(a.day)} · {hm(a.min)}–{hm(z.min)}</span>
  </div>
  <p class="svc">{visit.serviceName}</p>
  {#if visit.clientPhone}
    <a class="phone" href="tel:{visit.clientPhone}">{phoneLocal(visit.clientPhone)}</a>
  {/if}

  <label class="field" style="margin-top: 22px">
    Notatka
    <textarea class="input" bind:value={note}></textarea>
  </label>
  {#if note !== visit.note}
    <button class="btn secondary" style="margin-top: 8px" onclick={saveNote} disabled={busy}
      >Zapisz notatkę</button
    >
  {/if}

  <div class="grow"></div>
  {#if error}<p class="error" role="alert" style="margin-bottom: 12px">{error}</p>{/if}
  <div class="acts">
    {#if visit.status === 'oczekuje'}
      <button class="btn" onclick={() => act('confirm', 'Przyjęta')} disabled={busy}>Przyjmij</button>
      <button class="btn secondary" onclick={() => act('cancel', 'Odrzucona')} disabled={busy}>Odrzuć</button>
    {:else if visit.status === 'potwierdzona'}
      {#if started}
        <button class="btn" onclick={() => act('finish', 'Zakończona')} disabled={busy}>Zakończona</button>
        <button class="btn secondary" onclick={() => act('no_show', 'Nieobecność')} disabled={busy}>
          {she ? 'Nie przyszła' : 'Nie przyszedł'}
        </button>
      {/if}
      <button class="btn secondary" onclick={() => act('cancel', 'Odwołana')} disabled={busy}
        >Odwołaj wizytę</button
      >
    {:else}
      <p class="muted state">
        {visit.status === 'zakonczona'
          ? 'Zakończona'
          : visit.status === 'nieobecnosc'
            ? 'Nieobecność'
            : 'Odwołana'}
      </p>
    {/if}
    {#if visit.clientName !== ERASED}
      {#if erase}
        <button class="btn danger" onclick={eraseClient} disabled={busy}>Tak, usuń dane</button>
        <button class="btn secondary" onclick={() => (erase = false)} disabled={busy}>Nie</button>
      {:else}
        <button class="erase" onclick={() => (erase = true)} disabled={busy}>Usuń dane klienta</button>
      {/if}
    {/if}
  </div>
</Sheet>

<style>
  .who {
    margin-top: 14px;
    height: 52px;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 0 14px;
    border-radius: var(--radius);
    font-size: 16px;
  }
  .wname {
    font-weight: 700;
  }
  .svc {
    margin-top: 18px;
    font-size: 18px;
    font-weight: 700;
  }
  .phone {
    display: inline-flex;
    align-items: center;
    min-height: 44px;
    font-size: 17px;
    font-weight: 600;
  }
  .grow {
    flex-grow: 1;
    min-height: 20px;
  }
  .acts {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .erase {
    min-height: 44px;
    border: 0;
    background: none;
    color: var(--danger);
    font-size: 15px;
    font-weight: 600;
  }
  .danger {
    background: var(--danger);
  }
  .state {
    text-align: center;
    font-size: 16px;
  }
</style>
