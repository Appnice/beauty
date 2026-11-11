<script lang="ts">
  import DayView from '$lib/panel/DayView.svelte';
  import StylistDay from '$lib/panel/StylistDay.svelte';
  let { data } = $props();
</script>

{#if data.me.role === 'manager'}
  <DayView slug={data.salon.slug} />
{:else}
  <StylistDay slug={data.salon.slug} name={data.me.name} />
{/if}
