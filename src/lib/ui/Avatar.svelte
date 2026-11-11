<script lang="ts">
  import { initial } from '$lib/pl';
  let { name, bg, ink, size = 28 }: { name: string; bg: string; ink: string; size?: number } = $props();
</script>

<span
  class="av"
  style:width="{size}px"
  style:height="{size}px"
  style:border-radius="{size / 2}px"
  style:background={bg}
  style:color={ink}
  style:font-size="{size >= 40 ? 17 : 13}px">{initial(name)}</span
>

<style>
  .av {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-weight: 700;
    flex-shrink: 0;
  }
</style>
