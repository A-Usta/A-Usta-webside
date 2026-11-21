import 'react-native-gesture-handler';
import { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getSupabaseClient } from './src/lib/supabase';

type ServiceKey = 'mechanic_service' | 'tow_service' | 'cargo_service';
type Listing = { id: string; listing_type: string; brand: string; model: string; year: number | null; mileage: number | null; engine_volume: number | null; price: number | null; region: string | null; promotion_type: string | null; promotion_until: string | null };

const GREEN = '#176244';
const INK = '#202A35';
const MUTED = '#7A8491';
const LINE = '#E8EBEF';
const CARCARE_URL = 'https://www.carcarekiosk.com/';

const categories = [
  ['cars', 'Avtomobillər', 'truck'], ['dealer', 'Avtosalonlar', 'home'], ['service', 'Avtoservislər', 'tool'], ['rent', 'Rent a Car', 'key'],
  ['parts', 'Ehtiyat hissələri', 'settings'], ['accessories', 'Aksesuarlar', 'plus-circle'], ['moto', 'Moto / Skuter', 'wind'], ['special', 'Xüsusi texnika', 'truck'],
  ['bus', 'Avtobuslar', 'truck'], ['trailer', 'Qoşqular', 'link'], ['water', 'Su nəqliyyatı', 'anchor'], ['caravan', 'Karavanlar', 'home'],
  ['plate', 'Dövlət nömrələri', 'hash'], ['usta', 'Ustalar', 'tool'], ['insurance', 'Sığorta şirkətləri', 'shield'], ['sober_driver', 'Ayıq sürücü', 'user-check'], ['leasing', 'Lizinq şirkətləri', 'credit-card'],
] as const;

const serviceItems: { title: string; key: ServiceKey | 'locations' | 'carcare'; icon: keyof typeof Feather.glyphMap; note: string }[] = [
  { title: 'Usta çağır', key: 'mechanic_service', icon: 'tool', note: 'Mobil usta və servis sifarişi' },
  { title: 'Evakuator', key: 'tow_service', icon: 'truck', note: 'Yol yardımına sifariş' },
  { title: 'Yükdaşıma', key: 'cargo_service', icon: 'package', note: 'Avtomobil və yük daşınması' },
  { title: 'Yaxın məntəqələr', key: 'locations', icon: 'map-pin', note: 'Xəritədə xidmət nöqtələri' },
  { title: 'CarCareKiosk', key: 'carcare', icon: 'external-link', note: 'Təmir videoları və təlimatlar' },
];

function Wordmark({ small = false }: { small?: boolean }) {
  return <Text accessibilityRole="header" style={[styles.wordmark, small && styles.wordmarkSmall]}>A-USTA</Text>;
}

export function ServiceDrawer({ navigation }: { navigation: { closeDrawer: () => void } }) {
  const [open, setOpen] = useState(false);
  const safe = useSafeAreaInsets();
  const router = useRouter();
  const go = (key: string, title: string) => {
    navigation.closeDrawer();
    setTimeout(() => {
      if (key === 'locations') router.push('/locations');
      else if (key === 'carcare') void Linking.openURL(CARCARE_URL).catch(() => Alert.alert('Keçid açılmadı', 'CarCareKiosk səhifəsi hazırda açıla bilmir.'));
      else router.push({ pathname: '/service/[key]', params: { key, title } });
    }, 180);
  };
  return <ScrollView contentContainerStyle={[styles.drawerContent, { paddingTop: Math.max(safe.top, 18) }]}>
    <View style={styles.drawerBrand}><Wordmark /><Text style={styles.drawerCaption}>Avtomobil dünyası bir yerdə</Text></View>
    <View style={styles.drawerDivider} />
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(value => !value)} style={({ pressed }) => [styles.accordionTitle, pressed && styles.pressed]}>
      <View style={styles.accordionLeading}><Feather name="grid" size={19} color={GREEN} /><Text style={styles.accordionText}>A-USTA xidmətləri</Text></View>
      <Feather name={open ? 'chevron-up' : 'chevron-down'} size={19} color={MUTED} />
    </Pressable>
    {open && <View style={styles.serviceList}>{serviceItems.map(item => <Pressable key={item.key} accessibilityRole="button" onPress={() => go(item.key, item.title)} style={({ pressed }) => [styles.serviceLink, pressed && styles.pressed]}>
      <View style={styles.serviceIcon}><Feather name={item.icon} size={18} color={GREEN} /></View><View style={styles.serviceCopy}><Text style={styles.serviceTitle}>{item.title}</Text><Text numberOfLines={1} style={styles.serviceNote}>{item.note}</Text></View><Feather name="chevron-right" size={17} color="#A1A8B1" />
    </Pressable>)}</View>}
    <View style={styles.drawerDivider} />
    <Pressable accessibilityRole="button" onPress={() => { navigation.closeDrawer(); setOpen(false); }} style={styles.drawerNav}><Feather name="home" size={19} color={INK} /><Text style={styles.drawerNavText}>Əsas səhifə</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={() => { navigation.closeDrawer(); setOpen(false); setTimeout(() => router.navigate('/(drawer)/(tabs)/account'), 100); }} style={styles.drawerNav}><Feather name="user" size={19} color={INK} /><Text style={styles.drawerNavText}>Şəxsi kabinet</Text></Pressable>
    <Text style={styles.drawerFooter}>A-USTA · Mobil tətbiq</Text>
  </ScrollView>;
}

export function HomeScreen() {
  const router = useRouter();
  const drawer = useNavigation('/(drawer)') as ReturnType<typeof useNavigation> & { openDrawer?: () => void };
  const safe = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const sb = useMemo(() => getSupabaseClient(), []);
  const load = async () => {
    if (!sb) { setListings([]); setError('Elanları yükləmək üçün mobil Supabase konfiqurasiyası tələb olunur.'); setLoading(false); setRefreshing(false); return; }
    try {
      setError('');
      const { data, error: requestError } = await sb.from('vehicle_listings').select('id,listing_type,brand,model,year,mileage,engine_volume,price,region,promotion_type,promotion_until').eq('status', 'active').eq('listing_type', 'sale').order('created_at', { ascending: false }).order('id', { ascending: false }).limit(20);
      if (requestError) throw requestError;
      setListings((data || []).filter((row: Listing) => row?.id && typeof row.brand === 'string' && typeof row.model === 'string') as Listing[]);
    } catch { setError('Elanlar yüklənmədi. Bağlantını yoxlayıb yenidən cəhd edin.'); }
    finally { setLoading(false); setRefreshing(false); }
  };
  useEffect(() => { void load(); }, [sb]);
  const openCategory = (key: string, title: string) => router.push({ pathname: '/category/[key]', params: { key, title } });
  return <ScrollView style={styles.screen} contentContainerStyle={styles.homeContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); void load(); }} tintColor={GREEN} />}>
    <View style={[styles.homeHeader, { paddingTop: Math.max(12, safe.top + 6) }]}><Pressable accessibilityLabel="Xidmətlər menyusunu aç" accessibilityRole="button" onPress={() => drawer?.openDrawer?.()} hitSlop={10} style={styles.menuButton}><Feather name="menu" size={23} color={INK} /></Pressable><Wordmark /><Pressable accessibilityLabel="Bildirişlər" accessibilityRole="button" onPress={() => Alert.alert('Bildirişlər', 'Bildirişlər bölməsi hazırlanma mərhələsindədir.')} style={styles.notification}><Feather name="bell" size={21} color={INK} /></Pressable></View>
    <View style={styles.searchBox}><Feather name="search" size={19} color={MUTED} /><TextInput accessibilityLabel="Axtarış" placeholder="Marka, model və ya elan axtar" placeholderTextColor="#98A1AB" value={query} onChangeText={setQuery} style={styles.searchInput} returnKeyType="search" /><Pressable accessibilityLabel="Filtrlər" onPress={() => Alert.alert('Filtrlər', 'Axtarış filtrləri M3 mərhələsində qoşulacaq.')}><Feather name="sliders" size={20} color={GREEN} /></Pressable></View>
    <View style={styles.brandBanner}><Image source={require('./assets/austa-top-static-banner.webp')} style={styles.bannerImage} resizeMode="contain" accessibilityLabel="A-USTA reklamı" /></View>
    <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Kateqoriyalar</Text><Text style={styles.sectionHint}>Hamısına bax</Text></View>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryStrip}>{categories.slice(0, 6).map(([key, title, icon]) => <Pressable key={key} onPress={() => openCategory(key, title)} style={styles.categoryTile}><View style={styles.categoryIcon}><Feather name={icon as keyof typeof Feather.glyphMap} size={20} color={GREEN} /></View><Text numberOfLines={2} style={styles.categoryLabel}>{title}</Text></Pressable>)}</ScrollView>
    <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Son avtomobil elanları</Text><Pressable onPress={() => openCategory('cars', 'Avtomobillər')}><Text style={styles.moreText}>Hamısına bax</Text></Pressable></View>
    {loading ? <StateCard icon="loader" title="Elanlar yüklənir" body="A-USTA elanları yoxlanılır…" /> : error ? <StateCard icon="wifi-off" title="Elanlar hazırda əlçatan deyil" body={error} action="Yenidən yoxla" onAction={() => { setLoading(true); void load(); }} /> : listings.length === 0 ? <StateCard icon="search" title="Aktiv elan tapılmadı" body="Yeni elanlar dərc edildikdə burada görünəcək." /> : <View style={styles.listingGrid}>{listings.filter(item => !query || `${item.brand} ${item.model}`.toLowerCase().includes(query.toLowerCase())).slice(0, 8).map(item => <ListingCard key={item.id} item={item} onPress={() => router.push({ pathname: '/listing/[id]', params: { id: item.id } })} />)}</View>}
    <View style={styles.sectionHeading}><Text style={styles.sectionTitle}>Bütün elan kateqoriyaları</Text></View>
    <View style={styles.categoryList}>{categories.map(([key, title, icon]) => <Pressable key={key} onPress={() => openCategory(key, title)} style={({ pressed }) => [styles.categoryRow, pressed && styles.pressed]}><View style={styles.rowIcon}><Feather name={icon as keyof typeof Feather.glyphMap} size={18} color={GREEN} /></View><Text style={styles.categoryRowText}>{title}</Text><Feather name="chevron-right" size={19} color="#9AA3AE" /></Pressable>)}</View>
  </ScrollView>;
}

function ListingCard({ item, onPress }: { item: Listing; onPress: () => void }) {
  return <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.listingCard, pressed && styles.pressed]}>
    <View style={styles.listingImage}><Feather name="truck" size={30} color="#A6AFB9" /><Text style={styles.noMedia}>Şəkil mövcud deyil</Text></View>
    <Text numberOfLines={1} style={styles.listingPrice}>{item.price == null ? 'Qiymət soruşun' : `${Number(item.price).toLocaleString('az-AZ')} AZN`}</Text>
    <Text numberOfLines={1} style={styles.listingTitle}>{item.brand} {item.model}</Text>
    <Text numberOfLines={1} style={styles.listingMeta}>{[item.year, item.engine_volume ? `${item.engine_volume} L` : '', item.mileage ? `${Number(item.mileage).toLocaleString('az-AZ')} km` : ''].filter(Boolean).join(' · ')}</Text>
    <Text numberOfLines={1} style={styles.listingLocation}>{item.region || 'Azərbaycan'}</Text>
  </Pressable>;
}

export function CategoryScreen() {
  const { title } = useLocalSearchParams<{ title?: string }>();
  return <View style={styles.page}><StateCard icon="grid" title={title || 'Kateqoriya'} body="Kateqoriya siyahısı, uyğun filtrlər və elan forması M3 mərhələsində mövcud A-USTA API/DB müqavilələrinə bağlanacaq." /></View>;
}

export function ServiceScreen() {
  const { key = 'mechanic_service', title = 'Xidmət sifarişi' } = useLocalSearchParams<{ key?: ServiceKey; title?: string }>();
  const copy = key === 'mechanic_service' ? 'Avtomobiliniz üçün usta və ya servis sifarişi yaradın.' : key === 'tow_service' ? 'Evakuator xidmətinə ehtiyacınız olduqda sifariş məlumatlarını hazırlayın.' : 'Yükdaşıma xidmətinə müraciət edin.';
  return <View style={styles.page}><View style={styles.serviceHero}><View style={styles.serviceHeroIcon}><Feather name={key === 'tow_service' ? 'truck' : key === 'cargo_service' ? 'package' : 'tool'} size={31} color={GREEN} /></View><Text style={styles.pageTitle}>{title}</Text><Text style={styles.pageCopy}>{copy}</Text></View><StateCard icon="info" title="Sifariş forması inteqrasiya mərhələsindədir" body="Mobil tətbiq mövcud service-orders API və RLS müqaviləsinə qoşulacaq. Bu ekrandan hələ sifariş göndərilmir." /></View>;
}

export function ServiceLocationsScreen() { return <View style={styles.page}><StateCard icon="map-pin" title="Yaxın məntəqələr" body="Mövcud A-USTA xəritə RPC-si və büdcə qoruyucusu audit edildi. Mobil xəritə M4 mərhələsində qoşulacaq; bu ekran xarici xəritə sorğusu göndərmir." /></View>; }

export function ListingDetailScreen() { const { id = '' } = useLocalSearchParams<{ id?: string }>(); return <View style={styles.page}><StateCard icon="file-text" title="Elan məlumatı" body={`Elan: ${id}. Media imzalama və kateqoriyaya uyğun detalları M3 mərhələsində qoşulacaq.`} /></View>; }

export function CreateScreen() { return <View style={styles.page}><StateCard icon="plus-square" title="Yeni elan" body="Addım-addım elan forması kateqoriya, satıcı təsdiqi və mövcud media staging API-ləri ilə M3 mərhələsində qoşulacaq." /></View>; }

export function AccountScreen() { return <View style={styles.page}><StateCard icon="user" title="Şəxsi kabinet" body="Giriş, elanlar, sifarişlər, biznes profili, avtomobillər və servis tarixçəsi mövcud A-USTA hesabı ilə M5 mərhələsində qoşulacaq." /></View>; }

export function FavoritesScreen() { return <View style={styles.page}><StateCard icon="heart" title="Seçilmişlər" body="Yadda saxladığınız elanlar burada görünəcək." /></View>; }
export function MessagesScreen() { return <View style={styles.page}><StateCard icon="message-circle" title="Mesajlar" body="Elanlarla bağlı söhbətləriniz burada görünəcək." /></View>; }

function StateCard({ icon, title, body, action, onAction }: { icon: keyof typeof Feather.glyphMap; title: string; body: string; action?: string; onAction?: () => void }) {
  return <View style={styles.stateCard}><View style={styles.stateIcon}><Feather name={icon} size={23} color={GREEN} /></View><Text style={styles.cardTitle}>{title}</Text><Text style={styles.cardCopy}>{body}</Text>{action && <Pressable onPress={onAction} style={styles.primaryButton}><Text style={styles.primaryButtonText}>{action}</Text></Pressable>}</View>;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F4F6F8' }, homeContent: { paddingBottom: 28 },
  wordmark: { color: GREEN, fontSize: 22, fontWeight: '900', letterSpacing: 1.1 }, wordmarkSmall: { fontSize: 19 },
  homeHeader: { backgroundColor: '#FFFFFF', flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingTop: 12, paddingBottom: 14, gap: 16 }, menuButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }, notification: { marginLeft: 'auto', width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  searchBox: { marginHorizontal: 16, marginTop: 14, height: 50, borderRadius: 13, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: LINE, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10 }, searchInput: { flex: 1, paddingVertical: 0, color: INK, fontSize: 14 },
  brandBanner: { width: '100%', aspectRatio: 1920 / 210, overflow: 'hidden', backgroundColor: '#16120F' }, bannerImage: { width: '100%', height: '100%' },
  sectionHeading: { marginTop: 21, marginBottom: 11, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, sectionTitle: { color: INK, fontSize: 17, fontWeight: '800' }, sectionHint: { color: MUTED, fontSize: 12 }, moreText: { color: GREEN, fontWeight: '700', fontSize: 12 },
  categoryStrip: { gap: 10, paddingHorizontal: 16 }, categoryTile: { width: 82, alignItems: 'center', gap: 6 }, categoryIcon: { width: 60, height: 58, borderRadius: 16, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: LINE }, categoryLabel: { color: INK, fontSize: 10, textAlign: 'center', lineHeight: 14 },
  stateCard: { marginHorizontal: 16, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: LINE, padding: 20, alignItems: 'center' }, stateIcon: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#EAF2ED', alignItems: 'center', justifyContent: 'center', marginBottom: 11 }, cardTitle: { color: INK, fontSize: 14, fontWeight: '800', textAlign: 'center' }, cardCopy: { color: MUTED, fontSize: 12, textAlign: 'center', lineHeight: 18, marginTop: 7 }, primaryButton: { marginTop: 14, paddingHorizontal: 18, paddingVertical: 10, backgroundColor: GREEN, borderRadius: 10 }, primaryButtonText: { color: '#FFFFFF', fontWeight: '700', fontSize: 13 },
  listingGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 12, gap: 8 }, listingCard: { width: '48.8%', backgroundColor: '#FFFFFF', borderRadius: 13, overflow: 'hidden', paddingBottom: 10, borderWidth: 1, borderColor: LINE }, listingImage: { height: 125, backgroundColor: '#EFF2F4', alignItems: 'center', justifyContent: 'center' }, noMedia: { fontSize: 9, color: MUTED, marginTop: 5 }, listingPrice: { color: INK, fontSize: 15, fontWeight: '800', marginHorizontal: 10, marginTop: 8 }, listingTitle: { color: INK, fontSize: 12, fontWeight: '600', marginHorizontal: 10, marginTop: 4 }, listingMeta: { color: MUTED, fontSize: 10, marginHorizontal: 10, marginTop: 3 }, listingLocation: { color: MUTED, fontSize: 10, marginHorizontal: 10, marginTop: 4 },
  categoryList: { marginHorizontal: 16, borderRadius: 15, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: LINE, overflow: 'hidden' }, categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 11, minHeight: 51, paddingHorizontal: 12, borderBottomWidth: 1, borderBottomColor: LINE }, rowIcon: { width: 32, alignItems: 'center' }, categoryRowText: { flex: 1, color: INK, fontSize: 13, fontWeight: '600' },
  tabBar: { borderTopColor: LINE, backgroundColor: '#FFFFFF', paddingTop: 5 }, tabLabel: { fontSize: 9, fontWeight: '600', marginBottom: 2 }, createTab: { width: 48, height: 48, borderRadius: 24, backgroundColor: GREEN, justifyContent: 'center', alignItems: 'center', marginTop: -22, borderWidth: 4, borderColor: '#F4F6F8' },
  drawerContent: { flexGrow: 1, paddingHorizontal: 16, paddingBottom: 22 }, drawerBrand: { paddingVertical: 19, paddingHorizontal: 8 }, drawerCaption: { color: MUTED, fontSize: 12, marginTop: 5 }, drawerDivider: { height: 1, backgroundColor: LINE, marginVertical: 8 }, accordionTitle: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 9, borderRadius: 10 }, accordionLeading: { flexDirection: 'row', alignItems: 'center', gap: 11 }, accordionText: { color: INK, fontWeight: '800', fontSize: 14 }, serviceList: { paddingLeft: 5, paddingVertical: 3 }, serviceLink: { minHeight: 57, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 5, borderRadius: 9 }, serviceIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: '#EAF2ED', alignItems: 'center', justifyContent: 'center' }, serviceCopy: { flex: 1 }, serviceTitle: { fontSize: 13, fontWeight: '700', color: INK }, serviceNote: { fontSize: 10, color: MUTED, marginTop: 2 }, drawerNav: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 9 }, drawerNavText: { fontSize: 13, fontWeight: '600', color: INK }, drawerFooter: { color: MUTED, fontSize: 10, marginTop: 'auto', paddingHorizontal: 9, paddingTop: 30 }, pressed: { opacity: 0.72, backgroundColor: '#F1F5F2' },
  page: { flex: 1, backgroundColor: '#F4F6F8', paddingTop: 20 }, serviceHero: { alignItems: 'center', padding: 24, margin: 16, backgroundColor: '#FFFFFF', borderRadius: 17, borderWidth: 1, borderColor: LINE }, serviceHeroIcon: { width: 66, height: 66, borderRadius: 19, backgroundColor: '#EAF2ED', alignItems: 'center', justifyContent: 'center' }, pageTitle: { color: INK, fontSize: 21, fontWeight: '800', marginTop: 13 }, pageCopy: { color: MUTED, fontSize: 13, textAlign: 'center', lineHeight: 19, marginTop: 7 },
});
