import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Image, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import vehicleCatalog from '../data/vehicle-catalog.json';
import { getSupabaseClient } from '../lib/supabase';
import { userErrorMessage } from '../lib/user-error';
import { attachMedia, categoryConfig, listCategory, type Listing } from '../lib/marketplace';
import { getMostViewedActiveCars, getVerifiedDealerDirectory, OFFICIAL_AUTO_CUSTOMS_CALCULATOR, type DealerDirectoryEntry } from '../lib/marketTools';

const GREEN = '#176244';
const RED = '#D92D20';
const INK = '#202A35';
const MUTED = '#7A8491';
const LINE = '#E8EBEF';
const BG = '#F4F6F8';
const vehicleModels = vehicleCatalog.models as Record<string, string[]>;
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: BG },
  body: { padding: 16, paddingBottom: 32, gap: 12 },
  title: { color: INK, fontSize: 22, fontWeight: '800' },
  subtitle: { color: MUTED, fontSize: 13, lineHeight: 19 },
  panel: { backgroundColor: '#fff', borderColor: LINE, borderWidth: 1, borderRadius: 14, padding: 14, gap: 10 },
  text: { color: INK, fontSize: 14, flexShrink: 1 },
  muted: { color: MUTED, fontSize: 12, lineHeight: 18, flexShrink: 1 },
  search: { minHeight: 46, backgroundColor: '#fff', borderColor: LINE, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  input: { flex: 1, minWidth: 0, color: INK, fontSize: 15, paddingVertical: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconBox: { width: 44, height: 44, borderRadius: 12, backgroundColor: '#EAF2ED', alignItems: 'center', justifyContent: 'center' },
  result: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: LINE, paddingVertical: 8 },
  cardImage: { width: 78, height: 66, borderRadius: 10, backgroundColor: '#EDF0F2' },
  action: { minHeight: 44, borderRadius: 10, backgroundColor: RED, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  actionText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  secondary: { minHeight: 42, borderRadius: 10, backgroundColor: '#fff', borderWidth: 1, borderColor: LINE, paddingHorizontal: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: LINE, backgroundColor: '#fff' },
  chipOn: { backgroundColor: RED, borderColor: RED },
});

type QuickTool = { title: string; icon: keyof typeof Feather.glyphMap; route: '/tools/most-viewed' | '/tools/customs' | '/tools/catalog' };
const QUICK_TOOLS: QuickTool[] = [
  { title: 'Ən çox baxılanlar', icon: 'trending-up', route: '/tools/most-viewed' },
  { title: 'Gömrük kalkulyatoru', icon: 'grid', route: '/tools/customs' },
  { title: 'Avtokataloq', icon: 'book-open', route: '/tools/catalog' },
];

export function HomeQuickTools() {
  const router = useRouter();
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, gap: 10, paddingVertical: 9 }}>
    {QUICK_TOOLS.map(tool => <Pressable key={tool.route} accessibilityRole="button" onPress={() => router.push(tool.route)} style={styles.secondary}>
      <Feather name={tool.icon} size={17} color={GREEN}/><Text style={[styles.text, { fontWeight: '700' }]}>{tool.title}</Text>
    </Pressable>)}
  </ScrollView>;
}

export function HomeDirectoryCards({ todayCount, countLoading }: { todayCount: number | null; countLoading: boolean }) {
  const router = useRouter();
  return <View style={{ flexDirection: 'row', gap: 9, paddingHorizontal: 14, marginTop: 3 }}>
    <Pressable accessibilityRole="button" onPress={() => router.push({ pathname: '/category/[key]', params: { key: 'cars', title: 'Avtomobillər' } })} style={[styles.panel, { flex: 1, minWidth: 0, padding: 12, minHeight: 78, justifyContent: 'center' }]}>
      <Text style={[styles.text, { fontWeight: '800' }]}>Bu gün yerləşdirilən elanlar</Text>
      <Text style={styles.muted}>{countLoading ? 'Yoxlanılır…' : todayCount === null ? 'Say əlçatan deyil' : `${todayCount.toLocaleString('az-AZ')} aktiv avtomobil elanı`}</Text>
    </Pressable>
    <Pressable accessibilityRole="button" onPress={() => router.push('/tools/dealers')} style={[styles.panel, { flex: 1, minWidth: 0, padding: 12, minHeight: 78, justifyContent: 'center' }]}>
      <View style={styles.row}><View style={[styles.iconBox, { width: 34, height: 34 }]}><Feather name="briefcase" size={17} color={GREEN}/></View><View style={{ flex: 1, minWidth: 0 }}><Text style={[styles.text, { fontWeight: '800' }]}>Dilerlər</Text><Text style={styles.muted}>Təsdiqlənmiş salonlar</Text></View></View>
    </Pressable>
  </View>;
}

const SERVICE_CARDS = [
  { title: 'Usta çağır', route: '/service/mechanic_service', image: require('../../assets/service-cards/mechanic.webp') },
  { title: 'Evakuator', route: '/service/tow_service', image: require('../../assets/service-cards/tow.webp') },
  { title: 'Yükdaşıma', route: '/service/cargo_service', image: require('../../assets/service-cards/cargo.webp') },
  { title: 'Yaxın məntəqələr', route: '/locations', image: require('../../assets/service-cards/nearby.webp') },
  { title: 'CarCareKiosk', route: 'carcare', image: require('../../assets/service-cards/carcare.webp') },
] as const;

export function HomeServiceCards() {
  const router = useRouter();
  return <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 14, gap: 10 }}>
    {SERVICE_CARDS.map(card => <Pressable key={card.title} accessibilityRole="button" onPress={() => {
      if (card.route === 'carcare') void Linking.openURL('https://www.carcarekiosk.com/').catch(() => Alert.alert('Keçid açılmadı', 'CarCareKiosk hazırda açıla bilmir.'));
      else router.push(card.route as never);
    }} style={{ width: 145, overflow: 'hidden', borderRadius: 13, backgroundColor: '#fff', borderColor: LINE, borderWidth: 1 }}>
      <Image source={card.image} resizeMode="cover" style={{ width: '100%', height: 82 }}/>
      <Text style={[styles.text, { fontSize: 12, fontWeight: '800', padding: 9 }]}>{card.title}</Text>
    </Pressable>)}
  </ScrollView>;
}

function ScreenState({ title, detail, retry, busy = false }: { title: string; detail?: string; retry?: () => void; busy?: boolean }) {
  return <View style={[styles.panel, { alignItems: 'center', paddingVertical: 26 }]}>
    {busy ? <ActivityIndicator color={GREEN}/> : <Feather name="info" size={22} color={MUTED}/>}
    <Text style={[styles.text, { fontWeight: '800', textAlign: 'center' }]}>{title}</Text>
    {detail ? <Text style={[styles.muted, { textAlign: 'center' }]}>{detail}</Text> : null}
    {retry ? <Pressable onPress={retry} style={styles.action}><Text style={styles.actionText}>Yenidən yoxla</Text></Pressable> : null}
  </View>;
}

export function CustomsCalculatorScreen() {
  const [failed, setFailed] = useState(false);
  const [reload, setReload] = useState(0);
  const allowOfficialNavigation = useCallback((request: { url: string }) => {
    try {
      const target = new URL(request.url);
      return target.protocol === 'https:' && (target.hostname === 'customs.gov.az' || target.hostname.endsWith('.customs.gov.az'));
    } catch { return false; }
  }, []);
  return <View style={styles.page}>
    <View style={{ padding: 14, gap: 5, backgroundColor: '#fff' }}>
      <Text style={styles.title}>Gömrük kalkulyatoru</Text>
      <Text style={styles.subtitle}>Hesablama Dövlət Gömrük Komitəsinin rəsmi kalkulyatorunda aparılır. İstehsal tarixi, mühərrik, yanacaq, invoys və daşınma dəyərini orada daxil edin.</Text>
    </View>
    {failed ? <View style={{ padding: 16 }}><ScreenState title="Rəsmi kalkulyator yüklənmədi" detail="İnternet bağlantısını yoxlayın və ya Dövlət Gömrük Komitəsinin kalkulyatorunu brauzerdə açın." retry={() => { setFailed(false); setReload(v => v + 1); }}/><Pressable onPress={() => void Linking.openURL(OFFICIAL_AUTO_CUSTOMS_CALCULATOR)} style={[styles.secondary, { marginTop: 10 }]}><Text style={styles.text}>Rəsmi saytı aç</Text><Feather name="external-link" size={16} color={GREEN}/></Pressable></View> : <WebView
      key={reload}
      source={{ uri: OFFICIAL_AUTO_CUSTOMS_CALCULATOR }}
      originWhitelist={['https://*']}
      javaScriptEnabled
      domStorageEnabled
      onShouldStartLoadWithRequest={allowOfficialNavigation}
      onError={() => setFailed(true)}
      onHttpError={event => { if (event.nativeEvent.statusCode >= 400) setFailed(true); }}
      startInLoadingState
      renderLoading={() => <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' }}><ActivityIndicator color={GREEN}/><Text style={styles.muted}>Rəsmi tariflər yüklənir…</Text></View>}
      style={{ flex: 1, backgroundColor: '#fff' }}
      accessibilityLabel="Dövlət Gömrük Komitəsinin rəsmi avtomobil kalkulyatoru"
    />}
    <Text style={[styles.muted, { padding: 10, backgroundColor: '#fff' }]}>Gömrük dəyəri və yekun ödəniş rəsmiləşdirmə zamanı dəyişə bilər. Mənbə: e.customs.gov.az</Text>
  </View>;
}

export function AutoCatalogScreen() {
  const router = useRouter();
  const client = useMemo(() => getSupabaseClient(), []);
  const [brand, setBrand] = useState('');
  const [model, setModel] = useState('');
  const [search, setSearch] = useState('');
  const [rows, setRows] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const brands = (vehicleCatalog.brands as string[]).filter(value => value.toLocaleLowerCase('az-AZ').includes(search.trim().toLocaleLowerCase('az-AZ')));
  const models = (vehicleModels[brand] || []).filter(value => value.toLocaleLowerCase('az-AZ').includes(search.trim().toLocaleLowerCase('az-AZ')));
  const load = useCallback(async (selectedBrand: string, selectedModel: string) => {
    if (!client) { setError('Mobil kataloq üçün TEST Supabase public konfiqurasiyası yoxdur.'); return; }
    const category = categoryConfig('cars');
    if (!category) return;
    setLoading(true); setError('');
    try {
      const found: Listing[] = await listCategory(client, category, { from: 0, to: 39, brand: selectedBrand, model: selectedModel });
      setRows(await Promise.all(found.map((row: Listing) => attachMedia(client, category, row))));
    } catch (e) { setError(userErrorMessage(e, 'Aktiv elanlar alınmadı.')); setRows([]); }
    finally { setLoading(false); }
  }, [client]);
  useEffect(() => { let live = true; queueMicrotask(() => { if (!live) return; if (brand && model) void load(brand, model); else setRows([]); }); return () => { live = false; }; }, [brand, model, load]);
  return <ScrollView style={styles.page} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
    <Text style={styles.title}>Avtokataloq</Text>
    <Text style={styles.subtitle}>Markalar və modellər A-USTA kataloqundan, illər və texniki məlumatlar isə həmin model üzrə aktiv elanlardan göstərilir. Ayrı model nəsli məlumatı olmayan yerdə nəsil uydurulmur.</Text>
    <View style={styles.search}><Feather name="search" size={18} color={MUTED}/><TextInput value={search} onChangeText={setSearch} placeholder={brand ? `${brand} modelini axtar` : 'Marka axtar'} placeholderTextColor={MUTED} style={styles.input}/></View>
    {brand ? <Pressable onPress={() => { setBrand(''); setModel(''); setSearch(''); }} style={styles.secondary}><Feather name="arrow-left" size={17} color={GREEN}/><Text style={styles.text}>{brand} · Markalara qayıt</Text></Pressable> : null}
    {!brand ? <View style={styles.panel}><Text style={[styles.text, { fontWeight: '800' }]}>Markalar · {brands.length}</Text>{brands.map(item => <Pressable key={item} onPress={() => { setBrand(item); setSearch(''); }} style={styles.result}><View style={styles.iconBox}><Feather name="truck" size={20} color={GREEN}/></View><Text style={[styles.text, { flex: 1, fontWeight: '700' }]}>{item}</Text><Feather name="chevron-right" size={17} color={MUTED}/></Pressable>)}</View> : !model ? <View style={styles.panel}><Text style={[styles.text, { fontWeight: '800' }]}>{brand} modelləri · {models.length}</Text>{models.map(item => <Pressable key={item} onPress={() => { setModel(item); setSearch(''); }} style={styles.result}><Text style={[styles.text, { flex: 1 }]}>{item}</Text><Feather name="chevron-right" size={17} color={MUTED}/></Pressable>)}{models.length === 0 ? <Text style={styles.muted}>Bu marka üçün model kataloq məlumatı yoxdur.</Text> : null}</View> : <>
      <View style={styles.row}><View style={{ flex: 1 }}><Text style={[styles.text, { fontWeight: '800' }]}>{brand} {model}</Text><Text style={styles.muted}>{rows.length} nəticə yükləndi</Text></View><Pressable onPress={() => { setModel(''); setSearch(''); }} style={styles.secondary}><Text style={styles.text}>Modellər</Text></Pressable></View>
      {loading ? <ScreenState title="Aktiv elanlar yüklənir" busy/> : error ? <ScreenState title="Elanlar alınmadı" detail={error} retry={() => void load(brand, model)}/> : rows.length ? rows.map(item => <ListingResult key={item.id} item={item} onPress={() => router.push({ pathname: '/listing/[id]', params: { id: item.id, key: 'cars' } })}/>) : <ScreenState title="Aktiv elan tapılmadı" detail="Kataloqda model var, lakin hazırda uyğun aktiv A-USTA elanı yoxdur."/>}
    </>}
  </ScrollView>;
}

function ListingResult({ item, onPress }: { item: Listing; onPress: () => void }) {
  const image = item._media?.find(media => media.media_type === 'image')?.url;
  return <Pressable onPress={onPress} style={[styles.panel, styles.row]}>
    {image ? <Image source={{ uri: image }} style={styles.cardImage} resizeMode="cover"/> : <View style={[styles.cardImage, { alignItems: 'center', justifyContent: 'center' }]}><Feather name="image" size={20} color={MUTED}/></View>}
    <View style={{ flex: 1, minWidth: 0, gap: 4 }}><Text style={[styles.text, { fontWeight: '800' }]}>{item.brand} {item.model} · {item.year || 'İl göstərilməyib'}</Text><Text style={styles.muted}>{[item.engine, item.engine_volume ? `${item.engine_volume} L` : null, item.fuel_type, item.mileage ? `${Number(item.mileage).toLocaleString('az-AZ')} km` : null].filter(Boolean).join(' · ') || 'Texniki məlumat elanda göstərilməyib'}</Text><Text style={{ color: GREEN, fontWeight: '800', fontSize: 13 }}>{item.price == null ? 'Qiymət soruşun' : `${Number(item.price).toLocaleString('az-AZ')} AZN`}</Text></View>
  </Pressable>;
}

export function DealerDirectoryScreen() {
  const router = useRouter();
  const client = useMemo(() => getSupabaseClient(), []);
  const [entries, setEntries] = useState<DealerDirectoryEntry[]>([]);
  const [selected, setSelected] = useState<DealerDirectoryEntry | null>(null);
  const [selectedRows, setSelectedRows] = useState<Listing[]>([]);
  const [listingOffset, setListingOffset] = useState(8);
  const [hasMoreListings, setHasMoreListings] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!client) { setError('TEST Supabase public konfiqurasiyası yoxdur.'); setLoading(false); return; }
    setLoading(true); setError('');
    try { setEntries(await getVerifiedDealerDirectory(client)); }
    catch (e) { setError(userErrorMessage(e, 'Təsdiqlənmiş salonlar alınmadı.')); }
    finally { setLoading(false); }
  }, [client]);
  useEffect(() => { let live = true; queueMicrotask(() => { if (live) void load(); }); return () => { live = false; }; }, [load]);
  const visible = entries.filter(entry => entry.name.toLocaleLowerCase('az-AZ').includes(query.trim().toLocaleLowerCase('az-AZ')));
  const selectDealer = (entry: DealerDirectoryEntry) => { setSelected(entry); setSelectedRows(entry.listings); setListingOffset(8); setHasMoreListings(entry.activeListingCount > entry.listings.length); };
  const loadMore = async () => {
    if (!client || !selected || loadingMore) return;
    setLoadingMore(true);
    try {
      const category = categoryConfig('cars');
      if (!category) throw new Error('Avtomobil kateqoriyası mövcud deyil.');
      const { data, error: queryError } = await client.from('vehicle_listings')
        .select('id,owner_id,seller_profile_id,status,listing_type,brand,model,year,mileage,engine,engine_volume,fuel_type,price,region,created_at,details')
        .eq('seller_profile_id', selected.profileId).eq('status', 'active').eq('listing_type', 'sale')
        .order('created_at', { ascending: false }).range(listingOffset, listingOffset + 7);
      if (queryError) throw queryError;
      const next = (data || []).filter((row: Record<string, unknown>) => row.seller_profile_id === selected.profileId && row.status === 'active' && row.listing_type === 'sale')
        .map((row: Record<string, unknown>) => ({ ...row, _source: 'vehicle', _category: 'cars' })) as Listing[];
      const hydrated = await Promise.all(next.map(row => attachMedia(client, category, row)));
      setSelectedRows(current => [...current, ...hydrated]);
      setListingOffset(value => value + next.length);
      setHasMoreListings(listingOffset + next.length < selected.activeListingCount);
    } catch (e) { Alert.alert('Elanlar yüklənmədi', userErrorMessage(e, 'Yenidən cəhd edin.')); }
    finally { setLoadingMore(false); }
  };
  return <ScrollView style={styles.page} contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
    <Text style={styles.title}>{selected ? selected.name : 'Dilerlər'}</Text>
    <Text style={styles.subtitle}>{selected ? 'Yalnız salonun təsdiqlənmiş profilinə bağlı aktiv avtomobil elanları göstərilir.' : 'Siyahıda yalnız aktiv və təsdiqlənmiş A-USTA Avtosalon profilləri yer alır. Ad və elan sayı real TEST backend cavablarından alınır.'}</Text>
    {selected ? <Pressable onPress={() => setSelected(null)} style={styles.secondary}><Feather name="arrow-left" size={17} color={GREEN}/><Text style={styles.text}>Bütün dilerlər</Text></Pressable> : <View style={styles.search}><Feather name="search" size={18} color={MUTED}/><TextInput value={query} onChangeText={setQuery} placeholder="Diler axtar" placeholderTextColor={MUTED} style={styles.input}/></View>}
    {loading ? <ScreenState title="Təsdiqlənmiş profillər yoxlanılır" busy/> : error ? <ScreenState title="Diler siyahısı əlçatan deyil" detail={error} retry={() => void load()}/> : selected ? <>{selectedRows.map(item => <ListingResult key={item.id} item={item} onPress={() => router.push({ pathname: '/listing/[id]', params: { id: item.id, key: 'cars' } })}/>)}{selectedRows.length === 0 ? <ScreenState title="Aktiv elan yoxdur" detail="Bu təsdiqlənmiş salonun hazırda aktiv avtomobil elanı yoxdur."/> : null}{hasMoreListings ? <Pressable onPress={() => void loadMore()} style={styles.action} disabled={loadingMore}><Text style={styles.actionText}>{loadingMore ? 'Yüklənir…' : 'Daha çox elan göstər'}</Text></Pressable> : null}</> : visible.length ? visible.map(entry => <Pressable key={entry.profileId} onPress={() => selectDealer(entry)} style={[styles.panel, styles.row]}>
      {entry.latestListingImageUrl ? <Image source={{ uri: entry.latestListingImageUrl }} style={styles.cardImage} resizeMode="cover" accessibilityLabel="Salonun son aktiv elanından avtomobil şəkli"/> : <View style={[styles.cardImage, { alignItems: 'center', justifyContent: 'center' }]}><Feather name="briefcase" size={22} color={GREEN}/></View>}
      <View style={{ flex: 1, minWidth: 0, gap: 4 }}><Text style={[styles.text, { fontWeight: '800' }]}>{entry.name}</Text><Text style={styles.muted}>{entry.listingRegion ? `Elan yeri: ${entry.listingRegion}` : 'Salon şəhəri açıq profildə yoxdur'}</Text><Text style={styles.muted}>{entry.activeListingCount.toLocaleString('az-AZ')} aktiv avtomobil elanı</Text></View><Feather name="chevron-right" size={17} color={MUTED}/>
    </Pressable>) : <ScreenState title="Təsdiqlənmiş diler profili tapılmadı" detail="Aktiv və təsdiqlənmiş biznes profili olmadıqda saxta salon göstərilmir."/>}
  </ScrollView>;
}

export function MostViewedScreen() {
  const router = useRouter();
  const client = useMemo(() => getSupabaseClient(), []);
  const [rows, setRows] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    if (!client) { setError('TEST Supabase public konfiqurasiyası yoxdur.'); setLoading(false); return; }
    setLoading(true); setError('');
    try { setRows(await getMostViewedActiveCars(client)); }
    catch (e) { setError(userErrorMessage(e, 'Baxış göstəriciləri alınmadı.')); }
    finally { setLoading(false); }
  }, [client]);
  useEffect(() => { let live = true; queueMicrotask(() => { if (live) void load(); }); return () => { live = false; }; }, [load]);
  return <ScrollView style={styles.page} contentContainerStyle={styles.body}>
    <Text style={styles.title}>Ən çox baxılanlar</Text>
    <Text style={styles.subtitle}>Son 40 aktiv avtomobil elanı mövcud, serverdə saxlanan baxış sayına görə sıralanır. Baxış sayı olmayan və ya əlçatan olmayan məlumat uydurulmur.</Text>
    {loading ? <ScreenState title="Baxış statistikası yüklənir" busy/> : error ? <ScreenState title="Statistika alınmadı" detail={error} retry={() => void load()}/> : rows.length ? rows.map(item => <Pressable key={item.id} onPress={() => router.push({ pathname: '/listing/[id]', params: { id: item.id, key: 'cars' } })} style={[styles.panel, styles.row]}>
      <View style={styles.iconBox}><Feather name="eye" size={19} color={GREEN}/></View><View style={{ flex: 1, minWidth: 0 }}><Text style={[styles.text, { fontWeight: '800' }]}>{item.brand} {item.model}</Text><Text style={styles.muted}>{Number((item as Listing & { view_count?: number }).view_count || 0).toLocaleString('az-AZ')} baxış · {item.year || 'İl göstərilməyib'}</Text></View><Feather name="chevron-right" size={17} color={MUTED}/>
    </Pressable>) : <ScreenState title="Aktiv elan yoxdur" detail="Baxış statistikası üçün aktiv avtomobil elanları olmalıdır."/>}
  </ScrollView>;
}

export function customsCalculatorOriginAllowed(url: string) {
  try { const parsed = new URL(url); return parsed.protocol === 'https:' && (parsed.hostname === 'customs.gov.az' || parsed.hostname.endsWith('.customs.gov.az')); }
  catch { return false; }
}

export { OFFICIAL_AUTO_CUSTOMS_CALCULATOR };
