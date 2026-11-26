// Polish texts: panel (rail, day and week calendar, waiting list, visit sheets, the stylist's day).
import { isFemaleName, plural } from '../../pl.ts';

export const panel = {
  /** Shown while the hosted salon waits for approval. */
  pendingLine: 'Zapisy online ruszą po akceptacji',
  back: 'Wstecz',
  /** The name the server gives a client whose data was erased (`ERASED_NAME`): data, shown as it is. */
  client: (name: string): string => name,
  rail: {
    menu: 'Menu',
    calendar: 'Kalendarz',
    waiting: 'Czekają',
    settings: 'Ustawienia'
  },
  bar: {
    prevDay: 'Poprzedni dzień',
    nextDay: 'Następny dzień',
    prevWeek: 'Poprzedni tydzień',
    nextWeek: 'Następny tydzień',
    today: 'Dziś',
    view: 'Widok',
    day: 'Dzień',
    week: 'Tydzień',
    add: 'Wizyta'
  },
  day: {
    visits: (n: number): string => `${n} ${plural(n, 'wizyta', 'wizyty', 'wizyt')}`,
    onLeave: 'urlop',
    /** `weekday` comes from `L.weekdaysUntil`. */
    until: (weekday: string): string => `do ${weekday}`,
    waitingForYou: 'Czeka na Ciebie',
    addVisit: '+ Dodaj wizytę'
  },
  block: {
    /** The label of a stored block reason. The reasons of `BLOCK_KINDS` are stored in Polish. */
    kind: (reason: string): string => reason,
    fallback: 'Blokada'
  },
  status: {
    oczekuje: 'Oczekuje',
    potwierdzona: 'Potwierdzona',
    odwolana: 'Odwołana',
    nieobecnosc: 'Nieobecność',
    zakonczona: 'Zakończona'
  },
  week: {
    /** "10 – 16 listopada"; months come from `L.monthsOfDay`. */
    title: (d1: number, m1: string, d2: number, m2: string): string =>
      m1 === m2 ? `${d1} – ${d2} ${m2}` : `${d1} ${m1} – ${d2} ${m2}`
  },
  waiting: {
    title: 'Czekają na Ciebie',
    reject: 'Odrzuć',
    accept: 'Przyjmij',
    empty: 'Nic nie czeka.',
    note: 'Klient dostanie SMS od razu.',
    accepted: (name: string): string => `Przyjęta: ${name}`,
    rejected: (name: string): string => `Odrzucona: ${name}`
  },
  newVisit: {
    title: 'Nowa wizyta',
    who: 'Kto',
    time: 'Godzina',
    phone: 'Telefon',
    name: 'Imię',
    service: 'Usługa',
    minutes: (n: number): string => `${n} min`,
    /** "była 5 razy" / "był 5 razy" under a returning client's name. */
    been: (name: string, n: number): string =>
      `${isFemaleName(name) ? 'była' : 'był'} ${n} ${plural(n, 'raz', 'razy', 'razy')}`,
    save: 'Zapisz',
    saved: (time: string): string => `Zapisano: ${time}`,
    needName: 'Podaj imię.',
    needService: 'Wybierz usługę.'
  },
  visit: {
    note: 'Notatka',
    saveNote: 'Zapisz notatkę',
    accept: 'Przyjmij',
    reject: 'Odrzuć',
    finish: 'Zakończona',
    noShow: (name: string): string => (isFemaleName(name) ? 'Nie przyszła' : 'Nie przyszedł'),
    cancel: 'Odwołaj wizytę',
    eraseYes: 'Tak, usuń dane',
    eraseNo: 'Nie',
    erase: 'Usuń dane klienta',
    toast: {
      accepted: 'Przyjęta',
      rejected: 'Odrzucona',
      finished: 'Zakończona',
      noShow: 'Nieobecność',
      cancelled: 'Odwołana',
      erased: 'Dane klienta usunięte',
      noteSaved: 'Notatka zapisana'
    }
  },
  stylist: {
    logout: 'Wyloguj się',
    dayGroup: 'Dzień',
    today: 'Dziś',
    tomorrow: 'Jutro',
    waiting: 'Czeka na potwierdzenie',
    remove: (title: string, time: string): string => `Usuń: ${title} ${time}`,
    empty: 'Brak wizyt.',
    addBreak: 'Przerwa',
    sheetTitle: 'Przerwa',
    reason: 'Powód',
    from: 'Od',
    to: 'Do',
    save: 'Zapisz',
    endAfterStart: 'Koniec musi być po początku.',
    added: (kind: string): string => `Dodano: ${kind}`,
    removed: 'Usunięto'
  }
};
