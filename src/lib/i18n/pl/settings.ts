// Polish texts: settings.
import { plural } from '../../pl.ts';

export const settings = {
  main: {
    services: 'Usługi',
    servicesCount: (n: number) => `${n} ${plural(n, 'usługa', 'usługi', 'usług')}`,
    team: 'Zespół',
    hours: 'Godziny otwarcia',
    link: 'Link do zapisów',
    newBookings: 'Nowe rezerwacje',
    modeAuto: 'Wpadają od razu',
    modeManual: 'Czekają na mnie',
    remindAfter: 'SMS do mnie po',
    /** `month` = L.monthsIn[...]: "SMS w listopadzie". */
    smsIn: (month: string) => `SMS w ${month}`,
    smsOf: (limit: number) => `z ${limit}`,
    /** `month` = L.monthsOfDay[...] of the next month: "1 grudnia". */
    smsLimit: (month: string) => `Limit wyczerpany. SMS-y wrócą 1 ${month}.`,
    smsNote: 'Przypomnienia o wizytach i kody.',
    logout: 'Wyloguj się'
  },
  services: {
    title: 'Usługi',
    nameLabel: 'Nazwa usługi',
    duration: 'Czas',
    remove: (name: string) => `Usuń: ${name}`,
    saved: 'Zapisano',
    removed: 'Usunięto',
    newService: 'Nowa usługa',
    add: 'Dodaj'
  },
  team: {
    title: 'Zespół',
    noPhone: 'bez telefonu',
    name: 'Imię',
    add: 'Dodaj',
    timeOff: 'Urlopy i przerwy',
    phone: 'Telefon',
    colour: 'Kolor',
    services: 'Usługi',
    save: 'Zapisz',
    remove: 'Usuń z zespołu',
    saved: 'Zapisano',
    removed: 'Usunięto z zespołu'
  },
  hours: {
    title: 'Godziny otwarcia',
    whose: 'Czyje godziny',
    salon: 'Salon',
    save: 'Zapisz',
    saved: 'Zapisano'
  },
  blocks: {
    title: 'Urlopy i przerwy',
    /** A block with no reason. */
    fallback: 'Blokada',
    remove: 'Usuń',
    who: 'Kto',
    what: 'Co',
    from: 'Od',
    day: 'Dzień',
    to: 'Do',
    add: 'Dodaj',
    added: (kind: string) => `Dodano: ${kind}`,
    /** Keys = BLOCK_KINDS, the values kept in the database (`block.reason`). */
    kinds: {
      Przerwa: 'Przerwa',
      Urlop: 'Urlop',
      Szkolenie: 'Szkolenie'
    }
  },
  link: {
    title: 'Link do zapisów',
    qr: 'Kod QR',
    copy: 'Kopiuj link',
    copied: 'Skopiowane',
    copyFailed: 'Nie udało się skopiować.',
    pending: 'Zapisy online ruszą po akceptacji'
  }
};
