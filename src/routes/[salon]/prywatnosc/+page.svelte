<script lang="ts">
  // Privacy (RODO) for the clients of one salon. Plain words, short.
  import { phoneLocal } from '$lib/pl';
  let { data } = $props();
  const s = $derived(data.salon);
  const where = $derived([s.street, s.city].filter(Boolean).join(', '));
</script>

<svelte:head>
  <title>Prywatność · {s.name}</title>
  {#if !data.online}<meta name="robots" content="noindex" />{/if}
</svelte:head>

<main class="wiz doc">
  <a class="bar" href="/{s.slug}">{s.name}</a>
  <h1 style="margin: 32px 0 20px">Prywatność</h1>

  <h2>Kto ma Twoje dane</h2>
  <p>
    Administratorem danych jest salon {s.name}{where ? `, ${where}` : ''}{s.phone
      ? `, tel. ${phoneLocal(s.phone)}`
      : ''}. Salon przetwarza dane na swoje potrzeby: wizyty i przypomnienia.
  </p>
  <p>
    System zapisów utrzymuje {data.operator}. Przetwarza dane tylko na zlecenie salonu (umowa powierzenia,
    art. 28 RODO) i nie używa ich do niczego innego.
  </p>

  <h2>Jakie dane</h2>
  <p>Imię, numer telefonu, wizyty (usługa, osoba, termin) i SMS-y o tych wizytach.</p>

  <h2>Po co</h2>
  <p>
    Żeby zapisać Cię na wizytę, potwierdzić numer kodem SMS, przypomnieć o wizycie i dać link do odwołania
    (art. 6 ust. 1 lit. b RODO).
  </p>

  <h2>Jak długo</h2>
  <p>Dopóki jesteś klientem salonu albo do Twojej prośby o usunięcie.</p>

  <h2>Twoje prawa</h2>
  <p>
    Możesz poprosić salon o wgląd, poprawienie albo usunięcie danych. Po usunięciu salon zachowuje tylko
    termin i usługę, bez Twojego imienia i numeru. Możesz złożyć skargę do Prezesa UODO.
  </p>

  <h2>Pliki cookie</h2>
  <p>Strona zapisów nie używa cookie do śledzenia ani reklam.</p>
</main>

<style>
  .bar {
    height: 44px;
    display: flex;
    align-items: center;
    font-weight: 700;
    font-size: 17px;
    color: var(--ink);
    text-decoration: none;
  }
  .doc h2 {
    margin: 22px 0 6px;
    font-size: 17px;
    font-weight: 700;
  }
  .doc p {
    margin: 0 0 8px;
    font-size: 16px;
    line-height: 1.5;
    color: var(--ink);
  }
</style>
