import { Tabs } from 'expo-router';
import { Feather } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const GREEN = '#176244';
const MUTED = '#87919E';

export default function TabLayout() {
  const insets = useSafeAreaInsets();
  return <Tabs screenOptions={{
    headerShown: false,
    tabBarActiveTintColor: GREEN,
    tabBarInactiveTintColor: MUTED,
    tabBarLabelStyle: { fontSize: 9, fontWeight: '600', marginBottom: 2, flexShrink: 1, textAlign: 'center' },
    tabBarStyle: { minHeight: 61 + insets.bottom, paddingTop: 5, paddingBottom: Math.max(insets.bottom, 5), borderTopColor: '#E8EBEF', backgroundColor: '#FFFFFF' },
  }}>
    <Tabs.Screen name="index" options={{ title: 'Əsas', tabBarIcon: ({ color, size }) => <Feather name="home" color={String(color)} size={size} /> }} />
    <Tabs.Screen name="favorites" options={{ title: 'Seçilmişlər', tabBarIcon: ({ color, size }) => <Feather name="heart" color={String(color)} size={size} /> }} />
    <Tabs.Screen name="create" options={{ title: 'Yeni elan', tabBarIcon: () => <View style={styles.createButton}><Feather name="plus" size={26} color="#FFFFFF" /></View>, tabBarLabel: 'Yeni elan' }} />
    <Tabs.Screen name="messages" options={{ title: 'Mesajlar', tabBarIcon: ({ color, size }) => <Feather name="message-circle" color={String(color)} size={size} /> }} />
    <Tabs.Screen name="account" options={{ title: 'Hesab', tabBarIcon: ({ color, size }) => <Feather name="user" color={String(color)} size={size} /> }} />
  </Tabs>;
}

const styles = StyleSheet.create({ createButton: { width: 48, height: 48, borderRadius: 24, marginTop: -21, backgroundColor: GREEN, borderColor: '#F4F6F8', borderWidth: 4, alignItems: 'center', justifyContent: 'center' } });
