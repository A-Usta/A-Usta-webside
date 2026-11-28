import { Redirect } from 'expo-router';

/** A bare `austa:///` deep link must resolve to the app's actual home route. */
export default function RootIndexRoute() {
  return <Redirect href="/(drawer)/(tabs)" />;
}
