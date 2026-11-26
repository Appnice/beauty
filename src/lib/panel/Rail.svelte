<script lang="ts">
  // Left rail (Kalendarz.dc.html): Kalendarz, Czekają with the count badge, Ustawienia. A bottom bar on a phone.
  import { page } from '$app/state';
  import { i18n } from '$lib/i18n';
  import Icon from '$lib/ui/Icon.svelte';
  import { panel } from './panel.svelte.ts';
  let { slug, active }: { slug: string; active: 'kalendarz' | 'czekaja' | 'ustawienia' } = $props();
  const t = $derived(i18n(page.data.lang).t.panel.rail);
</script>

<nav aria-label={t.menu} class="rail">
  <span class="logo"><Icon name="calendar" size={20} stroke={2.2} color="#FFFFFF" /></span>
  <a
    href="/{slug}/panel"
    class:on={active === 'kalendarz'}
    aria-current={active === 'kalendarz' ? 'page' : undefined}
  >
    <Icon name="calendar" size={22} />
    {t.calendar}
  </a>
  <a
    href="/{slug}/panel/czekaja"
    class:on={active === 'czekaja'}
    aria-current={active === 'czekaja' ? 'page' : undefined}
  >
    <Icon name="clock" size={22} />
    {t.waiting}
    {#if panel.pending > 0}<span class="badge" data-testid="badge">{panel.pending}</span>{/if}
  </a>
  <a
    href="/{slug}/panel/ustawienia"
    class:on={active === 'ustawienia'}
    aria-current={active === 'ustawienia' ? 'page' : undefined}
  >
    <Icon name="sliders" size={22} />
    {t.settings}
  </a>
</nav>

<style>
  .rail {
    box-sizing: content-box; /* as in the design: 88 px + the 1 px border */
    width: 88px;
    flex-shrink: 0;
    background: var(--surface);
    border-right: 1px solid var(--line);
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: 16px 0;
    gap: 6px;
    position: sticky;
    top: 0;
    height: 100dvh;
  }
  .logo {
    width: 40px;
    height: 40px;
    border-radius: 12px;
    background: var(--accent);
    display: flex;
    align-items: center;
    justify-content: center;
    margin-bottom: 18px;
  }
  a {
    position: relative;
    width: 72px;
    height: 64px;
    border-radius: var(--radius);
    color: var(--muted);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 4px;
    font-size: 12px;
    font-weight: 600;
    text-decoration: none;
  }
  a:hover {
    color: var(--accent);
  }
  a.on {
    background: var(--accent-soft);
    color: var(--accent);
  }
  .badge {
    position: absolute;
    top: 6px;
    right: 14px;
    min-width: 20px;
    height: 20px;
    padding: 0 5px;
    border-radius: 10px;
    background: var(--accent);
    color: #fff;
    font-size: 12px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  @media (max-width: 700px) {
    .rail {
      position: fixed;
      top: auto;
      bottom: 0;
      left: 0;
      right: 0;
      width: auto;
      box-sizing: border-box;
      height: 68px;
      flex-direction: row;
      justify-content: space-around;
      padding: 2px 8px;
      border-right: 0;
      border-top: 1px solid var(--line);
      z-index: 30;
    }
    .logo {
      display: none;
    }
  }
</style>
