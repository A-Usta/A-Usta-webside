import 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  return <SafeAreaProvider>
    <StatusBar style="dark" />
    <Stack screenOptions={{ headerBackTitle: 'Geri', headerTintColor: '#176244', contentStyle: { backgroundColor: '#F4F6F8' } }}>
      <Stack.Screen name="(drawer)" options={{ headerShown: false }} />
      <Stack.Screen name="service/[key]" options={{ title: 'Xidmət' }} />
      <Stack.Screen name="locations" options={{ title: 'Yaxın məntəqələr' }} />
      <Stack.Screen name="category/[key]" options={{ title: 'Kateqoriya' }} />
      <Stack.Screen name="listing/[id]" options={{ title: 'Elan məlumatı' }} />
    </Stack>
  </SafeAreaProvider>;
}
