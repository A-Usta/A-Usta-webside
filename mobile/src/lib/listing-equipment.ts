import catalog from '../data/listing-equipment.json';

const EQUIPMENT = catalog as Record<string, string[]>;

export function equipmentOptions(category: string): string[] {
  return Array.isArray(EQUIPMENT[category]) ? EQUIPMENT[category] : [];
}

export function selectedEquipment(raw: unknown, category: string): string[] {
  let values: unknown = raw;
  if (typeof raw === 'string') {
    try { values = JSON.parse(raw); } catch { return []; }
  }
  if (!Array.isArray(values)) return [];
  const allowed = new Set(equipmentOptions(category));
  return [...new Set(values.filter((value): value is string => typeof value === 'string' && allowed.has(value)))];
}

export function equipmentValue(raw: unknown, category: string, option: string): string {
  const options = equipmentOptions(category);
  if (!options.includes(option)) return JSON.stringify(selectedEquipment(raw, category));
  const current = selectedEquipment(raw, category);
  return JSON.stringify(current.includes(option) ? current.filter(value => value !== option) : [...current, option]);
}
