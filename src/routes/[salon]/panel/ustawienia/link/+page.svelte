<script lang="ts">
  // Link do zapisów: the address, copy, QR code to print.
  import { renderSVG } from 'uqr';
  import SubHeader from '$lib/panel/SubHeader.svelte';
  import Icon from '$lib/ui/Icon.svelte';
  import { showToast } from '$lib/ui/toast.svelte.ts';

  let { data } = $props();
  const url = $derived(
    `https://${data.publicHost}/${data.salon.slug}`.replace(/^https:\/\/(localhost|127\.)/, 'http://$1')
  );
  const shown = $derived(`${data.publicHost}/${data.salon.slug}`);
  const svg = $derived(renderSVG(url, { border: 1 }));

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      showToast('Skopiowane');
    } catch {
      showToast('Nie udało się skopiować.', 'error');
    }
  }
</script>

<main class="page">
  <SubHeader slug={data.salon.slug} title="Link do zapisów" />
  <div class="card">
    <a class="url" href={url} target="_blank" rel="noopener" data-testid="booking-link">{shown}</a>
    <!-- eslint-disable-next-line svelte/no-at-html-tags -->
    <div class="qr" aria-label="Kod QR">{@html svg}</div>
    <button class="btn" onclick={copy}><Icon name="copy" size={20} /> Kopiuj link</button>
    {#if data.salon.status === 'pending'}<p class="muted">Zapisy online ruszą po akceptacji</p>{/if}
  </div>
</main>

<style>
  .card {
    margin-top: 24px;
    max-width: 420px;
    padding: 24px;
    border: 1.5px solid var(--line-strong);
    border-radius: 18px;
    background: var(--surface);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 18px;
  }
  .url {
    font-size: 20px;
    font-weight: 700;
    overflow-wrap: anywhere;
    text-align: center;
  }
  .qr {
    width: 220px;
    height: 220px;
  }
  .qr :global(svg) {
    width: 100%;
    height: 100%;
  }
</style>
