<script lang="ts">
  // The waiting screen (Gotowe.dc.html): the calendar works now, online booking after the approval.
  import Icon from '$lib/ui/Icon.svelte';
  import { w } from './state.svelte';
  let { open }: { open: () => void } = $props();
</script>

<main class="wiz done">
  <span class="ring"><Icon name="clock" size={34} stroke={2.2} color="#8A3A5A" /></span>
  <h1>Sprawdzamy salon</h1>
  <p class="lead center">Dostaniesz SMS, zwykle tego samego dnia.</p>

  <div class="card">
    <div class="line border">
      <Icon name="check" size={22} stroke={2.4} color="#2E7D4F" />
      <span class="what">Kalendarz</span>
      <span class="ok">działa</span>
    </div>
    <div class="line">
      <Icon name="clock" size={22} color="#6E655F" />
      <span class="what">Zapisy online</span>
      <span class="wait">po akceptacji</span>
    </div>
  </div>

  <div class="grow"></div>
  <button class="btn" onclick={open} disabled={!w.done}>Otwórz kalendarz</button>
</main>

<style>
  .done {
    align-items: center;
    padding-top: 96px;
  }
  .ring {
    width: 72px;
    height: 72px;
    border-radius: 36px;
    background: var(--accent-soft);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  h1 {
    margin: 24px 0 8px;
    text-align: center;
  }
  .center {
    text-align: center;
  }
  .card {
    margin-top: 32px;
    width: 100%;
    border: 1.5px solid var(--line-strong);
    border-radius: 18px;
    background: var(--surface);
    overflow: hidden;
  }
  .line {
    height: 60px;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 16px;
  }
  .line.border {
    box-sizing: content-box; /* as in the design: the border adds to the 60 px */
    border-bottom: 1px solid var(--row-line);
  }
  .what {
    flex-grow: 1;
    font-size: 16px;
    font-weight: 600;
  }
  .ok {
    font-size: 15px;
    color: #2e7d4f;
    font-weight: 600;
  }
  .wait {
    font-size: 15px;
    color: var(--muted);
    font-weight: 600;
  }
</style>
