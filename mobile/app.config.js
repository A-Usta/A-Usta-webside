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
