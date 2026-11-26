<script lang="ts">
  import { onMount } from 'svelte';
  import { page } from '$app/state';
  import { i18n } from '$lib/i18n';
  import Rail from '$lib/panel/Rail.svelte';
  import { panel, POLL_MS, refreshPending } from '$lib/panel/panel.svelte.ts';
  import Icon from '$lib/ui/Icon.svelte';

  let { data, children } = $props();
  // svelte-ignore state_referenced_locally
  panel.slug = data.salon.slug;
  const manager = $derived(data.me.role === 'manager');
  const active = $derived(
    page.url.pathname.includes('/czekaja')
      ? 'czekaja'
      : page.url.pathname.includes('/ustawienia')
        ? 'ustawienia'
        : 'kalendarz'
  );

  onMount(() => {
    if (!manager) return;
    refreshPending();
    const t = setInterval(refreshPending, POLL_MS);
    const wake = () => document.visibilityState === 'visible' && refreshPending();
    document.addEventListener('visibilitychange', wake);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', wake);
    };
  });
</script>

<svelte:head>
  <title>{data.salon.name}</title>
  <meta name="robots" content="noindex" />
</svelte:head>

{#if manager}
  <div class="shell">
    <Rail slug={data.salon.slug} {active} />
    <div class="area">
      {#if data.salon.status === 'pending'}
        <p class="wait" data-testid="pending-line">
          <Icon name="clock" size={14} />
          {i18n(page.data.lang).t.panel.pendingLine}
        </p>
      {/if}
      {@render children()}
    </div>
  </div>
{:else}
  {@render children()}
{/if}

<style>
  .shell {
    display: flex;
    min-height: 100dvh;
  }
  .area {
    flex-grow: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .wait {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--muted);
  }
  @media (max-width: 700px) {
    .area {
      padding-bottom: 72px;
    }
  }
</style>
