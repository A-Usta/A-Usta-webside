type RouterBack = {
  canGoBack: () => boolean;
  back: () => void;
  replace: (path: any) => void;
};

/** Expo Router's back() is unsafe for a cold/deep link with an empty stack. */
export function safeRouterBack(router: RouterBack, fallback = '/(drawer)/(tabs)'): 'back' | 'fallback' {
  if (router.canGoBack()) {
    router.back();
    return 'back';
  }
  router.replace(fallback);
  return 'fallback';
}
