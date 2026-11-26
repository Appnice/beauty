<script lang="ts">
  // Step 2 (Kod.dc.html): the 6-digit SMS code. With SMS_ECHO=on the server returns the code: it fills the boxes.
  import { onDestroy } from 'svelte';
  import { page } from '$app/state';
  import { api } from '$lib/api';
  import { i18n } from '$lib/i18n';
  import CodeInput from '$lib/ui/CodeInput.svelte';
  import StepHeader from '$lib/ui/StepHeader.svelte';
  import { w } from './state.svelte';

  let { next, back }: { next: () => void; back: () => void } = $props();
  const L = $derived(i18n(page.data.lang));
  const t = $derived(L.t.signup);
  let value = $state(w.code);
  let error = $state('');
  let busy = $state(false);
  let now = $state(Date.now());
  const tick = setInterval(() => (now = Date.now()), 1000);
  onDestroy(() => clearInterval(tick));
  const left = $derived(Math.max(0, 60 - Math.floor((now - w.sentAt) / 1000)));

  async function resend() {
    error = '';
    const r = await api<{ code?: string }>('POST', '/api/signup/code', { phone: w.phone });
    if (!r.ok) return void (error = r.error);
    w.sentAt = Date.now();
    value = w.code = r.data.code ?? '';
  }

  async function submit(e?: SubmitEvent) {
    e?.preventDefault();
    if (value.length !== 6) return void (error = t.code.errors.digits);
    busy = true;
    const r = await api<{ phoneToken: string }>('POST', '/api/signup/verify', {
      phone: w.phone,
      code: value
    });
    busy = false;
    if (!r.ok) return void (error = r.error);
    w.phoneToken = r.data.phoneToken;
    next();
  }
</script>

<form class="wiz" onsubmit={submit} novalidate>
  <StepHeader step={2} onback={back} />
  <h1 style="margin: 40px 0 8px">{t.code.title}</h1>
  <p class="lead">{t.code.sentTo(w.phone)}</p>
  <div style="margin-top: 36px"><CodeInput bind:value /></div>
  <p class="again">
    {#if left > 0}
      {t.code.resendIn(left)}
    {:else}
      {t.code.notArrived} <button type="button" class="linkish" onclick={resend}>{t.code.resend}</button>
    {/if}
  </p>
  <div class="grow"></div>
  {#if error}<p class="error msg" role="alert">{error}</p>{/if}
  <button class="btn" disabled={busy}>{t.next}</button>
</form>

<style>
  .again {
    margin: 20px 0 0;
    font-size: 15px;
    color: var(--muted);
  }
  .linkish {
    border: 0;
    background: none;
    padding: 0;
    color: var(--accent);
    font-weight: 600;
    font-size: 15px;
    min-height: 44px;
  }
</style>
