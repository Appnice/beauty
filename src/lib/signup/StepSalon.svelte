<script lang="ts">
  // Step 3 (Salon.dc.html): "O salonie" for the platform admin. City, people and description are required.
  import { page } from '$app/state';
  import { i18n } from '$lib/i18n';
  import StepHeader from '$lib/ui/StepHeader.svelte';
  import { linkOk, w } from './state.svelte';

  let { next, back }: { next: () => void; back: () => void } = $props();
  const L = $derived(i18n(page.data.lang));
  const t = $derived(L.t.signup);
  const SIZES = ['1', '2–3', '4–6', '7+'];
  let error = $state('');

  function submit(e: SubmitEvent) {
    e.preventDefault();
    error = '';
    if (!w.city.trim()) return void (error = t.salon.errors.city);
    if (!w.teamSize) return void (error = t.salon.errors.teamSize);
    if (!linkOk(w.link)) return void (error = t.salon.errors.link);
    if (!w.about.trim()) return void (error = t.salon.errors.about);
    next();
  }
</script>

<form class="wiz" onsubmit={submit} novalidate>
  <StepHeader step={3} onback={back} />
  <h1 style="margin: 28px 0 0">{t.salon.title}</h1>

  <div class="fields" style="gap: 14px; margin-top: 20px">
    <label class="field small">
      {t.salon.city}
      <input class="input" bind:value={w.city} autocomplete="address-level2" />
    </label>
    <label class="field small">
      {t.salon.street}
      <input class="input" bind:value={w.street} autocomplete="address-line1" />
    </label>
    <div class="field small">
      <span>{t.salon.teamSize}</span>
      <div role="radiogroup" aria-label={t.salon.teamSizeAria} class="sizes">
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
      {t.salon.link}
      <input class="input" bind:value={w.link} inputmode="url" autocomplete="url" />
    </label>
    <label class="field small">
      {t.salon.about}
      <textarea class="input" bind:value={w.about}></textarea>
    </label>
  </div>

  <div class="grow"></div>
  {#if error}<p class="error msg" role="alert">{error}</p>{/if}
  <button class="btn">{t.next}</button>
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
