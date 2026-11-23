import { useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

const GREEN = '#176244';
const BG = '#F4F6F8';
const INK = '#202A35';
const MUTED = '#7A8491';
const LINE = '#E8EBEF';

function Row({ icon, title, detail, action, disabled = false }: { icon: keyof typeof Feather.glyphMap; title: string; detail?: string; action?: () => void; disabled?: boolean }) {
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={action} style={({ pressed }) => [s.row, pressed && !disabled && { backgroundColor: '#F8F9FA' }, disabled && { opacity: 0.65 }]}>
    <Feather name={icon} size={19} color={title === 'Qaranlıq rejim' ? MUTED : GREEN}/>
    <View style={{ flex: 1, minWidth: 0 }}><Text style={s.title}>{title}</Text>{detail ? <Text style={s.detail}>{detail}</Text> : null}</View>
    {disabled ? <Text style={s.detail}>Hazır deyil</Text> : <Feather name="chevron-right" size={18} color={MUTED}/>}
  </Pressable>;
}

export function SettingsScreen() {
  const router = useRouter();
  const [notice, setNotice] = useState('');
  const open = (url: string) => void Linking.openURL(url).catch(() => Alert.alert('Keçid açılmadı', 'İnternet bağlantısını yoxlayın və yenidən cəhd edin.'));
  const notificationSettings = async () => {
    try { await Linking.openSettings(); setNotice('Bildiriş icazələrini telefonun A-USTA tətbiq parametrlərində idarə edin.'); }
    catch { Alert.alert('Parametrlər açılmadı', 'Telefonun Parametrlər bölməsindən A-USTA tətbiqinə daxil olub bildiriş icazələrini yoxlayın.'); }
  };
  return <ScrollView style={s.screen} contentContainerStyle={s.content}>
    <View style={s.header}><Pressable accessibilityRole="button" accessibilityLabel="Geri" onPress={() => router.back()} style={s.back}><Feather name="arrow-left" size={21} color={INK}/></Pressable><Text style={s.headerTitle}>Parametrlər</Text><View style={{ width: 32 }}/></View>
    <View style={s.panel}>
      <Text style={s.section}>Parametrlər</Text>
      <Row icon="sun" title="Tərtibat rejimi · Açıq" detail="Açıq tema hazırda istifadə olunur." disabled/>
      <Row icon="moon" title="Qaranlıq rejim" detail="Bu mobil builddə tam qaranlıq tema yoxdur." disabled/>
      <Row icon="globe" title="Dil · Azərbaycan dili" detail="Rus dilində tam tərcümə hazır olmadığı üçün seçim göstərilmir." disabled/>
      <Row icon="dollar-sign" title="Valyuta · AZN" detail="Digər valyutalar üçün canlı məzənnə və çevirmə sistemi yoxdur." disabled/>
      <Row icon="bell" title="Bildiriş icazələri" detail="Telefonun A-USTA tətbiq icazələrini açın." action={() => void notificationSettings()}/>
      {notice ? <Text accessibilityRole="status" style={s.notice}>{notice}</Text> : null}
    </View>
    <View style={s.panel}>
      <Text style={s.section}>Kömək və məlumat</Text>
      <Row icon="help-circle" title="Kömək edin" action={() => open('https://a-usta.az')}/>
      <Row icon="mail" title="Bizimlə əlaqə" action={() => open('https://a-usta.az/#contact')}/>
      <Row icon="info" title="Tətbiq haqqında" action={() => Alert.alert('A-USTA mobil tətbiqi', 'A-USTA avtomobil elanları və xidmət platformasıdır. Valyuta: AZN. Dil: Azərbaycan dili.')}/>
    </View>
    <Text style={s.foot}>Bildiriş göndərişi ayrıca server xidmətindən asılıdır. Tətbiq push bildirişlərini dəstəklənirmiş kimi göstərmir.</Text>
  </ScrollView>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG }, content: { paddingBottom: 24, gap: 12 },
  header: { minHeight: 56, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: LINE, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 32, height: 40, justifyContent: 'center' }, headerTitle: { color: INK, fontSize: 18, fontWeight: '800' },
  panel: { marginHorizontal: 12, marginTop: 12, paddingHorizontal: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: LINE, borderRadius: 14 },
  section: { paddingTop: 15, paddingBottom: 4, color: INK, fontSize: 16, fontWeight: '800' },
  row: { minHeight: 61, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: LINE, paddingVertical: 10 },
  title: { color: INK, fontSize: 14, fontWeight: '700', flexShrink: 1 }, detail: { color: MUTED, fontSize: 11, lineHeight: 16, flexShrink: 1 },
  notice: { paddingVertical: 10, color: GREEN, fontSize: 12 }, foot: { marginHorizontal: 16, color: MUTED, fontSize: 11, lineHeight: 17 },
});
