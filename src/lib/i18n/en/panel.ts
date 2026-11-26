// English texts: panel. Same keys as ../pl/panel.ts.
import type { panel as pl } from '../pl/panel.ts';

/** Block reasons are stored in Polish (`BLOCK_KINDS`); other reasons are the owner's own words. */
const BLOCK_KINDS_EN: Record<string, string> = {
  Przerwa: 'Break',
  Urlop: 'Holiday',
  Szkolenie: 'Training'
};

export const panel: typeof pl = {
  pendingLine: 'Online booking starts once approved',
  back: 'Back',
  client: (name) => (name === 'Usunięty klient' ? 'Deleted client' : name),
  rail: {
    menu: 'Menu',
    calendar: 'Calendar',
    waiting: 'Waiting',
    settings: 'Settings'
  },
  bar: {
    prevDay: 'Previous day',
    nextDay: 'Next day',
    prevWeek: 'Previous week',
    nextWeek: 'Next week',
    today: 'Today',
    view: 'View',
    day: 'Day',
    week: 'Week',
    add: 'Visit'
  },
  day: {
    visits: (n) => `${n} ${n === 1 ? 'visit' : 'visits'}`,
    onLeave: 'holiday',
    until: (weekday) => `until ${weekday}`,
    waitingForYou: 'Waiting for you',
    addVisit: '+ Add visit'
  },
  block: {
    kind: (reason) => BLOCK_KINDS_EN[reason] ?? reason,
    fallback: 'Blocked'
  },
  status: {
    oczekuje: 'Waiting',
    potwierdzona: 'Confirmed',
    odwolana: 'Cancelled',
    nieobecnosc: 'No-show',
    zakonczona: 'Finished'
  },
  week: {
    title: (d1, m1, d2, m2) => (m1 === m2 ? `${d1} – ${d2} ${m2}` : `${d1} ${m1} – ${d2} ${m2}`)
  },
  waiting: {
    title: 'Waiting for you',
    reject: 'Decline',
    accept: 'Accept',
    empty: 'Nothing is waiting.',
    note: 'The client gets an SMS right away.',
    accepted: (name) => `Accepted: ${name}`,
    rejected: (name) => `Declined: ${name}`
  },
  newVisit: {
    title: 'New visit',
    who: 'Who',
    time: 'Time',
    phone: 'Phone',
    name: 'Name',
    service: 'Service',
    minutes: (n) => `${n} min`,
    been: (_name, n) => `${n} ${n === 1 ? 'visit' : 'visits'}`,
    save: 'Save',
    saved: (time) => `Saved: ${time}`,
    needName: 'Enter a name.',
    needService: 'Choose a service.'
  },
  visit: {
    note: 'Note',
    saveNote: 'Save note',
    accept: 'Accept',
    reject: 'Decline',
    finish: 'Finished',
    noShow: () => 'Did not come',
    cancel: 'Cancel visit',
    eraseYes: 'Yes, delete the data',
    eraseNo: 'No',
    erase: 'Delete client data',
    toast: {
      accepted: 'Accepted',
      rejected: 'Declined',
      finished: 'Finished',
      noShow: 'No-show',
      cancelled: 'Cancelled',
      erased: 'Client data deleted',
      noteSaved: 'Note saved'
    }
  },
  stylist: {
    logout: 'Log out',
    dayGroup: 'Day',
    today: 'Today',
    tomorrow: 'Tomorrow',
    waiting: 'Waiting to be confirmed',
    remove: (title, time) => `Remove: ${title} ${time}`,
    empty: 'No visits.',
    addBreak: 'Break',
    sheetTitle: 'Break',
    reason: 'Reason',
    from: 'From',
    to: 'To',
    save: 'Save',
    endAfterStart: 'The end must be after the start.',
    added: (kind) => `Added: ${kind}`,
    removed: 'Removed'
  }
};
