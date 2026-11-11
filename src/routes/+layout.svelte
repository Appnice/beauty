<script lang="ts">
  import '../app.css';
  import Toast from '$lib/ui/Toast.svelte';
  let { children } = $props();
</script>

<svelte:head>
  <link rel="manifest" href="/manifest.webmanifest" />
  <meta name="theme-color" content="#8A3A5A" />
  <link rel="icon" href="/icons/icon.svg" type="image/svg+xml" />
  <link rel="apple-touch-icon" href="/icons/icon-192.png" />
</svelte:head>

{@render children()}
<Toast />
