/**
 * Preloaded banner resolution (`admobService.preloadNextBannerRefresh`) must stay fresh through
 * the jittered refresh window so `refreshBannerAd` can apply it. Slightly longer than the max
 * refresh interval avoids throwing away valid preload work.
 */
export const BANNER_PRELOAD_PARAMS_MAX_AGE_MS = 60_000;
