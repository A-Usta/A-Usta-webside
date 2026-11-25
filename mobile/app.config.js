const TEST_SUPABASE_URL = 'https://xnhxneziasqthkhhntkv.supabase.co';
const TEST_SERVICE_API_URL = 'https://austa-v40-m7-test-api.onrender.com';

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
    parsedServiceApiUrl.origin !== TEST_SERVICE_API_URL ||
    parsedServiceApiUrl.username ||
    parsedServiceApiUrl.password ||
    parsedServiceApiUrl.search ||
    parsedServiceApiUrl.hash ||
    parsedServiceApiUrl.pathname !== '/'
  ) {
    throw new Error('TEST build must use the verified TEST Render API origin over HTTPS.');
  }
}

module.exports = ({ config }) => {
  const mapsKey = process.env.EXPO_PUBLIC_APP_ENV === 'test'
    ? process.env.GOOGLE_MAPS_ANDROID_API_KEY
    : undefined;
  const extra = { ...(config.extra || {}), googleMapsAndroidConfigured: Boolean(mapsKey) };
  return {
    ...config,
    extra,
    plugins: [
      ...(config.plugins || []),
      'expo-image',
      [
        'expo-location',
        {
          locationWhenInUsePermission:
            'Yaxın xidmət məntəqələrini göstərmək və xidmət sifarişinizə yer əlavə etmək üçün lokasiya icazəsi tələb olunur.',
        },
      ],
      ...(mapsKey
        ? [['react-native-maps', { androidGoogleMapsApiKey: mapsKey }]]
        : ['react-native-maps']),
      './plugins/with-workmanager-r8',
    ],
  };
};
