import { MarketplaceCategoryScreen } from '../../components/MarketplaceScreens';
import { useLocalSearchParams } from 'expo-router';

export default function CategoryRoute() {
  const { key = 'cars' } = useLocalSearchParams<{ key?: string }>();
  return <MarketplaceCategoryScreen key={String(key)} />;
}
