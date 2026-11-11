<script lang="ts">
  // Login for the owner and the team: phone, then an SMS code or the password. One task per screen.
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { api } from '$lib/api';
  import CodeInput from '$lib/ui/CodeInput.svelte';
  import Icon from '$lib/ui/Icon.svelte';
  import Logo from '$lib/ui/Logo.svelte';
  import PhoneInput from '$lib/ui/PhoneInput.svelte';

  type Step = 'phone' | 'salon' | 'how' | 'code' | 'password';
  let step = $state<Step>('phone');
  let phone = $state('');
  let salons = $state<{ slug: string; name: string }[]>([]);
  let slug = $state('');
  let code = $state('');
  let password = $state('');
  let error = $state('');
  let busy = $state(false);
  const wanted = page.url.searchParams.get('salon') ?? '';
  const salonName = $derived(salons.find((s) => s.slug === slug)?.name ?? '');

  async function findSalons(e: SubmitEvent) {
    e.preventDefault();
    error = '';
    if (phone.replace(/\D/g, '').length !== 9) return void (error = 'Podaj numer telefonu: 9 cyfr.');
    busy = true;
    const r = await api<{ salons: { slug: string; name: string }[] }>(
      'GET',
      `/api/login-salons?phone=${encodeURIComponent(phone)}`
    );
    busy = false;
    if (!r.ok) return void (error = r.error);
    salons = r.data.salons;
    if (salons.length === 0) return void (error = 'Nie znamy tego numeru.');
    const hit = salons.find((s) => s.slug === wanted);
    if (hit || salons.length === 1) {
      slug = (hit ?? salons[0]).slug;
      step = 'how';
    } else step = 'salon';
  }

  async function sendCode() {
    error = '';
    busy = true;
    const r = await api<{ code?: string }>('POST', `/api/${slug}/auth/code`, { phone });
    busy = false;
    if (!r.ok) return void (error = r.error);
    code = r.data.code ?? '';
    step = 'code';
  }

  async function finish(e: SubmitEvent) {
    e.preventDefault();
    error = '';
    busy = true;
    const r =
      step === 'code'
        ? await api('POST', `/api/${slug}/auth/verify`, { phone, code })
        : await api('POST', `/api/${slug}/auth/login`, { phone, password });
    busy = false;
    if (!r.ok) return void (error = r.error);
    goto(`/${slug}/panel`);
  }

  function back() {
    error = '';
    step =
      step === 'code' || step === 'password'
        ? 'how'
        : step === 'how' && salons.length > 1
          ? 'salon'
          : 'phone';
  }
</script>

<svelte:head>
  <title>Zaloguj się</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<div class="wiz">
  <div class="bar">
    {#if step === 'phone'}
      <a class="brand" href="/"><Logo /> beauty</a>
    {:else}
      <button class="icon-btn back" aria-label="Wstecz" onclick={back}><Icon name="back" /></button>
    {/if}
  </div>

  {#if step === 'phone'}
    <form class="col" onsubmit={findSalons} novalidate>
      <h1>Zaloguj się</h1>
      <div style="margin-top: 36px"><PhoneInput bind:value={phone} label="Telefon" autofocus /></div>
      <div class="grow"></div>
      {#if error}<p class="error msg" role="alert">{error}</p>{/if}
      <button class="btn" disabled={busy}>Dalej</button>
      <p class="foot">Nie masz salonu? <a href="/zaloz">Załóż salon</a></p>
    </form>
  {:else if step === 'salon'}
    <div class="col">
      <h1>Który salon?</h1>
      <div class="list">
        {#each salons as s (s.slug)}
          <button class="btn secondary" onclick={() => ((slug = s.slug), (step = 'how'))}>{s.name}</button>
        {/each}
      </div>
    </div>
  {:else if step === 'how'}
    <div class="col">
      <h1>{salonName}</h1>
      <p class="lead">{phone}</p>
      <div class="grow"></div>
      {#if error}<p class="error msg" role="alert">{error}</p>{/if}
      <button class="btn" onclick={sendCode} disabled={busy}>Wyślij kod SMS</button>
      <button class="btn secondary" style="margin-top: 12px" onclick={() => (step = 'password')}>
        Mam hasło
      </button>
    </div>
  {:else}
    <form class="col" onsubmit={finish} novalidate>
      {#if step === 'code'}
        <h1>Wpisz kod z SMS</h1>
        <p class="lead">Wysłaliśmy go na {phone}</p>
        <div style="margin-top: 36px"><CodeInput bind:value={code} /></div>
      {:else}
        <h1>Hasło</h1>
        <p class="lead">{salonName}</p>
        <label class="field" style="margin-top: 36px">
          Hasło
          <!-- svelte-ignore a11y_autofocus -->
          <input
            class="input"
            type="password"
            bind:value={password}
            autocomplete="current-password"
            autofocus
          />
        </label>
      {/if}
      <div class="grow"></div>
      {#if error}<p class="error msg" role="alert">{error}</p>{/if}
      <button class="btn" disabled={busy}>Zaloguj się</button>
    </form>
  {/if}
</div>

<style>
  .bar {
    height: 44px;
    display: flex;
    align-items: center;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 700;
    font-size: 17px;
    color: var(--ink);
    text-decoration: none;
  }
  .back {
    margin-left: -10px;
  }
  .col {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
  }
  h1 {
    margin: 40px 0 8px;
  }
  .list {
    display: flex;
    flex-direction: column;
    gap: 8px;
    margin-top: 24px;
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
