<script lang="ts">
  // On/off switch (Godziny.dc.html): 48 x 28 track in a 44 px touch target.
  let {
    on = $bindable(false),
    label,
    onchange
  }: { on?: boolean; label: string; onchange?: (on: boolean) => void } = $props();
</script>

<button
  type="button"
  role="switch"
  aria-checked={on}
  aria-label={label}
  class="hit"
  onclick={() => {
    on = !on;
    onchange?.(on);
  }}
>
  <span class="track" class:on><span class="knob"></span></span>
</button>

<style>
  .hit {
    width: 48px;
    height: var(--tap);
    border: 0;
    background: transparent;
    padding: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .track {
    width: 48px;
    height: 28px;
    border-radius: 14px;
    background: var(--track-off);
    display: flex;
    align-items: center;
    justify-content: flex-start;
    padding: 3px;
  }
  .track.on {
    background: var(--accent);
    justify-content: flex-end;
  }
  .knob {
    width: 22px;
    height: 22px;
    border-radius: 11px;
    background: #fff;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.2);
  }
</style>
