// Polish texts: admin.
export const admin = {
  notFound: 'Nie znaleziono.',
  title: 'Nowe salony',
  filter: 'Filtr',
  waiting: 'Czekają',
  accepted: (n: number) => `Przyjęte · ${n}`,
  rejected: (n: number) => `Odrzucone · ${n}`,
  people: (size: string | null) => `${size} os.`,
  reason: (text: string) => `Powód: ${text}`,
  reasonPlaceholder: 'Powód (można pominąć)',
  cancel: 'Anuluj',
  rejectSalon: 'Odrzuć salon',
  reject: 'Odrzuć',
  accept: 'Akceptuj',
  empty: 'Nic tu nie ma.',
  toastAccepted: (name: string) => `Przyjęty: ${name}`,
  toastRejected: (name: string) => `Odrzucony: ${name}`,
  login: {
    title: 'Admin',
    password: 'Hasło',
    submit: 'Zaloguj się'
  }
};
