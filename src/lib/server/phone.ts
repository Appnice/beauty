// Polish phone numbers to E.164 (+48XXXXXXXXX). Foreign numbers must start with + or 00.

export function normalizePhone(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  let digits = raw.replace(/[\s\-().]/g, '');
  if (digits.startsWith('00')) digits = '+' + digits.slice(2);
  if (digits.startsWith('+')) {
    if (!/^\+[0-9]{8,15}$/.test(digits)) return null;
    if (digits.startsWith('+48') && digits.length !== 12) return null;
    return digits;
  }
  if (!/^[0-9]+$/.test(digits)) return null;
  if (digits.length === 11 && digits.startsWith('48')) return '+' + digits;
  if (digits.length === 10 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 9) return '+48' + digits;
  return null;
}

/** "+48 600 123 456" for display. */
export function formatPhone(e164: string): string {
  const m = /^\+48(\d{3})(\d{3})(\d{3})$/.exec(e164);
  return m ? `+48 ${m[1]} ${m[2]} ${m[3]}` : e164;
}
