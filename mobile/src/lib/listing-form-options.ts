export type ListingChoice = { value: string; label: string };

const strings = (values: string[]): ListingChoice[] => values.map(value => ({ value, label: value }));
const pairs = (values: [string, string][]): ListingChoice[] => values.map(([value, label]) => ({ value, label }));

/** Select values shared with the active A-USTA web listing form definitions. */
const choices: Record<string, ListingChoice[]> = {
  fuel_type: strings(['Benzin', 'Dizel', 'Hibrid', 'Elektrik', 'Qaz', 'Digər']),
  transmission: strings(['Avtomat', 'Mexaniki', 'Robot', 'Variator']),
  drivetrain: pairs([['fwd', 'Ön'], ['rwd', 'Arxa'], ['awd_4wd', 'Tam']]),
  vehicle_condition: pairs([['new', 'Yeni'], ['used', 'Sürülmüş']]),
  damage_accident: pairs([['no_accident', 'Vuruğu yoxdur'], ['accident', 'Vuruğu var'], ['unknown', 'Məlum deyil']]),
  damage_paint: pairs([['original_paint', 'Rənglənməyib'], ['repainted', 'Rənglənib'], ['partially_repainted', 'Qismən rənglənib'], ['unknown', 'Məlum deyil']]),
  damage_repair: pairs([['no_repair_needed', 'Təmir tələb etmir'], ['repair_needed', 'Təmir tələb edir'], ['unknown', 'Məlum deyil']]),
  market: pairs([['official_dealer', 'Azərbaycan / Rəsmi diler'], ['europe', 'Avropa'], ['usa', 'ABŞ'], ['canada', 'Kanada'], ['korea', 'Koreya'], ['japan', 'Yaponiya'], ['china', 'Çin'], ['gulf', 'Körfəz ölkələri'], ['russia_cis', 'Rusiya / MDB'], ['other', 'Digər']]),
  rental_type: strings(['Günlük', 'Həftəlik', 'Aylıq', 'Uzunmüddətli']),
  condition: strings(['Yeni', 'İşlənmiş']),
  part_condition: strings(['Yeni', 'İşlənmiş', 'Orijinal', 'Universal']),
  moto_type: strings(['Motosiklet', 'Moped', 'Skuter']),
  special_condition: strings(['Yeni', 'İşlənmiş']),
  sale_rent: strings(['Satış', 'İcarə', 'Hər ikisi']),
  water_type: strings(['Qayıq', 'Yaxta', 'Kater', 'Jet-ski', 'Digər']),
  caravan_type: strings(['Motorlu karavan', 'Qoşqu karavan', 'Kampervan', 'Digər']),
  document_status: strings(['Tam sənədlidir', 'Yoxlanılmalıdır']),
  order_type: pairs([['sale', 'Satış'], ['order', 'Sifarişlə']]),
  interest_type: pairs([['annual', 'İllik'], ['monthly', 'Aylıq']]),
  license_disclosure: pairs([['company_reported_unverified', 'Şirkət tərəfindən təqdim edilib; platforma tərəfindən yoxlanılmayıb']]),
};

export function listingFieldChoices(category: string, field: string): ListingChoice[] | undefined {
  if (field === 'condition') return choices[category === 'parts' ? 'part_condition' : category === 'special' ? 'special_condition' : 'condition'];
  return choices[field];
}
