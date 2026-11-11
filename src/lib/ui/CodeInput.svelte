<script lang="ts">
  // 6 boxes for the SMS code (Kod.dc.html). Typing moves on; a pasted code fills all boxes.
  let { value = $bindable(''), oncomplete }: { value?: string; oncomplete?: (code: string) => void } =
    $props();
  let boxes: HTMLInputElement[] = $state([]);
  const digits = $derived(Array.from({ length: 6 }, (_, i) => value[i] ?? ''));

  function set(code: string) {
    value = code.replace(/\D/g, '').slice(0, 6);
    const next = Math.min(value.length, 5);
    boxes[next]?.focus();
    if (value.length === 6) oncomplete?.(value);
  }

  function input(i: number, e: Event & { currentTarget: HTMLInputElement }) {
    const typed = e.currentTarget.value.replace(/\D/g, '');
    e.currentTarget.value = typed.slice(0, 1);
    set(value.slice(0, i) + typed);
  }

  function keydown(i: number, e: KeyboardEvent) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      e.preventDefault();
      value = value.slice(0, i - 1);
      boxes[i - 1]?.focus();
    }
  }
</script>

<div class="grid">
  {#each digits as d, i (i)}
    <input
      bind:this={boxes[i]}
      aria-label="Cyfra {i + 1}"
      value={d}
      inputmode="numeric"
      autocomplete={i === 0 ? 'one-time-code' : 'off'}
      maxlength={i === 0 ? 6 : 1}
      class:current={i === Math.min(value.length, 5)}
      oninput={(e) => input(i, e)}
      onkeydown={(e) => keydown(i, e)}
      onfocus={(e) => {
        if (i > value.length) boxes[Math.min(value.length, 5)]?.focus();
        else e.currentTarget.select();
      }}
    />
  {/each}
</div>

<style>
  .grid {
    display: grid;
    grid-template-columns: repeat(6, minmax(0, 1fr));
    gap: 8px;
  }
  input {
    height: 64px;
    width: 100%;
    min-width: 0;
    text-align: center;
    border: 1.5px solid var(--line-strong);
    border-radius: var(--radius);
    background: var(--surface);
    font-size: 26px;
    font-weight: 600;
    color: var(--ink);
    outline: none;
  }
  input.current:focus,
  input.current {
    border: 2px solid var(--accent);
  }
</style>
