<script lang="ts">
  // The result: "Wizyta potwierdzona" (automatic mode) or "Czeka na potwierdzenie salonu" (manual mode).
  import { visitWhen } from '$lib/pl';
  import Icon from '$lib/ui/Icon.svelte';
  import { b, type PublicService } from './state.svelte';

  let { slug, service, again }: { slug: string; service: PublicService | undefined; again: () => void } =
    $props();
  const d = $derived(b.done!);
  const ok = $derived(d.status === 'potwierdzona');
</script>

<main class="wiz res">
  <span class="ring" class:ok>
    <Icon name={ok ? 'check' : 'clock'} size={34} stroke={2.2} color={ok ? '#2E7D4F' : '#8A3A5A'} />
  </span>
  <h1>{ok ? 'Wizyta potwierdzona' : 'Czeka na potwierdzenie salonu'}</h1>
  <p class="lead center">{ok ? 'Przypomnimy SMS-em dzień wcześniej.' : 'Dostaniesz SMS.'}</p>

  <div class="sum" style="margin-top: 32px; width: 100%">
    <div class="line"><Icon name="scissors" size={20} color="#6E655F" />{service?.name ?? ''}</div>
    <div class="line"><Icon name="team" size={20} color="#6E655F" />{d.staff}</div>
    <div class="line"><Icon name="calendar" size={20} color="#6E655F" />{visitWhen(d.start)}</div>
  </div>

  <div class="grow"></div>
  <a class="btn" href="/api/{slug}/booking/{d.token}/ics" download="wizyta.ics">
    <Icon name="calendar" size={20} color="#FFFFFF" /> Dodaj do kalendarza
  </a>
  <a class="btn secondary" style="margin-top: 10px" href="/{slug}/wizyta/{d.token}">Zobacz wizytę</a>
  <button type="button" class="linkish" onclick={again}>Zarezerwuj kolejną</button>
</main>

<style>
  .res {
    align-items: center;
    padding-top: 96px;
  }
  .ring {
    width: 72px;
    height: 72px;
    border-radius: 36px;
    background: var(--accent-soft);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .ring.ok {
    background: #e1edde;
  }
  h1 {
    margin: 24px 0 8px;
    text-align: center;
  }
  .center {
    text-align: center;
  }
  .linkish {
    margin-top: 8px;
    border: 0;
    background: none;
    min-height: 44px;
    color: var(--accent);
    font-size: 15px;
    font-weight: 600;
  }
</style>
