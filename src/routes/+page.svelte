<script lang="ts">
  import { page } from '$app/state';
  import { i18n } from '$lib/i18n';
  import LangSwitch from '$lib/ui/LangSwitch.svelte';
  import Logo from '$lib/ui/Logo.svelte';

  const L = $derived(i18n(page.data.lang));
  const t = $derived(L.t.landing);
  // the two screens in the mock-up: Polish, or their English twins (docs/screens/en, tests/e2e/english.spec.ts)
  const shot = $derived(L.lang === 'en' ? '-en' : '');
</script>

<svelte:head>
  <title>{t.title}</title>
  <meta name="description" content={t.description} />
</svelte:head>

<main class="land">
  <header class="top">
    <div class="brand"><Logo /> beauty</div>
    <div class="top-right">
      <LangSwitch />
      <a class="login-top" href="/login">{t.login}</a>
    </div>
  </header>

  <section class="hero">
    <div class="copy">
      <h1>{t.h1}</h1>
      <p class="muted lead">{t.lead}</p>
      <p class="free">{t.free}</p>
      <img
        class="mobile-shot"
        src="/landing/panel{shot}.png"
        alt=""
        width="1024"
        height="768"
        aria-hidden="true"
      />
      <div class="grow"></div>
      <div class="actions">
        <a class="btn" href="/zaloz">{t.create}</a>
        <a class="btn secondary" href="/demo">{t.demo}</a>
      </div>
      <p class="foot">{t.haveSalon} <a href="/login">{t.login}</a></p>
    </div>

    <div class="shots" aria-hidden="true">
      <img class="panel" src="/landing/panel{shot}.png" alt="" width="1024" height="768" />
      <img class="phone" src="/landing/telefon{shot}.png" alt="" width="390" height="844" />
    </div>
  </section>

  <ul class="facts">
    <li><strong>{t.facts.calendar}</strong><span>{t.facts.calendarNote}</span></li>
    <li><strong>{t.facts.online}</strong><span>{t.facts.onlineNote}</span></li>
    <li><strong>{t.facts.phone}</strong><span>{t.facts.phoneNote}</span></li>
    <li><strong>{t.facts.fee}</strong><span>{t.facts.feeNote}</span></li>
  </ul>

  <a class="v2b" href={L.v2b}>
    <span class="stamp" aria-hidden="true">V2B</span>
    <span>{t.v2b}</span>
    <span class="src">vote2build #001</span>
  </a>
</main>

<style>
  .land {
    max-width: 440px;
    margin: 0 auto;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    padding: 24px 24px 32px;
  }
  .top {
    display: flex;
    align-items: center;
    justify-content: space-between;
    height: 44px;
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 8px;
    font-weight: 700;
    font-size: 17px;
  }
  .top-right {
    display: flex;
    align-items: center;
    gap: 20px;
  }
  .login-top {
    display: none;
    font-weight: 600;
  }
  .hero {
    flex-grow: 1;
    display: flex;
  }
  .copy {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  h1 {
    margin-top: 40px;
    font-size: 32px;
    line-height: 1.15;
    font-weight: 700;
    letter-spacing: -0.02em;
  }
  .lead {
    font-size: 17px;
  }
  .free {
    font-size: 17px;
    font-weight: 600;
    color: var(--accent);
  }
  .grow {
    flex-grow: 1;
    min-height: 32px;
  }
  .actions {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .foot {
    margin-top: 8px;
    text-align: center;
    font-size: 15px;
    color: var(--muted);
  }
  .foot a {
    font-weight: 600;
  }
  .mobile-shot {
    display: block;
    width: 100%;
    height: auto;
    margin-top: 20px;
    border: 1px solid var(--line);
    border-radius: 14px;
    box-shadow: 0 12px 32px rgba(34, 28, 25, 0.12);
  }
  .shots,
  .facts {
    display: none;
  }
  /* the vote2build signature: the same yellow V2B stamp as in the logo, same words in every product */
  .v2b {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px 10px;
    min-height: 44px;
    margin-top: 20px;
    font-size: 14px;
    color: var(--muted);
    text-decoration: none;
  }
  .v2b .stamp {
    transform: rotate(-6deg);
    padding: 1px 6px;
    border: 2px solid #141413;
    border-radius: 4px;
    background: #ffd21f;
    color: #141413;
    font-size: 12px;
    font-weight: 800;
    letter-spacing: 0.04em;
  }
  .v2b .src {
    font-weight: 600;
    color: var(--ink);
    text-decoration: underline;
    text-underline-offset: 3px;
  }

  @media (min-width: 960px) {
    .land {
      max-width: 1200px;
      padding: 28px 48px 56px;
    }
    .login-top {
      display: inline-flex;
      align-items: center;
      min-height: 44px;
    }
    .hero {
      flex-grow: 0;
      display: grid;
      grid-template-columns: minmax(0, 5fr) minmax(0, 7fr);
      gap: 56px;
      align-items: center;
      margin-top: 72px;
    }
    .copy {
      flex-grow: 0;
      gap: 16px;
    }
    h1 {
      margin-top: 0;
      font-size: 56px;
      line-height: 1.05;
    }
    .lead,
    .free {
      font-size: 20px;
    }
    .grow {
      display: none;
    }
    .actions {
      flex-direction: row;
      flex-wrap: wrap;
      margin-top: 20px;
    }
    .actions .btn {
      flex: 0 0 auto;
      padding: 0 28px;
      white-space: nowrap;
    }
    .mobile-shot {
      display: none;
    }
    .foot {
      display: none;
    }
    .shots {
      display: block;
      position: relative;
      padding: 0 0 48px 0;
    }
    .shots img {
      display: block;
      height: auto;
      border-radius: 18px;
      box-shadow:
        0 1px 2px rgba(34, 28, 25, 0.08),
        0 18px 48px rgba(34, 28, 25, 0.14);
    }
    .panel {
      width: 100%;
      border: 1px solid var(--line);
    }
    .phone {
      position: absolute;
      right: -24px;
      bottom: 0;
      width: 30%;
      border: 6px solid #221c19;
      border-radius: 28px !important;
    }
    .facts {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 16px;
      margin-top: 72px;
      padding: 0;
      list-style: none;
    }
    .facts li {
      display: flex;
      flex-direction: column;
      gap: 4px;
      padding: 20px;
      border: 1.5px solid var(--line-strong, #e0d8d1);
      border-radius: 18px;
      background: #fff;
    }
    .facts strong {
      font-size: 18px;
    }
    .facts span {
      font-size: 15px;
      color: var(--muted);
    }
  }
</style>
