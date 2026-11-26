// Polish texts: signup (the "Załóż salon" wizard).
import { plural } from '../../pl.ts';

export const signup = {
  title: 'Załóż salon',
  closed: 'Zakładanie salonów jest zamknięte',
  login: 'Zaloguj się',
  next: 'Dalej',
  add: 'Dodaj',
  main: {
    title: 'Załóż salon',
    lead: 'Za darmo. 3 minuty.',
    name: 'Nazwa salonu',
    slugPlaceholder: 'twoj-salon',
    phone: 'Twój telefon',
    password: 'Hasło',
    invite: 'Kod zaproszenia',
    website: 'Strona',
    haveSalon: 'Masz już salon?',
    errors: {
      full: 'Dużo zgłoszeń. Spróbuj jutro.',
      name: 'Podaj nazwę salonu.',
      phone: 'Podaj numer telefonu: 9 cyfr.',
      password: 'Hasło musi mieć co najmniej 8 znaków.'
    }
  },
  code: {
    title: 'Wpisz kod z SMS',
    sentTo: (phone: string) => `Wysłaliśmy go na ${phone}`,
    resendIn: (seconds: number) => `Nie doszedł? Wyślij ponownie za 0:${String(seconds).padStart(2, '0')}`,
    notArrived: 'Nie doszedł?',
    resend: 'Wyślij ponownie',
    errors: {
      digits: 'Wpisz 6 cyfr.'
    }
  },
  salon: {
    title: 'O salonie',
    city: 'Miejscowość',
    street: 'Ulica i numer',
    teamSize: 'Ile osób pracuje?',
    teamSizeAria: 'Ile osób pracuje',
    link: 'Instagram, Facebook lub strona',
    about: 'Czym się zajmujecie?',
    errors: {
      city: 'Podaj miejscowość.',
      teamSize: 'Zaznacz, ile osób pracuje.',
      link: 'Sprawdź link. Wpisz adres strony albo @nazwę.',
      about: 'Napisz, czym się zajmujecie.'
    }
  },
  services: {
    title: 'Co robicie?',
    lead: 'Zaznacz. Czas zmienisz później.',
    /** Proposed services, in the order of PRESET_MINUTES (state.svelte.ts). The ticked names are saved. */
    presets: [
      'Strzyżenie damskie',
      'Strzyżenie męskie',
      'Koloryzacja',
      'Modelowanie',
      'Manicure hybrydowy',
      'Pedicure',
      'Brwi i rzęsy'
    ],
    name: 'Nazwa usługi',
    addOwn: 'Dodaj swoją',
    next: (n: number) => `Dalej · ${n} ${plural(n, 'usługa', 'usługi', 'usług')}`,
    errors: {
      none: 'Zaznacz co najmniej jedną usługę.'
    }
  },
  team: {
    title: 'Kto pracuje?',
    lead: 'Każda osoba to kolumna w kalendarzu.',
    you: 'Ty',
    /** The owner's column when the salon name gives no first name. Saved as the person's name. */
    me: 'Ja',
    remove: 'Usuń',
    name: 'Imię',
    alone: 'Pracujesz sama? Też dobrze.'
  },
  hours: {
    title: 'Kiedy otwarte?',
    lead: 'Stuknij godzinę, żeby zmienić.',
    send: 'Wyślij do akceptacji',
    done: 'Gotowe',
    errors: {
      noDay: 'Salon musi być otwarty co najmniej jeden dzień.',
      password: 'Wpisz hasło jeszcze raz.'
    }
  },
  done: {
    title: 'Sprawdzamy salon',
    lead: 'Dostaniesz SMS, zwykle tego samego dnia.',
    calendar: 'Kalendarz',
    works: 'działa',
    online: 'Zapisy online',
    after: 'po akceptacji',
    open: 'Otwórz kalendarz'
  }
};
