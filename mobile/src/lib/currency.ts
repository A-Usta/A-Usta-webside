export type CurrencyCode = 'AZN' | 'USD' | 'EUR';
export type ExchangeRates = { date: string; aznPerUnit: Record<CurrencyCode, number> };

let selectedCurrency: CurrencyCode = 'AZN';
let latestRates: ExchangeRates | null = null;

export function isCurrencyCode(value: unknown): value is CurrencyCode {
  return value === 'AZN' || value === 'USD' || value === 'EUR';
}

export function setCurrencySnapshot(currency: CurrencyCode, rates: ExchangeRates | null) {
  selectedCurrency = currency;
  latestRates = rates;
}

export function getCurrencySnapshot() {
  return { currency: selectedCurrency, rates: latestRates };
}

export function parseCbarRates(xml: string): ExchangeRates | null {
  const date = xml.match(/<ValCurs\b[^>]*\bDate="([^"]+)"/i)?.[1] || '';
  if (!date) return null;
  const aznPerUnit: Record<CurrencyCode, number> = { AZN: 1, USD: 0, EUR: 0 };
  for (const code of ['USD', 'EUR'] as const) {
    const entry = xml.match(new RegExp(`<Valute\\b(?=[^>]*\\bCode="${code}")[^>]*>([\\s\\S]*?)<\\/Valute>`, 'i'))?.[1];
    if (!entry) return null;
    const nominal = Number(entry.match(/<Nominal>\s*([\d.,]+)\s*<\/Nominal>/i)?.[1]?.replace(',', '.'));
    const value = Number(entry.match(/<Value>\s*([\d.,]+)\s*<\/Value>/i)?.[1]?.replace(',', '.'));
    if (!Number.isFinite(nominal) || nominal <= 0 || !Number.isFinite(value) || value <= 0) return null;
    aznPerUnit[code] = value / nominal;
  }
  return { date, aznPerUnit };
}

export function formatListingPrice(amount: number | string | null | undefined, original: unknown, rates: ExchangeRates | null = latestRates, selected: CurrencyCode = selectedCurrency) {
  if (amount == null || !Number.isFinite(Number(amount))) return 'Qiymət soruşun';
  const source: CurrencyCode = isCurrencyCode(original) ? original : 'AZN';
  let value = Number(amount);
  let shown = source;
  if (rates && rates.aznPerUnit[source] > 0 && rates.aznPerUnit[selected] > 0) {
    value = value * rates.aznPerUnit[source] / rates.aznPerUnit[selected];
    shown = selected;
  }
  const suffix: Record<CurrencyCode, string> = { AZN: '₼', USD: '$', EUR: '€' };
  return `${value.toLocaleString('az-AZ', { maximumFractionDigits: shown === 'AZN' ? 2 : 2 })} ${suffix[shown]}`;
}

export function convertPriceThreshold(value: string | number, from: CurrencyCode, to: CurrencyCode, rates: ExchangeRates | null): number | null {
  const amount = Number(value);
  if (!Number.isFinite(amount) || amount < 0) return null;
  if (from === to) return amount;
  if (!rates || rates.aznPerUnit[from] <= 0 || rates.aznPerUnit[to] <= 0) return null;
  return amount * rates.aznPerUnit[from] / rates.aznPerUnit[to];
}

export function cbarDailyUrl(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Baku', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const part = (type: string) => parts.find(item => item.type === type)?.value || '';
  return `https://cbar.az/currencies/${part('day')}.${part('month')}.${part('year')}.xml`;
}
