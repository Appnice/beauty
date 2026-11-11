<script lang="ts">
  // Step 3 (Salon.dc.html): "O salonie" for the platform admin. City, people and description are required.
  import StepHeader from '$lib/ui/StepHeader.svelte';
  import { linkOk, w } from './state.svelte';

  let { next, back }: { next: () => void; back: () => void } = $props();
  const SIZES = ['1', '2–3', '4–6', '7+'];
  let error = $state('');

  function submit(e: SubmitEvent) {
    e.preventDefault();
    error = '';
    if (!w.city.trim()) return void (error = 'Podaj miejscowość.');
    if (!w.teamSize) return void (error = 'Zaznacz, ile osób pracuje.');
    if (!linkOk(w.link)) return void (error = 'Sprawdź link. Wpisz adres strony albo @nazwę.');
    if (!w.about.trim()) return void (error = 'Napisz, czym się zajmujecie.');
    next();
  }
</script>

<form class="wiz" onsubmit={submit} novalidate>
  <StepHeader step={3} onback={back} />
  <h1 style="margin: 28px 0 0">O salonie</h1>

  <div class="fields" style="gap: 14px; margin-top: 20px">
    <label class="field small">
      Miejscowość
      <input class="input" bind:value={w.city} autocomplete="address-level2" />
    </label>
    <label class="field small">
      Ulica i numer
      <input class="input" bind:value={w.street} autocomplete="address-line1" />
    </label>
    <div class="field small">
      <span>Ile osób pracuje?</span>
      <div role="radiogroup" aria-label="Ile osób pracuje" class="sizes">
        {#each SIZES as s (s)}
          <button
            type="button"
            role="radio"
            aria-checked={w.teamSize === s}
            class:on={w.teamSize === s}
            onclick={() => (w.teamSize = s)}>{s}</button
          >
        {/each}
      </div>
    </div>
    <label class="field small">
      Instagram, Facebook lub strona
      <input class="input" bind:value={w.link} inputmode="url" autocomplete="url" />
    </label>
    <label class="field small">
      Czym się zajmujecie?
      <textarea class="input" bind:value={w.about}></textarea>
    </label>
  </div>

  <div class="grow"></div>
  {#if error}<p class="error msg" role="alert">{error}</p>{/if}
  <button class="btn">Dalej</button>
</form>

<style>
  .small {
    gap: 6px;
  }
  .small .input {
    height: 52px;
    font-size: 17px;
  }
  .small textarea.input {
    height: 88px;
    padding: 12px 16px;
    line-height: 1.4;
  }
  .sizes {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 8px;
  }
  .sizes button {
    height: 48px;
    border-radius: 12px;
    border: 1.5px solid var(--line-strong);
    background: var(--surface);
    color: var(--ink);
    font-size: 16px;
    font-weight: 600;
  }
  .sizes button.on {
    background: var(--accent);
    border-color: var(--accent);
    color: #fff;
  }
</style>
