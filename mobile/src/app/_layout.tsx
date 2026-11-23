import 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Pressable, Text, View } from 'react-native';

export function ErrorBoundary({ retry }: { error: Error; retry: () => void }) {
  return <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, backgroundColor: '#F4F6F8' }}>
    <Text accessibilityRole="header" style={{ color: '#202A35', fontSize: 18, fontWeight: '800', textAlign: 'center' }}>A-USTA açıla bilmədi</Text>
    <Text style={{ color: '#66717D', fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 8 }}>Bağlantını yoxlayın və tətbiqi yenidən başladın.</Text>
    <Pressable accessibilityRole="button" onPress={retry} style={{ minHeight: 48, paddingHorizontal: 20, borderRadius: 10, backgroundColor: '#176244', justifyContent: 'center', marginTop: 18 }}>
      <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '700' }}>Yenidən cəhd et</Text>
    </Pressable>
  </View>;
}

export default function RootLayout() {
  return <SafeAreaProvider>
    <StatusBar style="dark" />
    <Stack screenOptions={{ headerBackTitle: 'Geri', headerTintColor: '#176244', contentStyle: { backgroundColor: '#F4F6F8' } }}>
      <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
      <Stack.Screen name="service/[key]" options={{ title: 'Xidmət' }} />
      <Stack.Screen name="locations" options={{ title: 'Yaxın məntəqələr' }} />
      <Stack.Screen name="category/[key]" options={{ title: 'Kateqoriya' }} />
      <Stack.Screen name="listing/[id]" options={{ title: 'Elan məlumatı' }} />
      <Stack.Screen name="tools/customs" options={{ title: 'Gömrük kalkulyatoru' }} />
      <Stack.Screen name="tools/catalog" options={{ title: 'Avtokataloq' }} />
      <Stack.Screen name="tools/dealers" options={{ title: 'Dilerlər' }} />
      <Stack.Screen name="tools/most-viewed" options={{ title: 'Ən çox baxılanlar' }} />
    </Stack>
  </SafeAreaProvider>;
}
