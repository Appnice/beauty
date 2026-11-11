<script lang="ts">
  import Icon from './Icon.svelte';
  let { size = 28 }: { size?: number } = $props();
</script>

<span
  class="logo"
  style:width="{size}px"
  style:height="{size}px"
  style:border-radius="{size > 32 ? 12 : 8}px"
>
  <Icon name="calendar" size={size > 32 ? 20 : 16} stroke={2.2} color="#FFFFFF" />
</span>

<style>
  .logo {
    background: var(--accent);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
</style>
