<script lang="ts">
  // Step 4: name + phone and one consent line. With a phone verified a moment ago (a taken time) it books at once.
  import { api } from '$lib/api';
  import { visitWhen } from '$lib/pl';
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
  let error = $state('');
  let busy = $state(false);

  async function submit(e: SubmitEvent) {
    e.preventDefault();
    error = '';
    if (b.name.trim().length < 2) return void (error = 'Podaj imię.');
    if (b.phone.replace(/\D/g, '').length !== 9) return void (error = 'Podaj numer telefonu: 9 cyfr.');
    busy = true;
    if (b.phoneToken && b.phoneTokenFor === b.phone) {
      const r = await sendBooking(slug, staffName);
      busy = false;
      if (r.outcome === 'done') return done();
      if (r.outcome === 'taken') return taken();
      if (r.error.includes('Kod')) b.phoneToken = '';
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
  <h1 style="margin: 40px 0 8px">Twoje dane</h1>
  <p class="lead">{service.name} · {staffName} · {visitWhen(b.start)}</p>
  <div class="fields" style="gap: 20px; margin-top: 36px">
    <label class="field">
      Imię
      <input class="input" bind:value={b.name} autocomplete="given-name" maxlength="80" />
    </label>
    <PhoneInput bind:value={b.phone} label="Telefon" />
  </div>
  <p class="consent">
    Rezerwując, zgadzasz się na <a href="/{slug}/prywatnosc">zasady prywatności</a>.
  </p>
  <div class="grow"></div>
  {#if error}<p class="error msg" role="alert">{error}</p>{/if}
  <button class="btn" disabled={busy}>
    {b.phoneToken && b.phoneTokenFor === b.phone ? 'Zarezerwuj' : 'Dalej'}
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
