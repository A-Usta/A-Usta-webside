import type { SupabaseClient } from '@supabase/supabase-js';
import { attachMedia, categoryConfig, listCategory, type Listing } from './marketplace';

// The official bare portal host serves the calculator over a verified TLS
// connection on Android, while the www alias can return an upstream error.
export const OFFICIAL_AUTO_CUSTOMS_CALCULATOR = 'https://e.customs.gov.az/for-individuals/calculator/auto';

export function getBakuDayBounds(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Baku', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now).map(part => [part.type, part.value]));
  const start = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day)) - 4 * 60 * 60 * 1000;
  return { from: new Date(start).toISOString(), to: new Date(start + 24 * 60 * 60 * 1000).toISOString() };
}

export async function getTodayActiveVehicleCount(client: SupabaseClient, now = new Date()): Promise<number> {
  const { from, to } = getBakuDayBounds(now);
  const { count, error } = await client.from('vehicle_listings').select('id', { count: 'exact', head: true })
    .eq('status', 'active').eq('listing_type', 'sale').gte('created_at', from).lt('created_at', to);
  if (error) throw error;
  if (typeof count !== 'number') throw new Error('Bu günün elan sayı təsdiqlənmədi.');
  return count;
}

export type ViewedListing = Listing & { view_count: number };

export async function getMostViewedActiveCars(client: SupabaseClient): Promise<ViewedListing[]> {
  const category = categoryConfig('cars');
  if (!category) throw new Error('Avtomobil kateqoriyası mövcud deyil.');
  const candidates: Listing[] = await listCategory(client, category, { from: 0, to: 39 });
  const withCounts: ViewedListing[] = [];
  for (let start = 0; start < candidates.length; start += 8) {
    const batch = await Promise.all(candidates.slice(start, start + 8).map(async listing => {
      const { data, error } = await client.rpc('austa_get_listing_detail_metadata', {
        p_source: 'vehicle', p_listing_id: listing.id,
      });
      if (error) throw error;
      const metadata = Array.isArray(data) ? data[0] : null;
      if (!metadata || !Number.isSafeInteger(Number(metadata.view_count)) || Number(metadata.view_count) < 0) return null;
      return { ...listing, view_count: Number(metadata.view_count) };
    }));
    withCounts.push(...batch.filter((item): item is ViewedListing => item !== null));
  }
  const ranked = withCounts.sort((a, b) => b.view_count - a.view_count || Date.parse(String(b.created_at || '')) - Date.parse(String(a.created_at || '')));
  return Promise.all(ranked.slice(0, 20).map(async item => ({
    ...await attachMedia(client, category, item), view_count: item.view_count,
  })));
}

export type DealerDirectoryEntry = {
  profileId: string;
  name: string;
  listingRegion: string | null;
  activeListingCount: number;
  latestListingImageUrl: string | null;
  listings: Listing[];
};

function eligibleDealer(profile: Record<string, unknown>) {
  return typeof profile.id === 'string' && typeof profile.display_name === 'string'
    && profile.display_name.trim().length > 0 && profile.business_type === 'dealer'
    && profile.status === 'active' && profile.verification_status === 'verified';
}

export async function getVerifiedDealerDirectory(client: SupabaseClient): Promise<DealerDirectoryEntry[]> {
  const verified: Record<string, string>[] = [];
  for (let offset = 0; ; offset += 200) {
    const { data, error } = await client.from('seller_profiles')
      .select('id,display_name,business_type,status,verification_status')
      .eq('business_type', 'dealer').eq('status', 'active').eq('verification_status', 'verified')
      .order('display_name', { ascending: true }).order('id', { ascending: true }).range(offset, offset + 199);
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error('Təsdiqlənmiş diler profilləri alınmadı.');
    verified.push(...data.filter((row: Record<string, unknown>) => eligibleDealer(row)) as Record<string, string>[]);
    if (data.length < 200) break;
  }
  const category = categoryConfig('cars');
  if (!category) throw new Error('Avtomobil kateqoriyası mövcud deyil.');
  const entries: DealerDirectoryEntry[] = [];
  for (let start = 0; start < verified.length; start += 6) {
    const batch = await Promise.all(verified.slice(start, start + 6).map(async (profile: Record<string, string>) => {
      const { data, error: listingsError, count } = await client.from('vehicle_listings')
        .select('id,owner_id,seller_profile_id,status,listing_type,brand,model,year,mileage,engine,engine_volume,fuel_type,price,region,created_at,details', { count: 'exact' })
        .eq('seller_profile_id', profile.id).eq('status', 'active').eq('listing_type', 'sale')
        .order('created_at', { ascending: false }).limit(8);
      if (listingsError) throw listingsError;
      if (typeof count !== 'number') throw new Error('Salon elanlarının dəqiq sayı alınmadı.');
      const rows = (data || []).filter((row: Record<string, unknown>) => row.seller_profile_id === profile.id && row.status === 'active' && row.listing_type === 'sale')
        .map((row: Record<string, unknown>) => ({ ...row, _source: 'vehicle', _category: 'cars' })) as Listing[];
      const hydrated = await Promise.all(rows.map(row => attachMedia(client, category, row)));
      return {
        profileId: profile.id,
        name: profile.display_name,
        listingRegion: typeof hydrated.find(row => row.region)?.region === 'string' ? String(hydrated.find(row => row.region)?.region) : null,
        activeListingCount: count,
        latestListingImageUrl: hydrated.flatMap(row => row._media || []).find(media => media.media_type === 'image')?.url || null,
        listings: hydrated,
      } satisfies DealerDirectoryEntry;
    }));
    entries.push(...batch);
  }
  return entries;
}
