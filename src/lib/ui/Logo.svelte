<script lang="ts">
  // The beauty mark (same drawing as static/icons/icon.svg): a "b" with the yellow vote2build stamp "V2B"
  // (every vote2build product carries the stamp). Under 40 px the stamp has no text (unreadable there).
  let { size = 28 }: { size?: number } = $props();
</script>

<svg class="logo" width={size} height={size} viewBox="0 0 512 512" aria-hidden="true">
  <rect width="512" height="512" rx="112" fill="#8A3A5A" />
  <path d="M142 80v166h52V80z" fill="#FFFFFF" />
  <circle cx="168" cy="80" r="26" fill="#FFFFFF" />
  <circle cx="230" cy="246" r="62" fill="none" stroke="#FFFFFF" stroke-width="52" />
  <g transform="rotate(-8 352 398)">
    <rect x="232" y="350" width="240" height="96" rx="14" fill="#FFD21F" stroke="#141413" stroke-width="12" />
    {#if size >= 40}
      <text
        x="352"
        y="421"
        text-anchor="middle"
        font-family="Arial Black, Arial, Helvetica, sans-serif"
        font-weight="900"
        font-size="66"
        letter-spacing="3"
        fill="#141413">V2B</text
      >
    {/if}
  </g>
</svg>

<style>
  .logo {
    display: block;
    flex-shrink: 0;
  }
</style>
