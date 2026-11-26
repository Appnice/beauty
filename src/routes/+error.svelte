<script lang="ts">
  import { page } from '$app/state';
  import { i18n } from '$lib/i18n';
  import { trError } from '$lib/i18n/errors.ts';
  const L = $derived(i18n(page.data.lang));
</script>

<svelte:head>
  <title>{page.status}</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main class="wiz">
  <p class="muted" style="margin-top: 40px; font-size: 15px; font-weight: 600">{page.status}</p>
  <h1 style="margin: 8px 0 0">
    {page.status === 404 && (!page.error?.message || page.error.message === 'Not Found')
      ? L.t.common.noPage
      : trError(page.error?.message ?? '', L.lang)}
  </h1>
  <div class="grow"></div>
  <a class="btn" href="/">{L.t.common.home}</a>
</main>
