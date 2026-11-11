<script lang="ts">
  // Step 5: the 6-digit SMS code (Kod.dc.html). The code proves the phone; then the visit is booked.
  import { onDestroy } from 'svelte';
  import { api } from '$lib/api';
  import CodeInput from '$lib/ui/CodeInput.svelte';
  import StepHeader from '$lib/ui/StepHeader.svelte';
  import { sendBooking } from './book';
  import { b } from './state.svelte';

  let {
    slug,
    staffName,
    done,
    taken,
    back
  }: { slug: string; staffName: string; done: () => void; taken: () => void; back: () => void } = $props();
  let value = $state(b.code);
  let error = $state('');
  let busy = $state(false);
  let now = $state(Date.now());
  const tick = setInterval(() => (now = Date.now()), 1000);
  onDestroy(() => clearInterval(tick));
  const left = $derived(Math.max(0, 60 - Math.floor((now - b.sentAt) / 1000)));

  async function resend() {
    error = '';
    const r = await api<{ code?: string }>('POST', `/api/${slug}/booking/code`, { phone: b.phone });
    if (!r.ok) return void (error = r.error);
    b.sentAt = Date.now();
    value = b.code = r.data.code ?? '';
  }

  async function submit(e?: SubmitEvent) {
    e?.preventDefault();
    error = '';
    if (value.length !== 6) return void (error = 'Wpisz 6 cyfr.');
    busy = true;
    const v = await api<{ phoneToken: string }>('POST', `/api/${slug}/booking/verify`, {
      phone: b.phone,
      code: value
    });
    if (!v.ok) {
      busy = false;
      return void (error = v.error);
    }
    b.phoneToken = v.data.phoneToken;
    b.phoneTokenFor = b.phone;
    b.code = '';
    const r = await sendBooking(slug, staffName);
    busy = false;
    if (r.outcome === 'done') return done();
    if (r.outcome === 'taken') return taken();
    error = r.error;
  }
</script>

<form class="wiz" onsubmit={submit} novalidate>
  <StepHeader step={5} total={5} onback={back} />
  <h1 style="margin: 40px 0 8px">Wpisz kod z SMS</h1>
  <p class="lead">Wysłaliśmy go na {b.phone}</p>
  <div style="margin-top: 36px"><CodeInput bind:value /></div>
  <p class="again">
    {#if left > 0}
      Nie doszedł? Wyślij ponownie za {Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}
    {:else}
      Nie doszedł? <button type="button" class="linkish" onclick={resend}>Wyślij ponownie</button>
    {/if}
  </p>
  <div class="grow"></div>
  {#if error}<p class="error msg" role="alert">{error}</p>{/if}
  <button class="btn" disabled={busy}>Zarezerwuj</button>
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
