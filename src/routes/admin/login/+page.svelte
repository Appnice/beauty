<script lang="ts">
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { api } from '$lib/api';
  import { i18n } from '$lib/i18n';
  import Logo from '$lib/ui/Logo.svelte';
  const L = $derived(i18n(page.data.lang));
  const t = $derived(L.t.admin);
  let password = $state('');
  let error = $state('');
  let busy = $state(false);
  async function submit(e: SubmitEvent) {
    e.preventDefault();
    busy = true;
    const r = await api('POST', '/api/admin/login', { password });
    busy = false;
    if (!r.ok) return void (error = r.error);
    goto('/admin');
  }
</script>

<svelte:head>
  <title>{t.login.title}</title>
  <meta name="robots" content="noindex" />
</svelte:head>

<form class="wiz" onsubmit={submit} novalidate>
  <div style="display: flex; align-items: center; gap: 8px; height: 44px; font-weight: 700; font-size: 17px">
    <Logo /> beauty
  </div>
  <h1 style="margin: 40px 0 0">{t.title}</h1>
  <label class="field" style="margin-top: 36px">
    {t.login.password}
    <!-- svelte-ignore a11y_autofocus -->
    <input class="input" type="password" bind:value={password} autocomplete="current-password" autofocus />
  </label>
  <div class="grow"></div>
  {#if error}<p class="error msg" role="alert">{error}</p>{/if}
  <button class="btn" disabled={busy}>{t.login.submit}</button>
</form>
