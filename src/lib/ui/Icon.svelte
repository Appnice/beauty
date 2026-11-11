<script lang="ts" module>
  // Stroke icons, the same paths as in docs/design/*.dc.html.
  const ICONS: Record<string, string> = {
    calendar:
      '<rect x="3" y="5" width="18" height="16" rx="3"></rect><path d="M8 3v4M16 3v4M3 10h18"></path>',
    clock: '<circle cx="12" cy="12" r="9"></circle><path d="M12 7v5l3 2"></path>',
    sliders:
      '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"></path><circle cx="16" cy="7" r="2"></circle><circle cx="10" cy="17" r="2"></circle>',
    back: '<path d="M15 18l-6-6 6-6"></path>',
    forward: '<path d="M9 6l6 6-6 6"></path>',
    close: '<path d="M6 6l12 12M18 6L6 18"></path>',
    plus: '<path d="M12 5v14M5 12h14"></path>',
    check: '<path d="M5 12l5 5 9-10"></path>',
    link: '<path d="M10 14a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"></path><path d="M14 10a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"></path>',
    copy: '<rect x="9" y="9" width="12" height="12" rx="2"></rect><path d="M5 15V5a2 2 0 0 1 2-2h8"></path>',
    scissors:
      '<path d="M6 3l12 12M6 15l12-12M4 18a2 2 0 1 0 4 0a2 2 0 1 0-4 0M16 18a2 2 0 1 0 4 0a2 2 0 1 0-4 0"></path>',
    team: '<path d="M9 11a4 4 0 1 0 0-8a4 4 0 0 0 0 8M2 21a7 7 0 0 1 14 0M17 3a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3"></path>',
    hours: '<path d="M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18M12 7v5l3 2"></path>',
    logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 17l5-5-5-5M15 12H3"></path>',
    send: '<path d="M22 2L11 13M22 2l-7 20-4-9-9-4z"></path>',
    pause: '<path d="M8 5v14M16 5v14"></path>',
    pin: '<path d="M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21z"></path><circle cx="12" cy="9.5" r="2.5"></circle>',
    phone:
      '<path d="M5 3h4l2 5-2.5 1.5a11 11 0 0 0 6 6L16 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z"></path>'
  };
</script>

<script lang="ts">
  let {
    name,
    size = 24,
    stroke = 2,
    color = 'currentColor'
  }: { name: string; size?: number; stroke?: number; color?: string } = $props();
</script>

<svg
  width={size}
  height={size}
  viewBox="0 0 24 24"
  fill="none"
  stroke={color}
  stroke-width={stroke}
  stroke-linecap="round"
  stroke-linejoin="round"
  aria-hidden="true"
>
  <!-- eslint-disable-next-line svelte/no-at-html-tags -->
  {@html ICONS[name] ?? ''}
</svg>
