// Polish texts: booking (what a salon's client sees: the booking steps, the visit page, the privacy page).
export const booking = {
  /** A pending salon: only its name and this line. */
  soon: 'Zapisy online wkrótce',
  /** The visit status as the client reads it. Keys = the ASCII status codes of the database. */
  status: {
    potwierdzona: 'Wizyta potwierdzona',
    oczekuje: 'Czeka na potwierdzenie salonu',
    odwolana: 'Wizyta odwołana',
    zakonczona: 'Wizyta zakończona',
    nieobecnosc: 'Nieobecność'
  },
  addToCalendar: 'Dodaj do kalendarza',
  /** File name of the calendar download. */
  icsFile: 'wizyta.ics',
  service: {
    title: 'Co robimy?',
    duration: (min: number) => `${min} min`
  },
  person: {
    title: 'Do kogo?',
    any: 'Obojętnie'
  },
  time: {
    title: 'Kiedy?',
    taken: 'Ten termin jest już zajęty',
    none: 'Brak wolnych terminów.',
    later: 'Kolejne dni'
  },
  details: {
    title: 'Twoje dane',
    name: 'Imię',
    phone: 'Telefon',
    consentBefore: 'Rezerwując, zgadzasz się na ',
    consentLink: 'zasady prywatności',
    consentAfter: '.',
    needName: 'Podaj imię.',
    needPhone: 'Podaj numer telefonu: 9 cyfr.',
    next: 'Dalej',
    book: 'Zarezerwuj'
  },
  code: {
    title: 'Wpisz kod z SMS',
    sentTo: (phone: string) => `Wysłaliśmy go na ${phone}`,
    /** `time` = "0:59" */
    resendIn: (time: string) => `Nie doszedł? Wyślij ponownie za ${time}`,
    notArrived: 'Nie doszedł?',
    resend: 'Wyślij ponownie',
    needDigits: 'Wpisz 6 cyfr.',
    book: 'Zarezerwuj'
  },
  done: {
    remind: 'Przypomnimy SMS-em dzień wcześniej.',
    willSms: 'Dostaniesz SMS.',
    see: 'Zobacz wizytę',
    another: 'Zarezerwuj kolejną'
  },
  visit: {
    askCancel: 'Odwołać wizytę?',
    yesCancel: 'Tak, odwołaj',
    no: 'Nie',
    again: 'Zarezerwuj ponownie',
    cancel: 'Odwołaj wizytę',
    tooLate: 'Na odwołanie jest już za późno. Zadzwoń do salonu.'
  },
  privacy: {
    title: 'Prywatność',
    pageTitle: (salon: string) => `Prywatność · ${salon}`,
    /** Stands in the "System zapisów utrzymuje ..." sentence when OPERATOR_NAME is not set. */
    operatorFallback: 'operator tego serwera',
    whoTitle: 'Kto ma Twoje dane',
    /** `where` = "street, city" or '', `phone` = "600 100 200" or ''. */
    controller: (salon: string, where: string, phone: string) =>
      `Administratorem danych jest salon ${salon}${where ? `, ${where}` : ''}${
        phone ? `, tel. ${phone}` : ''
      }. Salon przetwarza dane na swoje potrzeby: wizyty i przypomnienia.`,
    processor: (operator: string) =>
      `System zapisów utrzymuje ${operator}. Przetwarza dane tylko na zlecenie salonu (umowa powierzenia, art. 28 RODO) i nie używa ich do niczego innego.`,
    whatTitle: 'Jakie dane',
    what: 'Imię, numer telefonu, wizyty (usługa, osoba, termin) i SMS-y o tych wizytach.',
    whyTitle: 'Po co',
    why: 'Żeby zapisać Cię na wizytę, potwierdzić numer kodem SMS, przypomnieć o wizycie i dać link do odwołania (art. 6 ust. 1 lit. b RODO).',
    howLongTitle: 'Jak długo',
    howLong: 'Dopóki jesteś klientem salonu albo do Twojej prośby o usunięcie.',
    rightsTitle: 'Twoje prawa',
    rights:
      'Możesz poprosić salon o wgląd, poprawienie albo usunięcie danych. Po usunięciu salon zachowuje tylko termin i usługę, bez Twojego imienia i numeru. Możesz złożyć skargę do Prezesa UODO.',
    cookiesTitle: 'Pliki cookie',
    cookies: 'Strona zapisów nie używa cookie do śledzenia ani reklam.'
  }
};
