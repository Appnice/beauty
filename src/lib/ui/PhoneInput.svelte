<script lang="ts">
  // "+48 | 600 123 456" field from Main.dc.html. The value is the 9 local digits with spaces.
  import { groupDigits } from '$lib/pl';
  import { page } from '$app/state';
  import { i18n } from '$lib/i18n';
  let {
    value = $bindable(''),
    label,
    name = 'phone',
    autofocus = false
  }: { value?: string; label?: string; name?: string; autofocus?: boolean } = $props();
  const L = $derived(i18n(page.data.lang));
</script>

<label class="field">
  {label ?? L.t.common.yourPhone}
  <div class="box">
    <span class="cc">+48</span>
    <!-- svelte-ignore a11y_autofocus -->
    <input
      {name}
      {value}
      oninput={(e) => {
        value = groupDigits(e.currentTarget.value);
        e.currentTarget.value = value;
      }}
      inputmode="tel"
      autocomplete="tel-national"
      {autofocus}
    />
  </div>
</label>

<style>
  .box {
    display: flex;
    height: var(--btn-h);
    border: 1.5px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--surface);
    overflow: hidden;
  }
  .box:focus-within {
    border-color: var(--accent);
  }
  .cc {
    display: flex;
    align-items: center;
    padding: 0 14px;
    font-size: 18px;
    font-weight: 600;
    color: var(--muted);
    border-right: 1.5px solid var(--line);
  }
  input {
    flex-grow: 1;
    min-width: 0;
    border: 0;
    padding: 0 14px;
    font-size: 18px;
    font-weight: 600;
    color: var(--ink);
    outline: none;
    background: transparent;
  }
</style>
