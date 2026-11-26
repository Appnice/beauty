// English texts: admin. Same keys as ../pl/admin.ts.
import type { admin as pl } from '../pl/admin.ts';

export const admin: typeof pl = {
  notFound: 'Not found.',
  title: 'New salons',
  filter: 'Filter',
  waiting: 'Waiting',
  accepted: (n: number) => `Accepted · ${n}`,
  rejected: (n: number) => `Rejected · ${n}`,
  people: (size: string | null) => (size === '1' ? '1 person' : `${size} people`),
  reason: (text: string) => `Reason: ${text}`,
  reasonPlaceholder: 'Reason (optional)',
  cancel: 'Cancel',
  rejectSalon: 'Reject salon',
  reject: 'Reject',
  accept: 'Accept',
  empty: 'Nothing here.',
  toastAccepted: (name: string) => `Accepted: ${name}`,
  toastRejected: (name: string) => `Rejected: ${name}`,
  login: {
    title: 'Admin',
    password: 'Password',
    submit: 'Log in'
  }
};
