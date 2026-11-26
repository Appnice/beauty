<script lang="ts">
  // "PL / EN": reloads the same page in the other language (hooks.server.ts keeps the choice in a cookie).
  import { page } from '$app/state';
  let { class: cls = '' }: { class?: string } = $props();
  const href = (l: string) => {
    const u = new URL(page.url);
    u.searchParams.set('lang', l);
    return u.pathname + u.search;
  };
</script>

<nav class="lang {cls}" aria-label="Język / Language">
  <a href={href('pl')} class:on={page.data.lang !== 'en'} data-sveltekit-reload hreflang="pl" lang="pl">PL</a>
  <span aria-hidden="true">/</span>
  <a href={href('en')} class:on={page.data.lang === 'en'} data-sveltekit-reload hreflang="en" lang="en">EN</a>
</nav>

<style>
  .lang {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    font-weight: 600;
    color: var(--muted, #6b635e);
  }
  .lang a {
    color: inherit;
    text-decoration: none;
    padding: 12px 4px;
  }
  .lang a.on {
    color: var(--accent);
  }
  .lang a:hover {
    text-decoration: underline;
  }
</style>
