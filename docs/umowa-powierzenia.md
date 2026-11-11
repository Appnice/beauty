# Umowa powierzenia przetwarzania danych osobowych (wzór)

Wzór dla hostowanej instancji. Przed użyciem uzupełnij pola w nawiasach i daj go do przejrzenia prawnikowi.
Wersja self-hosted: salon sam utrzymuje serwer, więc tej umowy nie potrzebuje (chyba że zleca hosting komuś innemu).

## Strony

1. **Administrator:** [nazwa salonu], [adres], NIP [numer], reprezentowany przez [imię i nazwisko]
   („Salon”).
2. **Podmiot przetwarzający:** [nazwa operatora instancji], [adres], NIP [numer] („Operator”).

Umowa jest zawarta na podstawie art. 28 rozporządzenia (UE) 2016/679 (RODO).

## § 1. Przedmiot

1. Salon powierza Operatorowi przetwarzanie danych osobowych swoich klientów i pracowników w systemie zapisów
   pod adresem [adres instancji]/[adres salonu].
2. Operator przetwarza dane wyłącznie po to, żeby utrzymywać system: przechowywać dane, wysyłać SMS-y z kodami,
   potwierdzeniami i przypomnieniami, robić kopie zapasowe.

## § 2. Zakres danych

| Kogo dotyczą | Jakie dane |
|---|---|
| Klienci salonu | imię, numer telefonu, notatka salonu, wizyty (usługa, osoba, termin, status), treść i status SMS-ów |
| Pracownicy salonu | imię, numer telefonu, hasło (tylko skrót), grafik, urlopy i przerwy |

Operator nie przetwarza danych szczególnych kategorii (art. 9 RODO). Salon nie wpisuje ich w notatkach.

## § 3. Obowiązki Operatora

1. Przetwarza dane tylko na udokumentowane polecenie Salonu. Tą umową i ustawieniami w panelu Salon wydaje takie
   polecenie.
2. Zapewnia, że osoby z dostępem do danych zobowiązały się do poufności.
3. Stosuje środki z art. 32 RODO, co najmniej:
   - szyfrowane połączenie (HTTPS) do aplikacji;
   - dane każdego salonu oddzielone w bazie (każdy wiersz ma identyfikator salonu, zapytania filtrują po nim);
   - hasła tylko jako skróty (scrypt), kody SMS tylko jako skróty;
   - linki do wizyt podpisane kluczem serwera;
   - limity prób (kody SMS, logowanie, rezerwacje);
   - szyfrowane kopie zapasowe, przechowywane najwyżej [liczba] dni.
4. Pomaga Salonowi odpowiadać na żądania osób (dostęp, sprostowanie, usunięcie). Panel ma przycisk „Usuń dane
   klienta”: usuwa imię, numer i notatkę, a wizyta zostaje tylko z terminem i usługą.
5. Zgłasza Salonowi naruszenie ochrony danych bez zbędnej zwłoki, nie później niż w ciągu 36 godzin od jego
   wykrycia.
6. Udostępnia Salonowi informacje potrzebne do wykazania zgodności z art. 28 RODO i pozwala na audyt po
   uprzedzeniu z [liczba] dniowym wyprzedzeniem.

## § 4. Dalsze podmioty przetwarzające

Salon zgadza się na te podmioty:

| Podmiot | Po co | Gdzie |
|---|---|---|
| [dostawca serwera, np. Hostinger] | serwer i baza danych | [kraj w EOG] |
| [bramka SMS, np. SMSAPI.pl] | wysyłka SMS-ów | Polska |

Operator informuje Salon o planowanej zmianie z co najmniej 14-dniowym wyprzedzeniem. Salon może się sprzeciwić
i wypowiedzieć umowę. Operator nie przekazuje danych poza Europejski Obszar Gospodarczy.

## § 5. Czas trwania i koniec umowy

1. Umowa obowiązuje tak długo, jak Salon korzysta z hostowanej instancji.
2. Po jej końcu Operator na żądanie Salonu oddaje dane (eksport) i usuwa je w ciągu 30 dni, także z kopii
   zapasowych po ich naturalnym wygaśnięciu. Salon odrzucony przy zakładaniu jest usuwany po 30 dniach.

## § 6. Odpowiedzialność

Każda strona odpowiada za szkody, które wyrządziła, zgodnie z art. 82 RODO.

## Podpisy

| Salon | Operator |
|---|---|
| [data, podpis] | [data, podpis] |
