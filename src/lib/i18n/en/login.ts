// English texts: login. Same keys as ../pl/login.ts.
import type { login as pl } from '../pl/login.ts';

export const login: typeof pl = {
  title: 'Log in',
  back: 'Back',
  phone: 'Phone',
  next: 'Next',
  noSalon: 'No salon yet?',
  create: 'Create a salon',
  whichSalon: 'Which salon?',
  sendCode: 'Send SMS code',
  havePassword: 'I have a password',
  codeTitle: 'Enter the SMS code',
  sentTo: (phone: string) => `We sent it to ${phone}`,
  password: 'Password',
  submit: 'Log in',
  errors: {
    phone: 'Enter your phone number: 9 digits.',
    unknown: 'We do not know this number.'
  }
};
