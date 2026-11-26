// English texts: booking. Same keys as ../pl/booking.ts.
import type { booking as pl } from '../pl/booking.ts';

export const booking: typeof pl = {
  soon: 'Online booking coming soon',
  status: {
    potwierdzona: 'Visit confirmed',
    oczekuje: 'Waiting for the salon to confirm',
    odwolana: 'Visit cancelled',
    zakonczona: 'Visit finished',
    nieobecnosc: 'Missed visit'
  },
  addToCalendar: 'Add to calendar',
  icsFile: 'visit.ics',
  service: {
    title: 'What would you like?',
    duration: (min: number) => `${min} min`
  },
  person: {
    title: 'Who with?',
    any: 'Anyone'
  },
  time: {
    title: 'When?',
    taken: 'This time is already taken',
    none: 'No free times.',
    later: 'Later days'
  },
  details: {
    title: 'Your details',
    name: 'First name',
    phone: 'Phone',
    consentBefore: 'By booking, you agree to the ',
    consentLink: 'privacy rules',
    consentAfter: '.',
    needName: 'Enter your first name.',
    needPhone: 'Enter your phone number: 9 digits.',
    next: 'Next',
    book: 'Book'
  },
  code: {
    title: 'Enter the SMS code',
    sentTo: (phone: string) => `We sent it to ${phone}`,
    resendIn: (time: string) => `Didn’t get it? Send again in ${time}`,
    notArrived: 'Didn’t get it?',
    resend: 'Send again',
    needDigits: 'Enter 6 digits.',
    book: 'Book'
  },
  done: {
    remind: 'We will remind you by SMS the day before.',
    willSms: 'You will get an SMS.',
    see: 'See visit',
    another: 'Book another'
  },
  visit: {
    askCancel: 'Cancel the visit?',
    yesCancel: 'Yes, cancel',
    no: 'No',
    again: 'Book again',
    cancel: 'Cancel visit',
    tooLate: 'It is too late to cancel. Call the salon.'
  },
  privacy: {
    title: 'Privacy',
    pageTitle: (salon: string) => `Privacy · ${salon}`,
    operatorFallback: 'the operator of this server',
    whoTitle: 'Who holds your data',
    controller: (salon: string, where: string, phone: string) =>
      `The data controller is the salon ${salon}${where ? `, ${where}` : ''}${
        phone ? `, tel. ${phone}` : ''
      }. The salon uses the data for its own needs: visits and reminders.`,
    processor: (operator: string) =>
      `The booking system is run by ${operator}. It processes the data only on behalf of the salon (data processing agreement, Article 28 GDPR) and does not use it for anything else.`,
    whatTitle: 'What data',
    what: 'First name, phone number, visits (service, person, time) and the SMS messages about these visits.',
    whyTitle: 'What for',
    why: 'To book your visit, confirm your number with an SMS code, remind you about the visit and give you a link to cancel it (Article 6(1)(b) GDPR).',
    howLongTitle: 'How long',
    howLong: 'As long as you are a client of the salon, or until you ask for your data to be deleted.',
    rightsTitle: 'Your rights',
    rights:
      'You can ask the salon to show you your data, correct it or delete it. After deletion the salon keeps only the time and the service, without your name and number. You can lodge a complaint with the President of the Personal Data Protection Office (UODO, the Polish data protection authority).',
    cookiesTitle: 'Cookies',
    cookies: 'The booking page does not use cookies for tracking or advertising.'
  }
};
