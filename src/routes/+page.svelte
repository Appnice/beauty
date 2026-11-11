<script lang="ts">
  import Logo from '$lib/ui/Logo.svelte';
</script>

<svelte:head>
  <title>beauty · zapisy do salonu</title>
  <meta name="description" content="Darmowy kalendarz dla salonu i zapisy online." />
</svelte:head>

<main class="land">
  <div class="brand"><Logo /> beauty</div>
  <h1>Zapisy do salonu bez papieru</h1>
  <p class="muted lead">Kalendarz dla recepcji i zapisy online.</p>
  <p class="free">Za darmo. Otwarty kod.</p>
  <div class="grow"></div>
  <a class="btn" href="/zaloz">Załóż salon</a>
  <a class="btn secondary" href="/demo">Zobacz salon demo</a>
  <p class="foot">Masz już salon? <a href="/login">Zaloguj się</a></p>
</main>

<style>
  .land {
    max-width: 440px;
    margin: 0 auto;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 24px 24px 32px;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 8px;
    height: 44px;
    font-weight: 700;
    font-size: 17px;
  }
  h1 {
    margin-top: 40px;
    font-size: 32px;
    line-height: 1.15;
    font-weight: 700;
    letter-spacing: -0.02em;
  }
  .lead {
    font-size: 17px;
  }
  .free {
    font-size: 17px;
    font-weight: 600;
    color: var(--accent);
  }
  .grow {
    flex-grow: 1;
    min-height: 32px;
  }
  .foot {
    margin-top: 8px;
    text-align: center;
    font-size: 15px;
    color: var(--muted);
  }
  .foot a {
    font-weight: 600;
  }
</style>
