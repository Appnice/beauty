// SMSAPI.pl provider, written from the public HTTP API docs (POST /sms.do, Bearer token, format=json).
// Off by default: used only when SMS_PROVIDER=smsapi and SMSAPI_TOKEN is set. Tests inject a fake fetch.
import type { SmsMessage, SmsProvider, SmsResult } from './provider.ts';

export const SMSAPI_DEFAULT_URL = 'https://api.smsapi.pl';

export interface SmsapiOptions {
  token: string;
  sender?: string; // registered sender name; empty = the account default
  baseUrl?: string;
  fetch?: typeof fetch;
  test?: boolean; // test=1: SMSAPI checks the request and sends nothing
}

interface SmsapiOk {
  count: number;
  list: { id: string; points: number; number: string; status: string }[];
}
interface SmsapiErr {
  error: number;
  message: string;
}

export class SmsapiProvider implements SmsProvider {
  readonly name = 'smsapi';
  private opts: SmsapiOptions;

  constructor(opts: SmsapiOptions) {
    if (!opts.token) throw new Error('SMSAPI token is missing');
    this.opts = opts;
  }

  async send(msg: SmsMessage): Promise<SmsResult> {
    const f = this.opts.fetch ?? fetch;
    const url = `${(this.opts.baseUrl || SMSAPI_DEFAULT_URL).replace(/\/$/, '')}/sms.do`;
    const form = new URLSearchParams({
      to: msg.to.replace(/^\+/, ''),
      message: msg.body,
      format: 'json',
      encoding: 'utf-8'
    });
    if (this.opts.sender) form.set('from', this.opts.sender);
    if (this.opts.test) form.set('test', '1');
    try {
      const res = await f(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.opts.token}`,
          'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: form.toString()
      });
      const data = (await res.json()) as SmsapiOk | SmsapiErr;
      if ('error' in data)
        return { status: 'failed', costGrosze: 0, error: `${data.error}: ${data.message}` };
      const item = data.list?.[0];
      if (!res.ok || !item) return { status: 'failed', costGrosze: 0, error: `HTTP ${res.status}` };
      // `points` is the cost in PLN on a prepaid account.
      return {
        status: 'sent',
        providerId: String(item.id),
        costGrosze: Math.round((item.points ?? 0) * 100)
      };
    } catch (e) {
      return { status: 'failed', costGrosze: 0, error: e instanceof Error ? e.message : String(e) };
    }
  }
}
