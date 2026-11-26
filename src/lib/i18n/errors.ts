// The service layer speaks Polish (AppError messages). An English page translates the message when it shows
// it: `api()` in `$lib/api.ts` and the error page call `trError()`. A message without an entry stays Polish;
// `tests/i18n.test.ts` checks that every message in the server code has an entry.
import type { Lang } from './index.ts';

export const ERRORS_EN: Record<string, string> = {
  'Brak połączenia. Spróbuj ponownie.': 'No connection. Try again.',
  'Coś poszło nie tak. Spróbuj ponownie.': 'Something went wrong. Try again.',
  'Dodaj co najmniej jedną osobę.': 'Add at least one person.',
  'Dużo zgłoszeń. Spróbuj jutro.': 'Too many sign-ups. Try tomorrow.',
  'Hasło musi mieć co najmniej 8 znaków.': 'The password must have at least 8 characters.',
  'Kod jest nieprawidłowy albo wygasł. Poproś o nowy.':
    'The code is wrong or has expired. Ask for a new one.',
  'Koniec musi być po początku.': 'The end must be after the start.',
  'Limit SMS w tym miesiącu się skończył. Zaloguj się hasłem.':
    'This month’s SMS allowance is used up. Log in with your password.',
  'Masz już 3 rezerwacje na dziś. Zadzwoń do salonu.': 'You already have 3 bookings today. Call the salon.',
  'Na odwołanie jest już za późno. Zadzwoń do salonu.': 'It is too late to cancel. Call the salon.',
  'Napisz, czym się zajmujecie.': 'Write what you do.',
  'Nie ma takiego klienta.': 'There is no such client.',
  'Nie ma takiego salonu.': 'There is no such salon.',
  'Nie ma takiej osoby w zespole.': 'There is no such person in the team.',
  'Nie ma takiej strony.': 'There is no such page.',
  'Nie ma takiej usługi.': 'There is no such service.',
  'Nie ma takiej wizyty.': 'There is no such visit.',
  'Nie masz do tego uprawnień.': 'You are not allowed to do this.',
  'Nie udało się wysłać SMS. Spróbuj ponownie.': 'The SMS could not be sent. Try again.',
  'Nie znaleziono wizyty.': 'Visit not found.',
  'Nie znaleziono.': 'Not found.',
  'Nieprawidłowe dane.': 'Invalid data.',
  'Nieprawidłowe hasło.': 'Wrong password.',
  'Nieprawidłowy kod zaproszenia.': 'Wrong invite code.',
  'Nieprawidłowy numer telefonu lub hasło.': 'Wrong phone number or password.',
  'Podaj imię klienta.': 'Enter the client’s name.',
  'Podaj imię.': 'Enter a name.',
  'Podaj miejscowość.': 'Enter the town.',
  'Podaj nazwę salonu.': 'Enter the salon’s name.',
  'Podaj nazwę usługi.': 'Enter the service name.',
  'Podaj poprawne godziny.': 'Enter valid hours.',
  'Podaj poprawny numer telefonu.': 'Enter a valid phone number.',
  'Podaj poprawny termin.': 'Enter a valid time.',
  'Potwierdź numer telefonu kodem z SMS.': 'Confirm the phone number with the SMS code.',
  'Salon musi być otwarty co najmniej jeden dzień.': 'The salon must be open at least one day.',
  'Salon nie może teraz wysłać SMS-a. Zadzwoń do salonu.':
    'The salon cannot send an SMS now. Call the salon.',
  'Sprawdź datę i godzinę.': 'Check the date and time.',
  'Sprawdź datę.': 'Check the date.',
  'Sprawdź link. Wpisz adres strony albo @nazwę.': 'Check the link. Enter a web address or an @name.',
  'Sprawdź wpisane dane.': 'Check what you entered.',
  'Ta wizyta jeszcze się nie zaczęła.': 'This visit has not started yet.',
  'Ta wizyta już się zaczęła. Zadzwoń do salonu.': 'This visit has already started. Call the salon.',
  'Taki wpis już istnieje.': 'This entry already exists.',
  'Tej wizyty nie można już przesunąć.': 'This visit can no longer be moved.',
  'Tej wizyty nie można już zmienić.': 'This visit can no longer be changed.',
  'Ten adres jest niedostępny. Użyj małych liter, cyfr i myślników.':
    'This address is not available. Use lowercase letters, digits and hyphens.',
  'Ten adres salonu jest już zajęty.': 'This salon address is already taken.',
  'Ten numer ma już salon. Zaloguj się.': 'This number already has a salon. Log in.',
  'Ten salon jest już rozpatrzony.': 'This salon has already been decided.',
  'Ten salon nie został przyjęty.': 'This salon was not accepted.',
  'Ten termin jest już zajęty. Wybierz inny.': 'This time is already taken. Pick another one.',
  'Ten termin nie jest dostępny. Wybierz inny.': 'This time is not available. Pick another one.',
  'Wybierz usługę.': 'Pick a service.',
  'Za dużo prób. Spróbuj ponownie za kilka minut.': 'Too many attempts. Try again in a few minutes.',
  'Zakładanie nowych salonów jest zamknięte.': 'Sign-up for new salons is closed.',
  'Zaloguj się, aby kontynuować.': 'Log in to continue.',
  'Zapisy online wkrótce.': 'Online booking coming soon.',
  'Zaznacz co najmniej jedną usługę.': 'Pick at least one service.',
  'Zaznacz, ile osób pracuje.': 'Pick how many people work here.'
};

/** The message in the page's language. Unknown messages come back unchanged. */
export function trError(message: string, lang: Lang | string | null | undefined): string {
  return lang === 'en' ? (ERRORS_EN[message] ?? message) : message;
}

/** The language of the page in the browser (`<html lang>`), 'pl' on the server. */
export function pageLang(): Lang {
  return typeof document !== 'undefined' && document.documentElement.lang === 'en' ? 'en' : 'pl';
}
