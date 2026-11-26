<script lang="ts">
  // Privacy (RODO) for the clients of one salon. Plain words, short.
  import { page } from '$app/state';
  import { i18n } from '$lib/i18n';
  import { phoneLocal } from '$lib/pl';
  let { data } = $props();
  const L = $derived(i18n(page.data.lang));
  const t = $derived(L.t.booking.privacy);
  const s = $derived(data.salon);
  const where = $derived([s.street, s.city].filter(Boolean).join(', '));
</script>

<svelte:head>
  <title>{t.pageTitle(s.name)}</title>
  {#if !data.online}<meta name="robots" content="noindex" />{/if}
</svelte:head>

<main class="wiz doc">
  <a class="bar" href="/{s.slug}">{s.name}</a>
  <h1 style="margin: 32px 0 20px">{t.title}</h1>

  <h2>{t.whoTitle}</h2>
  <p>{t.controller(s.name, where, s.phone ? phoneLocal(s.phone) : '')}</p>
  <p>{t.processor(data.operator)}</p>

  <h2>{t.whatTitle}</h2>
  <p>{t.what}</p>

  <h2>{t.whyTitle}</h2>
  <p>{t.why}</p>

  <h2>{t.howLongTitle}</h2>
  <p>{t.howLong}</p>

  <h2>{t.rightsTitle}</h2>
  <p>{t.rights}</p>

  <h2>{t.cookiesTitle}</h2>
  <p>{t.cookies}</p>
</main>

<style>
  .bar {
    height: 44px;
    display: flex;
    align-items: center;
    font-weight: 700;
    font-size: 17px;
    color: var(--ink);
    text-decoration: none;
  }
  .doc h2 {
    margin: 22px 0 6px;
    font-size: 17px;
    font-weight: 700;
  }
  .doc p {
    margin: 0 0 8px;
    font-size: 16px;
    line-height: 1.5;
    color: var(--ink);
  }
</style>
