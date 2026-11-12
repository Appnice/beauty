<script lang="ts">
  // The beauty mark (same drawing as static/icons/icon.svg): a "b" over the full vote2build meter
  // (the yellow bar = the idea reached its threshold; every vote2build product carries it).
  let { size = 28 }: { size?: number } = $props();
</script>

<svg
  class="logo"
  width={size}
  height={size}
  viewBox="0 0 512 512"
  style:border-radius="{Math.round(size * 0.22)}px"
  aria-hidden="true"
>
  <rect width="512" height="512" fill="#8A3A5A" />
  <rect y="400" width="512" height="112" fill="#FFD21F" />
  <rect y="392" width="512" height="12" fill="#141413" />
  {#if size >= 40}
    <path fill="#141413" d="M98 404h8v108h-8zM200 404h8v108h-8zM304 404h8v108h-8zM406 404h8v108h-8z" />
  {/if}
  <g transform="translate(0 -26)">
    <path d="M168 106v196h52V106z" fill="#FFFFFF" />
    <circle cx="194" cy="106" r="26" fill="#FFFFFF" />
    <circle cx="256" cy="302" r="62" fill="none" stroke="#FFFFFF" stroke-width="52" />
  </g>
</svg>

<style>
  .logo {
    display: block;
    flex-shrink: 0;
    overflow: hidden;
  }
</style>
