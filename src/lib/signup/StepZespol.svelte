<script lang="ts">
  // Step 5 (Zespol.dc.html): names of the people; each one is a calendar column. The first one is the owner.
  import { page } from '$app/state';
  import { personColor } from '$lib/colors';
  import { i18n } from '$lib/i18n';
  import Avatar from '$lib/ui/Avatar.svelte';
  import Icon from '$lib/ui/Icon.svelte';
  import StepHeader from '$lib/ui/StepHeader.svelte';
  import { ownerGuess, w } from './state.svelte';

  let { next, back }: { next: () => void; back: () => void } = $props();
  const L = $derived(i18n(page.data.lang));
  const t = $derived(L.t.signup);
  let name = $state('');
  // the guessed name is saved as the owner's calendar column, so it follows the page language
  if (w.team.length === 0) w.team.push({ name: ownerGuess(w.name, i18n(page.data.lang).t.signup.team.me) });

  function add() {
    const v = name.trim();
    if (v) w.team.push({ name: v });
    name = '';
  }

  function submit(e: SubmitEvent) {
    e.preventDefault();
    if (name.trim()) return add();
    if (w.team.length === 0) w.team.push({ name: ownerGuess(w.name, t.team.me) });
    next();
  }
</script>

<form class="wiz" onsubmit={submit} novalidate>
  <StepHeader step={5} onback={back} />
  <h1 style="margin: 32px 0 6px">{t.team.title}</h1>
  <p class="lead">{t.team.lead}</p>

  <div class="list">
    {#each w.team as p, i (i)}
      {@const c = personColor(null, i)}
      <div class="row">
        <Avatar name={p.name} bg={c.bg} ink={c.avatarInk} size={40} />
        <span class="name">{p.name}</span>
        <span class="note">{i === 0 ? t.team.you : ''}</span>
        <button type="button" class="icon-btn" aria-label={t.team.remove} onclick={() => w.team.splice(i, 1)}>
          <Icon name="close" size={20} color="#9A918A" />
        </button>
      </div>
    {/each}
    <div class="row new">
      <input aria-label={t.team.name} placeholder={t.team.name} bind:value={name} autocomplete="off" />
      <button type="button" class="add-btn" onclick={add}>{t.add}</button>
    </div>
  </div>

  <div class="grow"></div>
  <button class="btn">{t.next}</button>
  <p class="foot">{t.team.alone}</p>
</form>

<style>
  .list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 24px;
  }
  .row {
    /* as in the design: 64 px content-box, the border adds to it */
    box-sizing: content-box;
    height: 64px;
    display: flex;
    align-items: center;
    gap: 14px;
    padding: 0 8px 0 14px;
    border: 1.5px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--surface);
  }
  .row.new {
    gap: 10px;
    border-color: var(--accent);
  }
  .name {
    flex-grow: 1;
    font-size: 17px;
    font-weight: 600;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .note {
    font-size: 14px;
    color: var(--muted);
  }
  input {
    flex-grow: 1;
    min-width: 0;
    border: 0;
    font-size: 17px;
    color: var(--ink);
    outline: none;
    background: transparent;
  }
  .add-btn {
    height: 44px;
    padding: 0 16px;
    border: 0;
    border-radius: 10px;
    background: var(--accent-soft);
    color: var(--accent);
    font-size: 16px;
    font-weight: 600;
  }
  .foot {
    margin: 16px 0 0;
    text-align: center;
    font-size: 15px;
    color: var(--muted);
  }
</style>
