# Zapisy do salonu (nazwa robocza: beauty)

Darmowy, otwarty system zapisów dla małych salonów: kalendarz dla recepcji zamiast papierowego grafiku
i strona, na której klient sam rezerwuje wizytę. Bez prowizji i bez abonamentu za oprogramowanie.

> Stan: wczesna wersja. Gotowe: jądro na serwerze i JSON API, „Załóż salon” (6 kroków na telefonie), akceptacja
> nowych salonów w `/admin`, panel właściciela (kalendarz dnia i tygodnia, nowa wizyta, przeciąganie, „Czekają na
> Ciebie”, ustawienia), widok fryzjerki na telefon, logowanie, strona rezerwacji dla klienta (`/<salon>`) ze
> stroną wizyty z linku w SMS-ie i przypomnieniami SMS, paczka Dockera do własnego serwera i do wdrożenia.

## Rezerwacja online

Klient wchodzi na `/<salon>` i wybiera po kolei: usługę, osobę (albo „Obojętnie”), dzień i godzinę (tylko wolne
terminy, w które mieści się usługa), imię i telefon, kod z SMS-a. Na końcu widzi „Wizyta potwierdzona” albo
„Czeka na potwierdzenie salonu” i może dodać wizytę do kalendarza (.ics). SMS-y mają link `/w/<kod>` do strony
wizyty: szczegóły, status, „Odwołaj wizytę” (do 2 godzin przed wizytą) i „Zarezerwuj ponownie”.

- SMS-y bez polskich znaków, najwyżej 160 znaków (długie nazwy są skracane, link zostaje cały).
- Przypomnienie dzień przed wizytą wychodzi między 17:00 a 21:00; między 21:00 a 8:00 nie wychodzi żaden SMS.
- Limity: kody SMS na numer i na IP, 3 rezerwacje na numer na dobę, miesięczny pakiet SMS salonu
  (`SMS_MONTHLY_LIMIT`; po jego wyczerpaniu licznik w ustawieniach jest czerwony).
- RODO: strona `/<salon>/prywatnosc`, zgoda przy formularzu, usuwanie danych klienta z karty wizyty w panelu
  (wizyta zostaje bez imienia i numeru), wzór umowy powierzenia w `docs/umowa-powierzenia.md`.

## Nowe salony czekają na akceptację

Na instancji z wieloma salonami nowy salon ma status „czeka”. Właścicielka od razu korzysta z kalendarza, ale
zapisy online i SMS-y do klientów ruszają dopiero po akceptacji w `/admin` (hasło `ADMIN_PASSWORD`). Odrzucony
salon nie może się zalogować, a jego dane znikają po 30 dniach. Ochrona przed spamem: jeden salon na numer,
najwyżej 3 zgłoszenia z jednego IP na dobę i 30 czekających salonów naraz. W instalacji dla jednego salonu
(`SINGLE_SALON=on`) akceptacji nie ma.

## Co jest w środku

- Jedna aplikacja SvelteKit (TypeScript) i jedna baza PostgreSQL 16. Zadania w tle (przypomnienia SMS) w tej samej
  bazie (pg-boss). Bez Redisa i mikroserwisów.
- Baza sama pilnuje, żeby jedna osoba nie miała dwóch wizyt naraz.
- SMS-y przez wymienny adapter. Domyślnie `log`: wiadomość trafia do bazy i do logu serwera, nic nie jest wysyłane.
  Prawdziwa bramka: SMSAPI.pl (`SMS_PROVIDER=smsapi` i `SMSAPI_TOKEN`).

## Własny serwer (jeden salon)

Potrzebny tylko Docker z Compose. Node.js nie jest potrzebny.

```sh
git clone <adres repozytorium> beauty && cd beauty
cp .env.example .env      # zmień APP_SECRET i POSTGRES_PASSWORD (np. openssl rand -hex 32)
docker compose up -d      # pierwsze uruchomienie buduje obraz (kilka minut)
```

Potem otwórz http://localhost:8080 i kliknij „Załóż salon”. Pierwszy salon działa od razu (bez akceptacji),
a zakładanie kolejnych się zamyka. Bez bramki SMS kod z SMS-a jest w logu: `docker compose logs app | grep sms:log`.

- **Domena z HTTPS:** w `.env` ustaw `DOMAIN=salon.example.pl`, `PUBLIC_URL=https://salon.example.pl` i odkomentuj
  `ADDRESS_HEADER` oraz `PROTOCOL_HEADER`. Potem `docker compose --profile domain up -d`: Caddy na portach 80 i 443
  sam pobiera certyfikat. Domena musi wskazywać na ten serwer.
- **Kopia zapasowa:** `DB_CONTAINER=beauty-db-1 BACKUP_DIR=./backups tools/backup.sh` (np. co noc z crona; pliki
  starsze niż 14 dni znikają). Przywrócenie: `COMPOSE_FILE_PATH=compose.yaml COMPOSE_PROJECT=beauty tools/restore.sh <plik.dump>`.
- **Aktualizacja:** `git pull && docker compose up -d --build`. Zmiany w bazie wchodzą same przy starcie.
- **Pamięć:** aplikacja i baza mają po 256 MB limitu; wystarcza mały serwer (zmierzone szczyty w `docs/deploy.md`).

Wersja hostowana (beauty.vote2build.com) korzysta z `deploy/compose.yml`; opis w `docs/deploy.md`.

## Uruchomienie lokalne (programiści)

Potrzebne: Docker i Node.js 26.

```sh
make db                   # Postgres na 127.0.0.1:55440 (compose.dev.yaml)
make seed                 # salon demo pod /demo
make dev                  # http://localhost:8150
```

Logowanie do salonu demo: telefon `500 000 001`, hasło z `DEMO_MANAGER_PASSWORD` (domyślnie `demo1234`).
W salonie demo kody SMS są pokazywane na ekranie.

## Polecenia

| Polecenie | Co robi |
|---|---|
| `make db` | uruchamia lokalnego Postgresa (projekt Dockera `beauty-local`) |
| `make db-stop` | zatrzymuje go (dane zostają) |
| `make db-reset` | usuwa go razem z danymi |
| `make migrate` | wprowadza zmiany w bazie z katalogu `migrations/` |
| `make seed` | tworzy od nowa salon demo |
| `make dev` | serwer deweloperski na porcie 8150 |
| `make build` | wersja produkcyjna w `build/` (`node build`) |
| `make check` | sprawdzenie typów, lint i testy na lokalnej bazie |
| `make e2e` | testy w przeglądarce (Playwright, bez okna) na świeżej bazie `beauty_e2e`, zrzuty ekranów w `docs/screens/` |
| `make e2e-chain` | cały łańcuch w jednym teście: zakładanie salonu, akceptacja, rezerwacja, odwołanie |
| `make test`, `make lint`, `make typecheck`, `make format` | pojedyncze kroki |
| `make deploy-local` | wersja produkcyjna na tym komputerze za Caddy, testy dymne, pomiar pamięci, potem sprzątanie |
| `make selfhost-check` | sprawdza „cp .env.example .env && docker compose up” na świeżej kopii repozytorium |

## Ustawienia (zmienne środowiskowe)

Własny serwer: `.env.example` i `compose.yaml`. Programiści mogą trzymać swoje ustawienia w `.env.dev`
(czyta je `make`). Najważniejsze:

| Zmienna | Znaczenie |
|---|---|
| `DATABASE_URL` | adres bazy |
| `APP_SECRET` | długi losowy ciąg; podpisuje linki z SMS-ów (wymagany w produkcji) |
| `PUBLIC_URL` | publiczny adres instancji, używany w linkach w SMS-ach |
| `SMS_PROVIDER`, `SMSAPI_TOKEN`, `SMSAPI_SENDER` | bramka SMS; bez tokenu SMS-y są tylko zapisywane |
| `SMS_ECHO` | `on` = kody weryfikacyjne widoczne na ekranie (do testów bez bramki) |
| `SINGLE_SALON` | `on` = instalacja dla jednego salonu: pierwszy salon od razu działa, potem zakładanie się zamyka |
| `SIGNUP_CODE` | dodatkowe pole „Kod zaproszenia” w „Załóż salon” (puste = bez kodu) |
| `ADMIN_PASSWORD` | hasło do `/admin` (puste = brak panelu admina) |
| `ADMIN_PHONE`, `ADMIN_NOTIFY_URL` | gdzie przychodzi wiadomość o nowym salonie: SMS i/lub POST (np. temat ntfy) |
| `SMS_MONTHLY_LIMIT` | pakiet SMS na salon na miesiąc (licznik w ustawieniach); po nim kody dla klientów są odmawiane |
| `OPERATOR_NAME` | kto utrzymuje instancję (podmiot przetwarzający na stronie prywatności) |

## Licencja

Do ustalenia (MIT albo AGPL).

---

## English

A free, open-source booking system for small salons (an alternative to Booksy). One SvelteKit 2 app with
PostgreSQL 16 and pg-boss. Status: the server core, the owner sign-up with platform-admin approval (`/admin`),
the owner panel (day and week calendar, drag and drop, waiting bookings, settings), the stylist phone view and
login, and the client booking page (`/<salon>`: service, person or "Obojętnie", a free time, name + phone, SMS
code; the visit page from the SMS link with cancel until 2 h before) are done. Reminders go out from a pg-boss
cron sweep (17:00-21:00 the day before, never 21:00-8:00 Warsaw time). On the hosted instance a new salon is
`pending` until the admin accepts it (no online booking, no client SMS until then); anti-spam: one salon per
phone, 3 sign-ups per IP a day, 30 pending in total, a honeypot.

Self-hosting (one salon): `cp .env.example .env` (change APP_SECRET and POSTGRES_PASSWORD), `docker compose up -d`,
open http://localhost:8080 and sign up: the first salon is active at once, then sign-up closes. With a domain:
set DOMAIN and PUBLIC_URL and run `docker compose --profile domain up -d` (Caddy with automatic HTTPS). Backups:
`tools/backup.sh` / `tools/restore.sh`. The hosted instance uses `deploy/compose.yml`; see `docs/deploy.md`.

Development: `make db`, `make seed`, `make dev`, then open http://localhost:8150 (optional settings in `.env.dev`).
`make check` runs the type check, lint and all tests against the local Postgres; `make e2e` runs the headless
Playwright suite on a fresh `beauty_e2e` database and writes screenshots to `docs/screens/`. Self-hosters set
`SINGLE_SALON=on` (the default in `compose.yaml`). SMS goes through an adapter: the default `log` provider sends
nothing; set `SMS_PROVIDER=smsapi` and `SMSAPI_TOKEN` for real messages via SMSAPI.pl. All settings are listed
in `.env.example`.
