<script lang="ts">
  import { page } from '$app/state';
</script>

<svelte:head>
  <title>{page.status}</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<main class="wiz">
  <p class="muted" style="margin-top: 40px; font-size: 15px; font-weight: 600">{page.status}</p>
  <h1 style="margin: 8px 0 0">
    {page.status === 404 && (!page.error?.message || page.error.message === 'Not Found')
      ? 'Nie ma takiej strony.'
      : page.error?.message}
  </h1>
  <div class="grow"></div>
  <a class="btn" href="/">Strona główna</a>
</main>
