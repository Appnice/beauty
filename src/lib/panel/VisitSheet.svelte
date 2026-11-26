<script lang="ts">
  // The visit card: who, when, what; accept a waiting visit, cancel, "nie przyszła", "zakończona", a note.
  import { page } from '$app/state';
  import { api } from '$lib/api';
  import { personColor } from '$lib/colors';
  import { i18n } from '$lib/i18n';
  import { hm, phoneLocal, zoned } from '$lib/pl';
  import Avatar from '$lib/ui/Avatar.svelte';
  import Sheet from '$lib/ui/Sheet.svelte';
  import type { Calendar, PVisit } from './types';

  /** The name the server sends for an erased client (`ERASED_NAME`): data, not a text. */
  const ERASED = 'Usunięty klient';
  const L = $derived(i18n(page.data.lang));
  const t = $derived(L.t.panel.visit);

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
    ondone(t.toast.erased);
  }

  async function saveNote() {
    busy = true;
    const r = await api('PATCH', `/api/${slug}/visits/${visit.id}`, { action: 'note', note });
    busy = false;
    if (!r.ok) return void (error = r.error);
    ondone(t.toast.noteSaved);
  }
</script>

<Sheet title={L.t.panel.client(visit.clientName)} {onclose}>
  <div class="who" style:background={c.bg} style:color={c.ink}>
    <Avatar name={person?.name ?? '?'} bg="#FFFFFF" ink={c.ink} size={28} />
    <span class="wname">{person?.name}</span>
    <span>· {L.shortDate(a.day)} · {hm(a.min)}–{hm(z.min)}</span>
  </div>
  <p class="svc">{visit.serviceName}</p>
  {#if visit.clientPhone}
    <a class="phone" href="tel:{visit.clientPhone}">{phoneLocal(visit.clientPhone)}</a>
  {/if}

  <label class="field" style="margin-top: 22px">
    {t.note}
    <textarea class="input" bind:value={note}></textarea>
  </label>
  {#if note !== visit.note}
    <button class="btn secondary" style="margin-top: 8px" onclick={saveNote} disabled={busy}
      >{t.saveNote}</button
    >
  {/if}

  <div class="grow"></div>
  {#if error}<p class="error" role="alert" style="margin-bottom: 12px">{error}</p>{/if}
  <div class="acts">
    {#if visit.status === 'oczekuje'}
      <button class="btn" onclick={() => act('confirm', t.toast.accepted)} disabled={busy}>{t.accept}</button>
      <button class="btn secondary" onclick={() => act('cancel', t.toast.rejected)} disabled={busy}
        >{t.reject}</button
      >
    {:else if visit.status === 'potwierdzona'}
      {#if started}
        <button class="btn" onclick={() => act('finish', t.toast.finished)} disabled={busy}>{t.finish}</button
        >
        <button class="btn secondary" onclick={() => act('no_show', t.toast.noShow)} disabled={busy}>
          {t.noShow(visit.clientName)}
        </button>
      {/if}
      <button class="btn secondary" onclick={() => act('cancel', t.toast.cancelled)} disabled={busy}
        >{t.cancel}</button
      >
    {:else}
      <p class="muted state">
        {L.t.panel.status[visit.status]}
      </p>
    {/if}
    {#if visit.clientName !== ERASED}
      {#if erase}
        <button class="btn danger" onclick={eraseClient} disabled={busy}>{t.eraseYes}</button>
        <button class="btn secondary" onclick={() => (erase = false)} disabled={busy}>{t.eraseNo}</button>
      {:else}
        <button class="erase" onclick={() => (erase = true)} disabled={busy}>{t.erase}</button>
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
