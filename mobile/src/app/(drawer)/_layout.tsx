import { Stack } from 'expo-router';

export default function DrawerLayout() {
  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#F4F6F8' } }}>
    <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
  </Stack>;
}
