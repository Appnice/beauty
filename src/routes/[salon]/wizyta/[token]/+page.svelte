<script lang="ts">
  // The visit page (signed link from the SMS). Cancel asks once more: a mistap must not cancel.
  import { enhance } from '$app/forms';
  import { page } from '$app/state';
  import { phoneLocal, visitWhen } from '$lib/pl';
  import Icon from '$lib/ui/Icon.svelte';

  let { data, form } = $props();
  const v = $derived(data.visit);
  const ask = $derived(page.url.searchParams.get('odwolaj') === '1' && v.canCancel);
  const active = $derived(v.status === 'oczekuje' || v.status === 'potwierdzona');
  const LABEL: Record<string, string> = {
    potwierdzona: 'Wizyta potwierdzona',
    oczekuje: 'Czeka na potwierdzenie salonu',
    odwolana: 'Wizyta odwołana',
    zakonczona: 'Wizyta zakończona',
    nieobecnosc: 'Nieobecność'
  };
  const again = $derived(`/${data.salon.slug}?usluga=${v.serviceId}&osoba=${encodeURIComponent(v.staffId)}`);
</script>

<svelte:head>
  <title>{data.salon.name}</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main class="wiz">
  <div class="bar">{data.salon.name}</div>
  <span
    class="pill"
    class:ok={v.status === 'potwierdzona'}
    class:wait={v.status === 'oczekuje'}
    data-testid="status">{LABEL[v.status]}</span
  >
  <h1 style="margin: 16px 0 0">{v.service}</h1>

  <div class="sum" style="margin-top: 24px">
    <div class="line"><Icon name="calendar" size={20} color="#6E655F" />{visitWhen(v.start)}</div>
    <div class="line"><Icon name="team" size={20} color="#6E655F" />{v.staff}</div>
    {#if data.salon.street || data.salon.city}
      <div class="line">
        <Icon name="pin" size={20} color="#6E655F" />{[data.salon.street, data.salon.city]
          .filter(Boolean)
          .join(', ')}
      </div>
    {/if}
    {#if data.salon.phone}
      <a class="line tel" href="tel:{data.salon.phone}"
        ><Icon name="phone" size={20} color="#6E655F" />{phoneLocal(data.salon.phone)}</a
      >
    {/if}
  </div>

  <div class="grow"></div>
  {#if form?.error}<p class="error msg" role="alert">{form.error}</p>{/if}

  {#if ask}
    <h2 class="q">Odwołać wizytę?</h2>
    <form method="POST" use:enhance>
      <button class="btn danger">Tak, odwołaj</button>
    </form>
    <a class="btn secondary" style="margin-top: 10px" href="?">Nie</a>
  {:else}
    {#if active}
      <a class="btn" href="/api/{data.salon.slug}/booking/{data.token}/ics" download="wizyta.ics">
        <Icon name="calendar" size={20} color="#FFFFFF" /> Dodaj do kalendarza
      </a>
    {/if}
    <a class="btn secondary" style="margin-top: 10px" href={again}>Zarezerwuj ponownie</a>
    {#if v.canCancel}
      <a class="cancel" href="?odwolaj=1">Odwołaj wizytę</a>
    {:else if active}
      <p class="late">Na odwołanie jest już za późno. Zadzwoń do salonu.</p>
    {/if}
  {/if}
</main>

<style>
  .bar {
    height: 44px;
    display: flex;
    align-items: center;
    font-weight: 700;
    font-size: 17px;
  }
  .pill {
    align-self: flex-start;
    margin-top: 32px;
    padding: 8px 12px;
    border-radius: 10px;
    background: var(--seg);
    color: var(--muted);
    font-size: 15px;
    font-weight: 600;
  }
  .pill.ok {
    background: #e1edde;
    color: #2e7d4f;
  }
  .pill.wait {
    background: var(--accent-soft);
    color: var(--accent);
  }
  .tel {
    color: var(--ink);
    text-decoration: none;
  }
  .q {
    margin-bottom: 16px;
    font-size: 22px;
    font-weight: 700;
    text-align: center;
  }
  .danger {
    background: var(--danger);
  }
  .danger:hover {
    background: #86241f;
  }
  .cancel {
    margin-top: 10px;
    min-height: 44px;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--danger);
    font-size: 16px;
    font-weight: 600;
    text-decoration: none;
  }
  .late {
    margin-top: 16px;
    text-align: center;
    font-size: 15px;
    color: var(--muted);
  }
</style>
