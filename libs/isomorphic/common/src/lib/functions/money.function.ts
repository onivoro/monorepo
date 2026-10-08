import { removeAlphaChars } from './remove-alpha-chars.function';

export function money(rawValue: number | string) {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return;
  }

  const scrubbed = removeAlphaChars(String(rawValue));

  const amount = Number(scrubbed);

  if (!amount && amount !== 0) {
    return;
  }

  const formatter = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  });

  return formatter.format(Number(amount));
}
