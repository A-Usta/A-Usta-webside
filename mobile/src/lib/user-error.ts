type BackendError = Error & { code?: string; status?: number };

/** Keep backend and platform English diagnostics out of user-facing dialogs. */
export function userErrorMessage(error: unknown, fallback = 'Xəta baş verdi. Yenidən cəhd edin.'): string {
  if (!(error instanceof Error)) return fallback;
  const value = error as BackendError;
  const code = String(value.code || '');
  const message = value.message.toLowerCase();
  if (/internet|network request failed|failed to fetch|network error|connection|offline/.test(message)) {
    return 'İnternet bağlantısını yoxlayın və yenidən cəhd edin.';
  }
  if (/jwt expired|token.*expired|session.*expired/.test(message) || value.status === 401) {
    return 'Sessiyanın vaxtı bitib. Hesabınıza yenidən daxil olun.';
  }
  if (code === '42501' || /row.level security|permission denied|not authorized|unauthorized/.test(message)) {
    return 'Bu əməliyyat üçün hesab icazəsi təsdiqlənmədi. Hesabınızı yoxlayın və yenidən cəhd edin.';
  }
  if (code === '23505') return 'Bu məlumat artıq mövcuddur. Elanlarınızı yoxlayın.';
  if (code === '23514' || code === '22P02') return 'Daxil edilən məlumatlardan biri qəbul edilmir. Sahələri yoxlayıb yenidən cəhd edin.';
  if (/bucket.*not found|object.*not found/.test(message)) return 'Media saxlama xidməti hazırda əlçatan deyil. Media silinməyib; sonra yenidən cəhd edin.';
  if (/timeout|timed out|aborted/.test(message) || value.status === 408 || value.status === 504) {
    return 'Sorğu vaxtında tamamlanmadı. Məlumatlarınız saxlanılıb; interneti yoxlayıb yenidən cəhd edin.';
  }
  // Preserve app-authored Azerbaijani validation messages; redact unknown server text.
  return /[əğıöşüçƏĞİÖŞÜÇ]/.test(value.message) ? value.message : fallback;
}
