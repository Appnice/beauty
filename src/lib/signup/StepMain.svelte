<script lang="ts">
  // Step 1 (Main.dc.html): salon name, its address, the owner's phone and a password.
  import { api } from '$lib/api';
  import Icon from '$lib/ui/Icon.svelte';
  import PhoneInput from '$lib/ui/PhoneInput.svelte';
  import StepHeader from '$lib/ui/StepHeader.svelte';
  import { w } from './state.svelte';

  let { next, needsCode, full }: { next: () => void; needsCode: boolean; full: boolean } = $props();
  let typed = $state('');
  const error = $derived(typed || (full ? 'Dużo zgłoszeń. Spróbuj jutro.' : ''));
  let busy = $state(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  function nameInput() {
    clearTimeout(timer);
    timer = setTimeout(async () => {
      if (!w.name.trim()) return void (w.slug = '');
      const r = await api<{ slug: string }>('GET', `/api/signup?name=${encodeURIComponent(w.name)}`);
      if (r.ok) w.slug = r.data.slug;
    }, 250);
  }

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    typed = '';
    if (!w.name.trim()) return void (typed = 'Podaj nazwę salonu.');
    if (w.phone.replace(/\D/g, '').length !== 9) return void (typed = 'Podaj numer telefonu: 9 cyfr.');
    if (w.password.length < 8) return void (typed = 'Hasło musi mieć co najmniej 8 znaków.');
    busy = true;
    if (!w.slug) {
      const s = await api<{ slug: string }>('GET', `/api/signup?name=${encodeURIComponent(w.name)}`);
      if (s.ok) w.slug = s.data.slug;
    }
    const r = await api<{ code?: string }>('POST', '/api/signup/code', { phone: w.phone });
    busy = false;
    if (!r.ok) return void (typed = r.error);
    w.code = r.data.code ?? '';
    w.sentAt = Date.now();
    w.phoneToken = '';
    next();
  }
</script>

<form class="wiz" onsubmit={submit} novalidate>
  <StepHeader step={1} />
  <h1 style="margin: 40px 0 8px">Załóż salon</h1>
  <p class="lead">Za darmo. 3 minuty.</p>

  <div class="fields" style="gap: 20px; margin-top: 36px">
    <label class="field">
      Nazwa salonu
      <input class="input" bind:value={w.name} oninput={nameInput} autocomplete="organization" />
    </label>
    <div class="addr">
      <Icon name="link" size={14} color="#6E655F" />
      beauty.appnice.dev/<b>{w.slug || 'twoj-salon'}</b>
    </div>
    <PhoneInput bind:value={w.phone} />
    <label class="field">
      Hasło
      <input class="input" type="password" bind:value={w.password} autocomplete="new-password" />
    </label>
    {#if needsCode}
      <label class="field">
        Kod zaproszenia
        <input class="input" bind:value={w.invite} autocomplete="off" />
      </label>
    {/if}
    <label class="hp" aria-hidden="true">
      Strona
      <input tabindex="-1" autocomplete="off" name="website" bind:value={w.website} />
    </label>
  </div>

  <div class="grow"></div>
  {#if error}<p class="error msg" role="alert">{error}</p>{/if}
  <button class="btn" disabled={busy}>Dalej</button>
  <p class="foot">Masz już salon? <a href="/login">Zaloguj się</a></p>
</form>

<style>
  .addr {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-top: -10px;
    font-size: 14px;
    color: var(--muted);
    overflow-wrap: anywhere;
  }
  .addr b {
    color: var(--ink);
    font-weight: 600;
  }
  .foot {
    margin: 20px 0 0;
    text-align: center;
    font-size: 15px;
    color: var(--muted);
  }
  .foot a {
    font-weight: 600;
  }
</style>
