import { Drawer } from 'expo-router/drawer';
import { ServiceDrawer } from '../../../App';

export default function DrawerLayout() {
  return <Drawer
    drawerContent={props => <ServiceDrawer navigation={props.navigation} />}
    screenOptions={{
      headerShown: false,
      drawerType: 'front',
      swipeEnabled: true,
      drawerStyle: { width: 310 },
      overlayColor: 'rgba(18, 26, 34, 0.36)',
      sceneStyle: { backgroundColor: '#F4F6F8' },
    }}
  >
    <Drawer.Screen name="(tabs)" options={{ title: 'A-USTA' }} />
  </Drawer>;
}
