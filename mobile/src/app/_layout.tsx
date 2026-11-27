import 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Pressable, Text, View } from '../lib/themed-native';
import { AppSettingsProvider, useAppTheme } from '../lib/app-settings';

export function ErrorBoundary({ retry }: { error: Error; retry: () => void }) {
  return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#F4F6F8' }}>
    <Text accessibilityRole="header" style={{ color: '#202A35', fontSize: 18, fontWeight: '800', textAlign: 'center' }}>A-USTA açıla bilmədi</Text>
    <Text style={{ color: '#66717D', fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 8 }}>Bağlantını yoxlayın və tətbiqi yenidən başladın.</Text>
    <Pressable accessibilityRole="button" onPress={retry} style={{ minHeight: 48, paddingHorizontal: 20, borderRadius: 10, backgroundColor: '#176244', justifyContent: 'center', marginTop: 18 }}>
      <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>Yenidən cəhd et</Text>
    </Pressable>
  </View>;
}

function AppNavigation() {
  const { colorScheme } = useAppTheme();
  const dark = colorScheme === 'dark';
  return <>
    <StatusBar style={dark ? 'light' : 'dark'} />
    <Stack screenOptions={{
      headerBackTitle: 'Geri',
      headerTintColor: '#D92D20',
      headerStyle: { backgroundColor: dark ? '#151D26' : '#FFFFFF' },
      headerTitleStyle: { color: dark ? '#EDF2F6' : '#202A35' },
      contentStyle: { backgroundColor: dark ? '#0C1218' : '#F4F6F8' },
    }}>
      <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
      <Stack.Screen name="service/[key]" options={{ title: 'Xidmət' }} />
      <Stack.Screen name="locations" options={{ title: 'Yaxın məntəqələr' }} />
      <Stack.Screen name="category/[key]" options={{ title: 'Kateqoriya' }} />
      <Stack.Screen name="listing/[id]" options={{ title: 'Elan məlumatı' }} />
      <Stack.Screen name="seller/[id]" options={{ title: 'Satıcı profili' }} />
      <Stack.Screen name="tools/customs" options={{ title: 'Gömrük kalkulyatoru' }} />
      <Stack.Screen name="tools/catalog" options={{ title: 'Avtokataloq' }} />
      <Stack.Screen name="tools/dealers" options={{ title: 'Dilerlər' }} />
      <Stack.Screen name="tools/most-viewed" options={{ title: 'Ən çox baxılanlar' }} />
      <Stack.Screen name="settings" options={{ headerShown: false }} />
      <Stack.Screen name="videos" options={{ headerShown: false }} />
    </Stack>
  </>;
}

export default function RootLayout() {
  return <SafeAreaProvider>
    <AppSettingsProvider><AppNavigation /></AppSettingsProvider>
  </SafeAreaProvider>;
}
