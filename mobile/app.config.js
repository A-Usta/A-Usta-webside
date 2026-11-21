const TEST_SUPABASE_URL = 'https://xnhxneziasqthkhhntkv.supabase.co';
const PRODUCTION_SERVICE_API_URL = 'https://a-usta-webside.onrender.com';

if (process.env.EXPO_PUBLIC_APP_ENV === 'test') {
  if (process.env.EXPO_PUBLIC_SUPABASE_URL !== TEST_SUPABASE_URL) {
    throw new Error('TEST build only accepts the verified A-USTA-TEST Supabase URL.');
  }
  if (!process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error('TEST build requires the public Supabase anon key from the TEST project.');
  }
  const serviceApiUrl = process.env.EXPO_PUBLIC_SERVICE_API_URL;
  if (!serviceApiUrl) {
    throw new Error('TEST build requires EXPO_PUBLIC_SERVICE_API_URL for a separate TEST backend.');
  }
  const parsedServiceApiUrl = new URL(serviceApiUrl);
  if (
    parsedServiceApiUrl.protocol !== 'https:' ||
    parsedServiceApiUrl.origin === PRODUCTION_SERVICE_API_URL
  ) {
    throw new Error('TEST build must use HTTPS and must not use the production Render API.');
  }
}

module.exports = ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins || []),
    [
      'expo-location',
      {
        locationWhenInUsePermission:
          'Yaxın xidmət məntəqələrini göstərmək və xidmət sifarişinizə yer əlavə etmək üçün lokasiya icazəsi tələb olunur.',
      },
    ],
    [
      'react-native-maps',
      process.env.GOOGLE_MAPS_ANDROID_API_KEY
        ? { androidGoogleMapsApiKey: process.env.GOOGLE_MAPS_ANDROID_API_KEY }
        : {},
    ],
  ],
});
