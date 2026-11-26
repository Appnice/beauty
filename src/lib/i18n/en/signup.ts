// English texts: signup (the "Create a salon" wizard). Same keys as ../pl/signup.ts.
import type { signup as pl } from '../pl/signup.ts';

export const signup: typeof pl = {
  title: 'Create a salon',
  closed: 'Salon sign-up is closed',
  login: 'Log in',
  next: 'Next',
  add: 'Add',
  main: {
    title: 'Create a salon',
    lead: 'Free. 3 minutes.',
    name: 'Salon name',
    slugPlaceholder: 'your-salon',
    phone: 'Your phone',
    password: 'Password',
    invite: 'Invite code',
    website: 'Website',
    haveSalon: 'Already have a salon?',
    errors: {
      full: 'Lots of sign-ups. Try tomorrow.',
      name: 'Enter the salon name.',
      phone: 'Enter your phone number: 9 digits.',
      password: 'The password must be at least 8 characters.'
    }
  },
  code: {
    title: 'Enter the SMS code',
    sentTo: (phone: string) => `We sent it to ${phone}`,
    resendIn: (seconds: number) => `Did not arrive? Send again in 0:${String(seconds).padStart(2, '0')}`,
    notArrived: 'Did not arrive?',
    resend: 'Send again',
    errors: {
      digits: 'Enter 6 digits.'
    }
  },
  salon: {
    title: 'About the salon',
    city: 'Town',
    street: 'Street and number',
    teamSize: 'How many people work here?',
    teamSizeAria: 'How many people work here',
    link: 'Instagram, Facebook or website',
    about: 'What do you do?',
    errors: {
      city: 'Enter the town.',
      teamSize: 'Pick how many people work here.',
      link: 'Check the link. Enter a website address or an @name.',
      about: 'Write what you do.'
    }
  },
  services: {
    title: 'What do you offer?',
    lead: 'Tick them. Change the time later.',
    presets: [
      "Women's haircut",
      "Men's haircut",
      'Colouring',
      'Blow-dry',
      'Gel manicure',
      'Pedicure',
      'Brows and lashes'
    ],
    name: 'Service name',
    addOwn: 'Add your own',
    next: (n: number) => `Next · ${n} ${n === 1 ? 'service' : 'services'}`,
    errors: {
      none: 'Tick at least one service.'
    }
  },
  team: {
    title: 'Who works here?',
    lead: 'Each person is a column in the calendar.',
    you: 'You',
    me: 'Me',
    remove: 'Remove',
    name: 'First name',
    alone: 'Working alone? That is fine too.'
  },
  hours: {
    title: 'When are you open?',
    lead: 'Tap an hour to change it.',
    send: 'Send for approval',
    done: 'Done',
    errors: {
      noDay: 'The salon must be open at least one day.',
      password: 'Enter the password again.'
    }
  },
  done: {
    title: 'We are checking the salon',
    lead: 'You will get an SMS, usually the same day.',
    calendar: 'Calendar',
    works: 'works',
    online: 'Online booking',
    after: 'after approval',
    open: 'Open calendar'
  }
};
