import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const GREEN = '#176244';
const INK = '#202A35';
const MUTED = '#7A8491';
const LINE = '#E8EBEF';
const CARCARE_URL = 'https://www.carcarekiosk.com/';

const serviceItems = [
  { title: 'Usta çağır', key: 'mechanic_service', icon: 'tool', note: 'Mobil usta və servis sifarişi' },
  { title: 'Evakuator', key: 'tow_service', icon: 'truck', note: 'Yol yardımına sifariş' },
  { title: 'Yükdaşıma', key: 'cargo_service', icon: 'package', note: 'Avtomobil və yük daşınması' },
  { title: 'Yaxın məntəqələr', key: 'locations', icon: 'map-pin', note: 'Xəritədə xidmət nöqtələri' },
  { title: 'CarCareKiosk', key: 'carcare', icon: 'external-link', note: 'Təmir videoları və təlimatlar' },
] as const;

type Props = { navigation: { closeDrawer: () => void } };

export function ServiceDrawer({ navigation }: Props) {
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

  return <ScrollView contentContainerStyle={[styles.content, { paddingTop: Math.max(safe.top, 18) }]}>
    <View style={styles.brand}><Text accessibilityRole="header" style={styles.wordmark}>A-USTA</Text><Text style={styles.caption}>Avtomobil dünyası bir yerdə</Text></View>
    <View style={styles.divider} />
    <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(value => !value)} style={styles.accordion}>
      <View style={styles.leading}><Feather name="grid" size={19} color={GREEN} /><Text style={styles.accordionText}>A-USTA xidmətləri</Text></View>
      <Feather name={open ? 'chevron-up' : 'chevron-down'} size={19} color={MUTED} />
    </Pressable>
    {open && <View style={styles.serviceList}>{serviceItems.map(item => <Pressable key={item.key} accessibilityRole="button" onPress={() => go(item.key, item.title)} style={styles.serviceLink}>
      <View style={styles.serviceIcon}><Feather name={item.icon} size={18} color={GREEN} /></View>
      <View style={styles.serviceCopy}><Text style={styles.serviceTitle}>{item.title}</Text><Text style={styles.serviceNote}>{item.note}</Text></View>
      <Feather name="chevron-right" size={17} color="#A1A8B1" />
    </Pressable>)}</View>}
    <View style={styles.divider} />
    <Pressable accessibilityRole="button" onPress={() => { navigation.closeDrawer(); setOpen(false); }} style={styles.nav}><Feather name="home" size={19} color={INK} /><Text style={styles.navText}>Əsas səhifə</Text></Pressable>
    <Pressable accessibilityRole="button" onPress={() => { navigation.closeDrawer(); setOpen(false); setTimeout(() => router.navigate('/(drawer)/(tabs)/account'), 100); }} style={styles.nav}><Feather name="user" size={19} color={INK} /><Text style={styles.navText}>Şəxsi kabinet</Text></Pressable>
    <Text style={styles.footer}>A-USTA · Mobil tətbiq</Text>
  </ScrollView>;
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, paddingHorizontal: 16, paddingBottom: 22 },
  brand: { paddingVertical: 19, paddingHorizontal: 8 },
  wordmark: { color: GREEN, fontSize: 22, fontWeight: '900', letterSpacing: 1.1, flexShrink: 0 },
  caption: { color: MUTED, fontSize: 12, marginTop: 5 },
  divider: { height: 1, backgroundColor: LINE, marginVertical: 8 },
  accordion: { minHeight: 50, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 9, borderRadius: 10 },
  leading: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 11 },
  accordionText: { flexShrink: 1, color: INK, fontWeight: '800', fontSize: 14 },
  serviceList: { paddingLeft: 5, paddingVertical: 3 },
  serviceLink: { minHeight: 57, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 5, paddingVertical: 6, borderRadius: 9 },
  serviceIcon: { width: 36, height: 36, borderRadius: 11, backgroundColor: '#EAF2ED', alignItems: 'center', justifyContent: 'center' },
  serviceCopy: { flex: 1, minWidth: 0 },
  serviceTitle: { flexShrink: 1, fontSize: 13, fontWeight: '700', color: INK },
  serviceNote: { flexShrink: 1, fontSize: 10, color: MUTED, marginTop: 2 },
  nav: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 9, paddingVertical: 6 },
  navText: { flexShrink: 1, fontSize: 13, fontWeight: '600', color: INK },
  footer: { color: MUTED, fontSize: 10, marginTop: 'auto', paddingHorizontal: 9, paddingTop: 30 },
});
