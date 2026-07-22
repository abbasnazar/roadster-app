/** Default dial code aligned with web `road` (`DEFAULT_DIAL_CODE`). */
export const DEFAULT_DIAL_CODE = '+91';

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, '');
}

/** E.164: dial code like "+91" + local digits → "+9190…" */
export function toE164(countryDialCode: string, localNumber: string): string {
  const digits = digitsOnly(localNumber);
  const code = countryDialCode.replace(/\D/g, '');
  return `+${code}${digits}`;
}
