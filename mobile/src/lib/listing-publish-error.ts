type PublishPhase = 'draft' | 'update' | 'media-list' | 'media-read' | 'media-upload' | 'media-link' | 'activation';
type DatabaseFailure = { code?: unknown; message?: unknown; details?: unknown; constraint?: unknown; status?: unknown };

/** Maps explicit database constraint names back to the corresponding form control. */
export function listingPublishField(error: unknown): string | null {
  const failure = readFailure(error);
  const technical = [failure.message, failure.details, failure.constraint].filter(v => typeof v === 'string').join(' ').toLowerCase();
  const mappings: [RegExp, string][] = [
    [/price_by_type|daily_price|price_check|price.*constraint/, 'price'],
    [/year_check|column ["']?year|year.*integer/, 'year'],
    [/vin_format|column ["']?vin|vin.*format/, 'vin'],
    [/mileage_check|column ["']?mileage|mileage.*integer/, 'mileage'],
    [/rental_type_check|column ["']?rental_type/, 'rental_type'],
    [/horsepower|seats/, technical.includes('horsepower') ? 'horsepower' : 'seats'],
    [/engine_volume/, 'engine_volume'],
  ];
  return mappings.find(([pattern]) => pattern.test(technical))?.[1] ?? null;
}

const phaseText: Record<PublishPhase, string> = {
  draft: 'Elan qaralaması yaradılmadı.',
  update: 'Elan məlumatları saxlanmadı.',
  'media-list': 'Elanın media siyahısı oxunmadı.',
  'media-read': 'Media telefon yaddaşından oxunmadı.',
  'media-upload': 'Media serverə yüklənmədi.',
  'media-link': 'Media elanla əlaqələndirilmədi.',
  activation: 'Elan aktivləşdirilmədi. Qaralamanız saxlanılıb; düzəlişdən sonra yenidən dərc edin.',
};

function readFailure(error: unknown): DatabaseFailure {
  return error && typeof error === 'object' ? error as DatabaseFailure : {};
}

/** Converts PostgREST plain objects as well as native Error instances to safe Azerbaijani guidance. */
export function listingPublishError(error: unknown, phase: PublishPhase): string {
  const failure = readFailure(error);
  const code = String(failure.code || '');
  const technical = [failure.message, failure.details, failure.constraint].filter(v => typeof v === 'string').join(' ').toLowerCase();

  if (code === 'LISTING_TIMEOUT') return 'Server cavabı gecikdi. Eyni qaralama üzərindən yenidən cəhd edin; təkrar elan yaratmayın.';

  if (typeof failure.message === 'string' && /[əğıöşüçƏĞİÖŞÜÇ]/.test(failure.message)) return failure.message;

  if (/internet|network request failed|failed to fetch|network error|connection|offline/.test(technical)) {
    return `${phaseText[phase]} İnternet bağlantısını yoxlayın və yenidən cəhd edin.`;
  }
  if (code === '401' || code === 'PGRST301' || /jwt expired|token.*expired|session.*expired/.test(technical)) {
    return 'Sessiyanın vaxtı bitib. Hesabınıza yenidən daxil olun.';
  }
  if (code === '42501' || /row.level security|permission denied|not authorized|unauthorized/.test(technical)) {
    return `${phaseText[phase]} Server bu hesab üçün əməliyyata icazə vermədi. Sessiya aktivdirsə, dəstəyə müraciət edin.`;
  }
  if (code === '23503' || /seller profile|seller_profile|foreign key/.test(technical)) {
    return 'Satıcı profili və ya elan sahibi uyğun gəlmir. Profil seçimini yoxlayın.';
  }
  if (code === '23514' || code === '22P02' || code === '23502') {
    if (/price_by_type/.test(technical)) return 'Satış elanı üçün qiyməti, icarə elanı üçün günlük qiyməti düzgün daxil edin.';
    if (/year/.test(technical)) return 'Buraxılış ilini 1900–2100 aralığında daxil edin.';
    if (/vin/.test(technical)) return 'VIN-kod 17 simvoldan ibarət olmalıdır.';
    if (/rental_type/.test(technical)) return 'İcarə müddətini siyahıdan seçin.';
    if (/horsepower/.test(technical)) return 'Mühərrik gücünü tam ədəd kimi daxil edin.';
    if (/mileage/.test(technical)) return 'Yürüşü tam, mənfi olmayan ədəd kimi daxil edin.';
    if (/seats/.test(technical)) return 'Yerlərin sayını tam ədəd kimi daxil edin.';
    return 'Elan məlumatlarından biri server tələblərinə uyğun deyil. İl, qiymət və seçimləri yoxlayın.';
  }
  if (phase === 'media-read') return 'Şəkil və ya video faylı açıla bilmədi. Faylı yenidən seçin.';
  if (phase === 'media-upload') return 'Şəkil və ya video yüklənmədi. İnternet bağlantısını yoxlayıb yenidən cəhd edin.';
  if (phase === 'media-link') return 'Media yükləndi, amma elanla əlaqə qurulmadı. Qaralama saxlanılıb; yenidən cəhd edin.';
  return `${phaseText[phase]} Elan məlumatlarını yoxlayıb yenidən cəhd edin.`;
}
