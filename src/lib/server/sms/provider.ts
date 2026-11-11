// The SMS adapter. A provider sends one text and reports the result; it never writes to the database.

export interface SmsMessage {
  to: string; // E.164
  body: string;
}

export interface SmsResult {
  status: 'logged' | 'sent' | 'failed';
  providerId?: string;
  costGrosze: number;
  error?: string;
}

export interface SmsProvider {
  readonly name: string;
  send(msg: SmsMessage): Promise<SmsResult>;
}
