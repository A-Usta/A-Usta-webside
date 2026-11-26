import { useCallback, useState } from 'react';
import { Alert, Linking, StyleSheet } from 'react-native';
import Constants from 'expo-constants';
import * as Location from 'expo-location';
import { useFocusEffect, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Feather, Pressable, ScrollView, Text, View } from '../lib/themed-native';
import { useAppSettings, type ThemeMode } from '../lib/app-settings';

const RED = '#D92D20';
const BG = '#F4F6F8';
const INK = '#202A35';
const MUTED = '#7A8491';
const LINE = '#E8EBEF';

const themeOptions: { value: ThemeMode; title: string; detail: string; icon: keyof typeof Feather.glyphMap }[] = [
  { value: 'light', title: 'Açıq', detail: 'Açıq rəng sxemi', icon: 'sun' },
  { value: 'dark', title: 'Qaranlıq', detail: 'Qaranlıq rəng sxemi', icon: 'moon' },
  { value: 'system', title: 'Sistemə uyğun', detail: 'Telefonun görünüş ayarını izləyir', icon: 'smartphone' },
];

export function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { themeMode, setThemeMode } = useAppSettings();
  const [notice, setNotice] = useState('');
  const [locationPermission, setLocationPermission] = useState<Location.PermissionStatus | 'unknown'>('unknown');
  const version = Constants.nativeApplicationVersion || Constants.expoConfig?.version || 'Məlum deyil';
  const build = Constants.nativeBuildVersion;

  useFocusEffect(useCallback(() => {
    let active = true;
    void Location.getForegroundPermissionsAsync().then(result => {
      if (active) setLocationPermission(result.status);
    }).catch(() => {
      if (active) setLocationPermission('unknown');
    });
    return () => { active = false; };
  }, []));

  const open = (url: string) => void Linking.openURL(url).catch(() => Alert.alert('Keçid açılmadı', 'İnternet bağlantısını yoxlayın və yenidən cəhd edin.'));
  const openDeviceSettings = async () => {
    try {
      await Linking.openSettings();
      setNotice('Bildiriş və tətbiq icazələrini Android Parametrlərində dəyişə bilərsiniz. Android seçimi cihazda saxlayır.');
    } catch {
      Alert.alert('Parametrlər açılmadı', 'Telefonun Parametrlər bölməsindən A-USTA tətbiqinə daxil olub icazələri yoxlayın.');
    }
  };
  const manageLocationPermission = async () => {
    try {
      if (locationPermission === 'undetermined') {
        const result = await Location.requestForegroundPermissionsAsync();
        setLocationPermission(result.status);
        setNotice(result.granted ? 'Məkan icazəsi yalnız yaxın məntəqələri göstərmək üçün aktivdir.' : 'Məkan icazəsi verilmədi. Yaxın məntəqələr üçün Android Parametrlərində dəyişə bilərsiniz.');
        return;
      }
      await Linking.openSettings();
      setNotice('Məkan icazəsini Android Parametrlərində dəyişin. Dəyişiklik bu ekrana qayıdanda yenilənəcək.');
    } catch {
      Alert.alert('İcazə parametrləri açılmadı', 'Məkan icazəsini Android Parametrlərində A-USTA tətbiqindən dəyişin.');
    }
  };
  const chooseTheme = async (mode: ThemeMode) => {
    setNotice('');
    try {
      await setThemeMode(mode);
      setNotice('Görünüş seçimi saxlanıldı və tətbiqin bütün mobil ekranlarına tətbiq edildi.');
    } catch (error) {
      Alert.alert('Seçim saxlanmadı', error instanceof Error ? error.message : 'Yenidən cəhd edin.');
    }
  };

  return <ScrollView style={s.screen} contentContainerStyle={s.content}>
    <View style={[s.header, { paddingTop: Math.max(insets.top, 0) }]}>
      <Pressable accessibilityRole="button" accessibilityLabel="Hesaba qayıt" onPress={() => router.replace('/(drawer)/(tabs)/account')} style={s.back}>
        <Feather name="arrow-left" size={21} color={INK}/>
      </Pressable>
      <Text style={s.headerTitle}>Parametrlər</Text>
      <View style={{ width: 32 }}/>
    </View>

    <View style={s.panel}>
      <Text style={s.section}>Görünüş</Text>
      <Text style={s.detail}>Seçim cihazda saxlanır və bütün tətbiq ekranlarına tətbiq edilir.</Text>
      {themeOptions.map(option => {
        const selected = themeMode === option.value;
        return <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: selected }} onPress={() => void chooseTheme(option.value)} style={[s.choice, selected && s.choiceSelected]}>
          <View style={[s.choiceIcon, selected && s.choiceIconSelected]}><Feather name={option.icon} size={18} color={selected ? RED : MUTED}/></View>
          <View style={{ flex: 1 }}><Text style={s.title}>{option.title}</Text><Text style={s.detail}>{option.detail}</Text></View>
          <Feather name={selected ? 'check-circle' : 'circle'} size={20} color={selected ? RED : MUTED}/>
        </Pressable>;
      })}
      {notice ? <Text accessibilityRole="status" style={s.notice}>{notice}</Text> : null}
    </View>

    <View style={s.panel}>
      <Text style={s.section}>Dil və valyuta</Text>
      <View style={s.staticRow}><Feather name="globe" size={19} color={RED}/><View style={{ flex: 1 }}><Text style={s.title}>Azərbaycan dili</Text><Text style={s.detail}>Hazırda tam dəstəklənən yeganə interfeys dilidir.</Text></View><Feather name="check" size={18} color={RED}/></View>
      <View style={s.staticRow}><Feather name="dollar-sign" size={19} color={RED}/><View style={{ flex: 1 }}><Text style={s.title}>AZN</Text><Text style={s.detail}>Elan qiymətləri DB-dəki ilkin valyutada saxlanır. USD/EUR üçün təsdiqlənmiş canlı məzənnə xidməti yoxdur.</Text></View></View>
    </View>

    <View style={s.panel}>
      <Text style={s.section}>Bildiriş və məxfilik</Text>
      <Pressable accessibilityRole="button" onPress={() => void openDeviceSettings()} style={s.staticRow}>
        <Feather name="bell" size={19} color={RED}/><View style={{ flex: 1 }}><Text style={s.title}>Bildiriş və tətbiq icazələri</Text><Text style={s.detail}>Android sistem ayarları açılır və seçimlər cihazda idarə olunur.</Text></View><Feather name="external-link" size={17} color={MUTED}/>
      </Pressable>
      <Pressable accessibilityRole="button" onPress={() => void manageLocationPermission()} style={s.staticRow}>
        <Feather name="map-pin" size={19} color={RED}/><View style={{ flex: 1 }}><Text style={s.title}>Məkan icazəsi</Text><Text style={s.detail}>{locationPermission === 'granted' ? 'Verilib · yalnız yaxın məntəqə axtarışında istifadə olunur' : locationPermission === 'denied' ? 'Verilməyib · Android Parametrlərində dəyişə bilərsiniz' : locationPermission === 'undetermined' ? 'Yaxın məntəqələr üçün lazım olduqda istənəcək' : 'İcazə vəziyyəti yoxlanılır'}</Text></View><Feather name="chevron-right" size={18} color={MUTED}/>
      </Pressable>
      <View style={s.privacyNote}><Feather name="shield" size={18} color={RED}/><Text style={[s.detail, { flex: 1 }]}>Tətbiq push bildirişləri göndərən backend-ə malik deyil. Məkan icazəsi yalnız yaxın məntəqə axtarışı zamanı istifadə olunur; ictimai biznes avatarı ayrıca razılıqla idarə edilir.</Text></View>
      <Pressable accessibilityRole="button" onPress={() => open('https://a-usta.az')} style={s.staticRow}>
        <Feather name="file-text" size={19} color={RED}/><View style={{ flex: 1 }}><Text style={s.title}>Məxfilik məlumatı</Text><Text style={s.detail}>A-USTA məxfilik məlumatlarını açın.</Text></View><Feather name="chevron-right" size={18} color={MUTED}/>
      </Pressable>
    </View>

    <View style={s.panel}>
      <Text style={s.section}>Tətbiq haqqında</Text>
      <View style={s.staticRow}><Feather name="info" size={19} color={RED}/><View style={{ flex: 1 }}><Text style={s.title}>A-USTA</Text><Text style={s.detail}>Versiya {version}{build ? ` · Build ${build}` : ''}</Text></View></View>
      <Pressable accessibilityRole="button" onPress={() => router.replace('/(drawer)/(tabs)/account')} style={s.staticRow}>
        <Feather name="user" size={19} color={RED}/><View style={{ flex: 1 }}><Text style={s.title}>Hesabın əsas səhifəsinə qayıt</Text></View><Feather name="chevron-right" size={18} color={MUTED}/>
      </Pressable>
    </View>
  </ScrollView>;
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG }, content: { paddingBottom: 24, gap: 12 },
  header: { minHeight: 56, backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: LINE, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  back: { width: 36, height: 40, justifyContent: 'center' }, headerTitle: { color: INK, fontSize: 18, fontWeight: '800' },
  panel: { marginHorizontal: 12, marginTop: 12, paddingHorizontal: 14, backgroundColor: '#fff', borderWidth: 1, borderColor: LINE, borderRadius: 14 },
  section: { paddingTop: 15, paddingBottom: 5, color: INK, fontSize: 16, fontWeight: '800' },
  choice: { minHeight: 68, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: 1, borderBottomColor: LINE, paddingVertical: 8 },
  choiceSelected: { backgroundColor: '#FFF8F7' }, choiceIcon: { width: 38, height: 38, borderRadius: 12, backgroundColor: '#F4F6F8', alignItems: 'center', justifyContent: 'center' }, choiceIconSelected: { backgroundColor: '#FFF0EE' },
  staticRow: { minHeight: 60, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: 1, borderBottomColor: LINE, paddingVertical: 10 },
  title: { color: INK, fontSize: 13, fontWeight: '700' }, detail: { color: MUTED, fontSize: 11, lineHeight: 16, flexShrink: 1 },
  notice: { paddingVertical: 10, color: RED, fontSize: 12, lineHeight: 17 }, privacyNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 9, paddingVertical: 12 },
});
