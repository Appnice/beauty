import { env } from '../env.ts';
import { LogSmsProvider } from './log.ts';
import type { SmsProvider } from './provider.ts';
import { SmsapiProvider } from './smsapi.ts';

export type { SmsProvider, SmsMessage, SmsResult } from './provider.ts';

let current: SmsProvider | null = null;

/** The provider from env: SMS_PROVIDER=smsapi with SMSAPI_TOKEN, else the log provider. */
export function smsProvider(): SmsProvider {
  if (current) return current;
  if (env('SMS_PROVIDER') === 'smsapi') {
    const token = env('SMSAPI_TOKEN');
    if (token) {
      current = new SmsapiProvider({
        token,
        sender: env('SMSAPI_SENDER'),
        baseUrl: env('SMSAPI_URL') || undefined
      });
      return current;
    }
    console.warn('[sms] SMS_PROVIDER=smsapi but SMSAPI_TOKEN is empty: using the log provider');
  }
  current = new LogSmsProvider();
  return current;
}

/** Tests swap the provider. */
export function useSmsProvider(p: SmsProvider | null): void {
  current = p;
}
