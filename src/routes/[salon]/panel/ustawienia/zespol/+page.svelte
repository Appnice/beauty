<script lang="ts">
  // Zespół: the people (calendar columns). Tap a person: name, phone (for her login), colour, services.
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { api } from '$lib/api';
  import { i18n } from '$lib/i18n';
  import { PALETTE, personColor } from '$lib/colors';
  import { phoneLocal } from '$lib/pl';
  import SubHeader from '$lib/panel/SubHeader.svelte';
  import type { Calendar, PStaff } from '$lib/panel/types';
  import Avatar from '$lib/ui/Avatar.svelte';
  import Icon from '$lib/ui/Icon.svelte';
  import PhoneInput from '$lib/ui/PhoneInput.svelte';
  import Sheet from '$lib/ui/Sheet.svelte';
  import { showToast } from '$lib/ui/toast.svelte.ts';
  import { today } from '$lib/pl';

  let { data } = $props();
  const L = $derived(i18n(page.data.lang));
  const slug = $derived(data.salon.slug);
  let cal = $state<Calendar | null>(null);
  let name = $state('');
  let edit = $state<{ p: PStaff; name: string; phone: string; color: string; services: string[] } | null>(
    null
  );

  async function load() {
    const r = await api<Calendar>('GET', `/api/${slug}/calendar?date=${today()}&days=1`);
    if (r.ok) cal = r.data;
  }
  onMount(load);

  async function add(e: SubmitEvent) {
    e.preventDefault();
    if (!name.trim() || !cal) return;
    const color = PALETTE[cal.staff.length % PALETTE.length].dot;
    const r = await api<{ staff: { id: string } }>('POST', `/api/${slug}/staff`, {
      name: name.trim(),
      color,
      sort: cal.staff.length
    });
    if (!r.ok) return showToast(r.error, 'error');
    await api(
      'PUT',
      `/api/${slug}/staff/${r.data.staff.id}/services`,
      cal.services.map((s) => ({ serviceId: s.id }))
    );
    await api(
      'PUT',
      `/api/${slug}/staff/${r.data.staff.id}/schedule`,
      cal.hours.map((h) => ({ weekday: h.weekday, starts: h.opens, ends: h.closes }))
    );
    name = '';
    load();
  }

  function open(p: PStaff) {
    edit = { p, name: p.name, phone: phoneLocal(p.phone), color: p.color, services: [...p.services] };
  }

  async function save(e: SubmitEvent) {
    e.preventDefault();
    if (!edit) return;
    const r = await api('PATCH', `/api/${slug}/staff/${edit.p.id}`, {
      name: edit.name.trim(),
      phone: edit.phone.replace(/\D/g, '') ? edit.phone : null,
      color: edit.color
    });
    if (!r.ok) return showToast(r.error, 'error');
    const s = await api(
      'PUT',
      `/api/${slug}/staff/${edit.p.id}/services`,
      edit.services.map((id) => ({ serviceId: id }))
    );
    if (!s.ok) return showToast(s.error, 'error');
    edit = null;
    showToast(L.t.settings.team.saved);
    load();
  }

  async function remove() {
    if (!edit) return;
    const r = await api('PATCH', `/api/${slug}/staff/${edit.p.id}`, { active: false });
    if (!r.ok) return showToast(r.error, 'error');
    edit = null;
    showToast(L.t.settings.team.removed);
    load();
  }
</script>

<main class="page">
  <SubHeader {slug} title={L.t.settings.team.title} />
  <div class="rows">
    {#each cal?.staff ?? [] as p, i (p.id)}
      {@const c = personColor(p.color, i)}
      <button class="rowbox person" onclick={() => open(p)} data-testid="person-row">
        <Avatar name={p.name} bg={c.bg} ink={c.avatarInk} size={40} />
        <span class="pname">{p.name}</span>
        <span class="muted pphone">{p.phone ? phoneLocal(p.phone) : L.t.settings.team.noPhone}</span>
        <Icon name="forward" size={20} color="#9A918A" />
      </button>
    {/each}
    <form class="rowbox new" onsubmit={add}>
      <input
        class="plain"
        aria-label={L.t.settings.team.name}
        placeholder={L.t.settings.team.name}
        bind:value={name}
      />
      <button class="soft-btn">{L.t.settings.team.add}</button>
    </form>
  </div>
  <a class="more" href="/{slug}/panel/ustawienia/blokady"
    ><Icon name="pause" size={20} /> {L.t.settings.team.timeOff}</a
  >
</main>

{#if edit && cal}
  <Sheet title={edit.p.name} onclose={() => (edit = null)}>
    <form class="form" onsubmit={save} novalidate>
      <label class="field" style="margin-top: 14px">
        {L.t.settings.team.name}
        <input class="input" bind:value={edit.name} />
      </label>
      <div style="margin-top: 18px">
        <PhoneInput bind:value={edit.phone} label={L.t.settings.team.phone} />
      </div>
      <p class="label">{L.t.settings.team.colour}</p>
      <div class="chips" role="radiogroup" aria-label={L.t.settings.team.colour}>
        {#each PALETTE as c (c.key)}
          <button
            type="button"
            role="radio"
            aria-checked={edit.color.toLowerCase() === c.dot.toLowerCase()}
            aria-label={c.key}
            class="sw"
            class:on={edit.color.toLowerCase() === c.dot.toLowerCase()}
            style:background={c.bg}
            style:border-color={c.dot}
            onclick={() => (edit!.color = c.dot)}
          ></button>
        {/each}
      </div>
      <p class="label">{L.t.settings.team.services}</p>
      <div class="chips">
        {#each cal.services as s (s.id)}
          {@const on = edit.services.includes(s.id)}
          <button
            type="button"
            class="chip"
            class:on
            aria-pressed={on}
            onclick={() =>
              (edit!.services = on ? edit!.services.filter((x) => x !== s.id) : [...edit!.services, s.id])}
            >{s.name}</button
          >
        {/each}
      </div>
      <div class="grow"></div>
      <button class="btn">{L.t.settings.team.save}</button>
      {#if edit.p.id !== data.me.staffId}
        <button type="button" class="btn secondary" style="margin-top: 10px" onclick={remove}
          >{L.t.settings.team.remove}</button
        >
      {/if}
    </form>
  </Sheet>
{/if}

<style>
  .person {
    text-align: left;
    width: 100%;
    gap: 14px;
  }
  .pname {
    flex-grow: 1;
    font-size: 17px;
    font-weight: 600;
    color: var(--ink);
  }
  .pphone {
    font-size: 14px;
  }
  .more {
    margin-top: 20px;
    display: inline-flex;
    align-items: center;
    gap: 8px;
    min-height: 44px;
    font-size: 16px;
    font-weight: 600;
    text-decoration: none;
  }
  .form {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
  }
  .grow {
    flex-grow: 1;
    min-height: 20px;
  }
  .sw {
    width: 44px;
    height: 44px;
    border-radius: 22px;
    border: 2px solid;
  }
  .sw.on {
    box-shadow:
      0 0 0 3px var(--bg),
      0 0 0 5px var(--ink);
  }
</style>
