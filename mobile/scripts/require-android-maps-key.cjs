if (process.env.EXPO_PUBLIC_APP_ENV === 'test' && !process.env.GOOGLE_MAPS_ANDROID_API_KEY?.trim()) {
  process.stderr.write('TEST Android build blocked: provide GOOGLE_MAPS_ANDROID_API_KEY (Android Maps SDK key).\n');
  process.exit(1);
}

process.stdout.write('Android Maps key preflight passed.\n');
