export function normalizeAzerbaijaniPhone(input: string): string | null {
  let value = input.trim().replace(/[^\d+]/g, '');
  if (value.startsWith('00')) value = '+' + value.slice(2);
  if (value.startsWith('0')) value = '+994' + value.slice(1);
  else if (value.startsWith('994')) value = '+' + value;
  else if (!value.startsWith('+')) value = '+994' + value;
  return /^\+994\d{9}$/.test(value) ? value : null;
}
