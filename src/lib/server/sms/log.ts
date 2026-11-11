import { quiet } from '../env.ts';
import type { SmsMessage, SmsProvider, SmsResult } from './provider.ts';

/** Default provider: writes the message to the server log and sends nothing. */
export class LogSmsProvider implements SmsProvider {
  readonly name = 'log';
  sent: SmsMessage[] = [];

  async send(msg: SmsMessage): Promise<SmsResult> {
    this.sent.push(msg);
    if (!quiet()) console.info(`[sms:log] to=${msg.to} body=${JSON.stringify(msg.body)}`);
    return { status: 'logged', costGrosze: 0 };
  }
}
