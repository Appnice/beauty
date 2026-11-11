<script lang="ts">
  // Step 4 (Uslugi.dc.html): tick the services; "Dodaj swoją" adds one (60 min, changed later in Ustawienia).
  import { plural } from '$lib/pl';
  import Icon from '$lib/ui/Icon.svelte';
  import StepHeader from '$lib/ui/StepHeader.svelte';
  import { w } from './state.svelte';

  let { next, back }: { next: () => void; back: () => void } = $props();
  let adding = $state(false);
  let own = $state('');
  let error = $state('');
  const n = $derived(w.services.filter((s) => s.on).length);

  function add() {
    const name = own.trim();
    if (name) w.services.push({ name, min: 60, on: true });
    own = '';
    adding = false;
  }

  function submit(e: SubmitEvent) {
    e.preventDefault();
    if (adding && own.trim()) return add();
    if (n === 0) return void (error = 'Zaznacz co najmniej jedną usługę.');
    next();
  }
</script>

<form class="wiz" onsubmit={submit} novalidate>
  <StepHeader step={4} onback={back} />
  <h1 style="margin: 32px 0 6px">Co robicie?</h1>
  <p class="lead">Zaznacz. Czas zmienisz później.</p>

  <div class="list">
    {#each w.services as s, i (i)}
      <button
        type="button"
        class="row"
        class:on={s.on}
        aria-pressed={s.on}
        onclick={() => ((s.on = !s.on), (error = ''))}
      >
        <span class="box"
          >{#if s.on}<Icon name="check" size={16} stroke={3} color="#FFFFFF" />{/if}</span
        >
        <span class="name">{s.name}</span>
        <span class="min">{s.min} min</span>
      </button>
    {/each}
    {#if adding}
      <div class="row on add-row">
        <!-- svelte-ignore a11y_autofocus -->
        <input aria-label="Nazwa usługi" placeholder="Nazwa usługi" bind:value={own} autofocus />
        <button type="button" class="add-btn" onclick={add}>Dodaj</button>
      </div>
    {:else}
      <button type="button" class="row dashed" onclick={() => (adding = true)}>
        <Icon name="plus" size={22} stroke={2.2} />
        Dodaj swoją
      </button>
    {/if}
  </div>

  <div class="grow"></div>
  {#if error}<p class="error msg" role="alert">{error}</p>{/if}
  <button class="btn">Dalej · {n} {plural(n, 'usługa', 'usługi', 'usług')}</button>
</form>

<style>
  .list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 24px;
  }
  .row {
    height: 56px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 14px;
    border: 1.5px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--surface);
    color: var(--ink);
    text-align: left;
  }
  .row.on {
    border-color: var(--accent);
  }
  .box {
    width: 26px;
    height: 26px;
    border-radius: 8px;
    border: 1.5px solid var(--check);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .row.on .box {
    background: var(--accent);
    border-color: var(--accent);
  }
  .name {
    flex-grow: 1;
    font-size: 17px;
    font-weight: 500;
  }
  .row.on .name {
    font-weight: 600;
  }
  .min {
    font-size: 15px;
    color: var(--muted);
  }
  .dashed {
    border: 1.5px dashed var(--check);
    background: transparent;
    color: var(--accent);
    font-size: 17px;
    font-weight: 600;
  }
  .add-row {
    padding: 0 8px 0 14px;
  }
  .add-row input {
    flex-grow: 1;
    min-width: 0;
    border: 0;
    font-size: 17px;
    outline: none;
    background: transparent;
    color: var(--ink);
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
</style>
