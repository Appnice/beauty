<script lang="ts">
  // Step 5 (Zespol.dc.html): names of the people; each one is a calendar column. The first one is the owner.
  import { personColor } from '$lib/colors';
  import Avatar from '$lib/ui/Avatar.svelte';
  import Icon from '$lib/ui/Icon.svelte';
  import StepHeader from '$lib/ui/StepHeader.svelte';
  import { ownerGuess, w } from './state.svelte';

  let { next, back }: { next: () => void; back: () => void } = $props();
  let name = $state('');
  if (w.team.length === 0) w.team.push({ name: ownerGuess(w.name) });

  function add() {
    const v = name.trim();
    if (v) w.team.push({ name: v });
    name = '';
  }

  function submit(e: SubmitEvent) {
    e.preventDefault();
    if (name.trim()) return add();
    if (w.team.length === 0) w.team.push({ name: ownerGuess(w.name) });
    next();
  }
</script>

<form class="wiz" onsubmit={submit} novalidate>
  <StepHeader step={5} onback={back} />
  <h1 style="margin: 32px 0 6px">Kto pracuje?</h1>
  <p class="lead">Każda osoba to kolumna w kalendarzu.</p>

  <div class="list">
    {#each w.team as p, i (i)}
      {@const c = personColor(null, i)}
      <div class="row">
        <Avatar name={p.name} bg={c.bg} ink={c.avatarInk} size={40} />
        <span class="name">{p.name}</span>
        <span class="note">{i === 0 ? 'Ty' : ''}</span>
        <button type="button" class="icon-btn" aria-label="Usuń" onclick={() => w.team.splice(i, 1)}>
          <Icon name="close" size={20} color="#9A918A" />
        </button>
      </div>
    {/each}
    <div class="row new">
      <input aria-label="Imię" placeholder="Imię" bind:value={name} autocomplete="off" />
      <button type="button" class="add-btn" onclick={add}>Dodaj</button>
    </div>
  </div>

  <div class="grow"></div>
  <button class="btn">Dalej</button>
  <p class="foot">Pracujesz sama? Też dobrze.</p>
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
