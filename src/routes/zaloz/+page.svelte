<script lang="ts">
  // "Załóż salon": 6 steps + the waiting screen. The step is in the URL (?krok=N), so the phone's Back works.
  import { goto } from '$app/navigation';
  import { page } from '$app/state';
  import { onMount } from 'svelte';
  import { api } from '$lib/api';
  import { clear, load, save, w } from '$lib/signup/state.svelte';
  import StepMain from '$lib/signup/StepMain.svelte';
  import StepKod from '$lib/signup/StepKod.svelte';
  import StepSalon from '$lib/signup/StepSalon.svelte';
  import StepUslugi from '$lib/signup/StepUslugi.svelte';
  import StepZespol from '$lib/signup/StepZespol.svelte';
  import StepGodziny from '$lib/signup/StepGodziny.svelte';
  import StepGotowe from '$lib/signup/StepGotowe.svelte';

  load();
  let st = $state<{ open: boolean; needsCode: boolean; full: boolean; approval: boolean } | null>(null);
  onMount(async () => {
    const r = await api<{ open: boolean; needsCode: boolean; full: boolean; approval: boolean }>(
      'GET',
      '/api/signup'
    );
    st = r.ok ? r.data : { open: true, needsCode: false, full: false, approval: true };
  });

  const asked = $derived(Number(page.url.searchParams.get('krok') ?? 1) || 1);
  const step = $derived(w.done ? 7 : Math.min(Math.max(asked, 1), w.reached));

  $effect(() => {
    // mirror every change of the wizard object
    JSON.stringify(w);
    save();
  });

  function to(n: number) {
    w.reached = Math.max(w.reached, n);
    goto(`/zaloz?krok=${n}`);
  }
  const back = () => history.back();
  function finished() {
    if (st && !st.approval) return openPanel();
    to(7);
  }
  function openPanel() {
    const slug = w.done?.slug;
    clear();
    goto(`/${slug}/panel`);
  }
</script>

<svelte:head>
  <title>Załóż salon</title>
  <meta name="robots" content="noindex" />
</svelte:head>

{#if st && !st.open}
  <main class="wiz">
    <h1 style="margin-top: 40px">Zakładanie salonów jest zamknięte</h1>
    <div class="grow"></div>
    <a class="btn" href="/login">Zaloguj się</a>
  </main>
{:else if st}
  {#if step === 1}
    <StepMain next={() => to(2)} needsCode={st.needsCode} full={st.full} />
  {:else if step === 2}
    <StepKod next={() => to(3)} {back} />
  {:else if step === 3}
    <StepSalon next={() => to(4)} {back} />
  {:else if step === 4}
    <StepUslugi next={() => to(5)} {back} />
  {:else if step === 5}
    <StepZespol next={() => to(6)} {back} />
  {:else if step === 6}
    <StepGodziny done={finished} {back} goto={to} approval={st.approval} />
  {:else}
    <StepGotowe open={openPanel} />
  {/if}
{/if}
