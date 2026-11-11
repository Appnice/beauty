<script lang="ts">
  import { toast } from './toast.svelte.ts';
</script>

{#if toast.text}
  <div class="toast" class:error={toast.kind === 'error'} role="status" data-testid="toast">{toast.text}</div>
{/if}

<style>
  .toast {
    position: fixed;
    left: 50%;
    bottom: 24px;
    transform: translateX(-50%);
    max-width: calc(100vw - 32px);
    padding: 14px 20px;
    border-radius: var(--radius);
    background: var(--ink);
    color: #fff;
    font-size: 16px;
    font-weight: 600;
    z-index: 60;
    box-shadow: 0 8px 24px rgba(34, 28, 25, 0.25);
  }
  .toast.error {
    background: var(--danger);
  }
</style>
