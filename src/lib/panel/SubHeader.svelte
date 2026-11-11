<script lang="ts">
  import Icon from '$lib/ui/Icon.svelte';
  let { slug, title }: { slug: string; title: string } = $props();
</script>

<div class="sub">
  <a class="icon-btn" href="/{slug}/panel/ustawienia" aria-label="Wstecz"><Icon name="back" /></a>
  <h1>{title}</h1>
</div>

<style>
  .sub {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-left: -10px;
  }
  h1 {
    font-size: 28px;
    font-weight: 700;
    letter-spacing: -0.01em;
  }
</style>
