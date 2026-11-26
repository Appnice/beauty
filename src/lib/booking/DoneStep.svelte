<script lang="ts">
  // The result: "Wizyta potwierdzona" (automatic mode) or "Czeka na potwierdzenie salonu" (manual mode).
  import { page } from '$app/state';
  import { i18n } from '$lib/i18n';
  import Icon from '$lib/ui/Icon.svelte';
  import { b, type PublicService } from './state.svelte';

  let { slug, service, again }: { slug: string; service: PublicService | undefined; again: () => void } =
    $props();
  const L = $derived(i18n(page.data.lang));
  const d = $derived(b.done!);
  const ok = $derived(d.status === 'potwierdzona');
</script>

<main class="wiz res">
  <span class="ring" class:ok>
    <Icon name={ok ? 'check' : 'clock'} size={34} stroke={2.2} color={ok ? '#2E7D4F' : '#8A3A5A'} />
  </span>
  <h1>{ok ? L.t.booking.status.potwierdzona : L.t.booking.status.oczekuje}</h1>
  <p class="lead center">{ok ? L.t.booking.done.remind : L.t.booking.done.willSms}</p>

  <div class="sum" style="margin-top: 32px; width: 100%">
    <div class="line"><Icon name="scissors" size={20} color="#6E655F" />{service?.name ?? ''}</div>
    <div class="line"><Icon name="team" size={20} color="#6E655F" />{d.staff}</div>
    <div class="line"><Icon name="calendar" size={20} color="#6E655F" />{L.visitWhen(d.start)}</div>
  </div>

  <div class="grow"></div>
  <a class="btn" href="/api/{slug}/booking/{d.token}/ics" download={L.t.booking.icsFile}>
    <Icon name="calendar" size={20} color="#FFFFFF" />
    {L.t.booking.addToCalendar}
  </a>
  <a class="btn secondary" style="margin-top: 10px" href="/{slug}/wizyta/{d.token}">{L.t.booking.done.see}</a>
  <button type="button" class="linkish" onclick={again}>{L.t.booking.done.another}</button>
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
