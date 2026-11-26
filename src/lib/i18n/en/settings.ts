// English texts: settings. Same keys as ../pl/settings.ts.
import type { settings as pl } from '../pl/settings.ts';

export const settings: typeof pl = {
  main: {
    services: 'Services',
    servicesCount: (n: number) => `${n} ${n === 1 ? 'service' : 'services'}`,
    team: 'Team',
    hours: 'Opening hours',
    link: 'Booking link',
    newBookings: 'New bookings',
    modeAuto: 'Go straight in',
    modeManual: 'Wait for me',
    remindAfter: 'Text me after',
    smsIn: (month: string) => `SMS in ${month}`,
    smsOf: (limit: number) => `of ${limit}`,
    smsLimit: (month: string) => `Limit reached. SMS will be back on 1 ${month}.`,
    smsNote: 'Visit reminders and codes.',
    logout: 'Log out'
  },
  services: {
    title: 'Services',
    nameLabel: 'Service name',
    duration: 'Time',
    remove: (name: string) => `Remove: ${name}`,
    saved: 'Saved',
    removed: 'Removed',
    newService: 'New service',
    add: 'Add'
  },
  team: {
    title: 'Team',
    noPhone: 'no phone',
    name: 'Name',
    add: 'Add',
    timeOff: 'Time off',
    phone: 'Phone',
    colour: 'Colour',
    services: 'Services',
    save: 'Save',
    remove: 'Remove from team',
    saved: 'Saved',
    removed: 'Removed from team'
  },
  hours: {
    title: 'Opening hours',
    whose: 'Whose hours',
    salon: 'Salon',
    save: 'Save',
    saved: 'Saved'
  },
  blocks: {
    title: 'Time off',
    fallback: 'Time off',
    remove: 'Remove',
    who: 'Who',
    what: 'What',
    from: 'From',
    day: 'Day',
    to: 'To',
    add: 'Add',
    added: (kind: string) => `Added: ${kind}`,
    kinds: {
      Przerwa: 'Break',
      Urlop: 'Holiday',
      Szkolenie: 'Training'
    }
  },
  link: {
    title: 'Booking link',
    qr: 'QR code',
    copy: 'Copy link',
    copied: 'Copied',
    copyFailed: 'Could not copy.',
    pending: 'Online booking starts after approval'
  }
};
