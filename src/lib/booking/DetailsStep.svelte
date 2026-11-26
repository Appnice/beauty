<script lang="ts">
  // Step 4: name + phone and one consent line. With a phone verified a moment ago (a taken time) it books at once.
  import { page } from '$app/state';
  import { api } from '$lib/api';
  import { i18n } from '$lib/i18n';
  import PhoneInput from '$lib/ui/PhoneInput.svelte';
  import StepHeader from '$lib/ui/StepHeader.svelte';
  import { sendBooking } from './book';
  import { b, type PublicService } from './state.svelte';

  let {
    slug,
    service,
    staffName,
    next,
    done,
    taken,
    back
  }: {
    slug: string;
    service: PublicService;
    staffName: string;
    next: () => void;
    done: () => void;
    taken: () => void;
    back: () => void;
  } = $props();
  const L = $derived(i18n(page.data.lang));
  let error = $state('');
  let busy = $state(false);

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    error = '';
    if (b.name.trim().length < 2) return void (error = L.t.booking.details.needName);
    if (b.phone.replace(/\D/g, '').length !== 9) return void (error = L.t.booking.details.needPhone);
    busy = true;
    if (b.phoneToken && b.phoneTokenFor === b.phone) {
      const r = await sendBooking(slug, staffName);
      busy = false;
      if (r.outcome === 'done') return done();
      if (r.outcome === 'taken') return taken();
      if (r.code === 'BAD_CODE') b.phoneToken = '';
      return void (error = r.error);
    }
    const r = await api<{ code?: string }>('POST', `/api/${slug}/booking/code`, { phone: b.phone });
    busy = false;
    if (!r.ok) return void (error = r.error);
    b.code = r.data.code ?? '';
    b.sentAt = Date.now();
    next();
  }
</script>

<form class="wiz" onsubmit={submit} novalidate>
  <StepHeader step={4} total={5} onback={back} />
  <h1 style="margin: 40px 0 8px">{L.t.booking.details.title}</h1>
  <p class="lead">{service.name} · {staffName} · {L.visitWhen(b.start)}</p>
  <div class="fields" style="gap: 20px; margin-top: 36px">
    <label class="field">
      {L.t.booking.details.name}
      <input class="input" bind:value={b.name} autocomplete="given-name" maxlength="80" />
    </label>
    <PhoneInput bind:value={b.phone} label={L.t.booking.details.phone} />
  </div>
  <p class="consent">
    {L.t.booking.details.consentBefore}<a href="/{slug}/prywatnosc">{L.t.booking.details.consentLink}</a>{L.t
      .booking.details.consentAfter}
  </p>
  <div class="grow"></div>
  {#if error}<p class="error msg" role="alert">{error}</p>{/if}
  <button class="btn" disabled={busy}>
    {b.phoneToken && b.phoneTokenFor === b.phone ? L.t.booking.details.book : L.t.booking.details.next}
  </button>
</form>

<style>
  .consent {
    margin-top: 16px;
    font-size: 14px;
    color: var(--muted);
  }
  .consent a {
    font-weight: 600;
  }
</style>
