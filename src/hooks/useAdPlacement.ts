import { useEffect, useState } from 'react';
import { admobService } from '../lib/admobService';
import { getActivePlacement, getActivePlacementsForScreen, checkPlacementConditions, AdPlacement } from '../lib/adPlacementService';
import { BannerAdPosition } from '@capacitor-community/admob';

// Global fullscreen ad cooldown so fullscreen ads (rewarded or interstitial) never appear too frequently across screens
const FULLSCREEN_AD_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes
let lastFullscreenAdTime = 0;
let fullscreenAdLock = false;

/**
 * Hook to easily manage ad placements in screens
 * 
 * @example
 * // In a screen component
 * const { showBanner, showInterstitial, showRewarded } = useAdPlacement('MusicPlayerScreen');
 * 
 * useEffect(() => {
 *   // Show banner on mount
 *   showBanner();
 * }, []);
 */
export function useAdPlacement(screenName?: string) {
  const [placements, setPlacements] = useState<AdPlacement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!screenName) {
      setIsLoading(false);
      return;
    }

    const loadPlacements = async () => {
      try {
        const screenPlacements = await getActivePlacementsForScreen(screenName);
        setPlacements(screenPlacements);
      } catch (error) {
        console.error('Failed to load ad placements:', error);
      } finally {
        setIsLoading(false);
      }
    };

    loadPlacements();
  }, [screenName]);

  /**
   * Show a banner ad by placement key or screen.
   * Revenue is attributed per song: when the ad is shown during song playback, always pass
   * context: { contentId: song.id, contentType: 'song' } so each ad impression is tied to that song.
   * margin: optional, in dp; for BOTTOM_CENTER = offset from bottom (e.g. 64 = just above nav+mini).
   */
  const showBanner = async (
    placementKey?: string,
    position: BannerAdPosition = BannerAdPosition.BOTTOM_CENTER,
    context?: Record<string, any>,
    margin?: number
  ) => {
    try {
      let placement: AdPlacement | null = null;

      if (placementKey) {
        placement = await getActivePlacement(placementKey);
      } else if (screenName && placements.length > 0) {
        placement = placements.find(p => p.ad_type === 'banner' && checkPlacementConditions(p, context || {})) || null;
      }

      // When placement key is provided but DB has no placement, still try showBanner so admobService can use config.bannerAdId
      if (placementKey && (!placement || placement.ad_type !== 'banner')) {
        await admobService.showBanner(
          position,
          context?.contentId,
          context?.contentType || 'general',
          placementKey,
          undefined,
          margin
        );
        return;
      }

      if (!placement || placement.ad_type !== 'banner') {
        console.warn('No banner placement found for screen/conditions, falling back to default banner config');
        // Fall back to default config-based banner (no admin placement needed)
        await admobService.showBanner(
          position,
          context?.contentId,
          context?.contentType || 'general',
          undefined,
          undefined,
          margin
        );
        return;
      }

      await admobService.showBanner(
        position,
        context?.contentId,
        context?.contentType || 'general',
        placement.placement_key,
        placement.ad_unit_id || undefined,
        margin
      );
    } catch (error) {
      console.error('Failed to show banner:', error);
    }
  };

  /**
   * Show an interstitial ad by placement key or screen
   */
  const showInterstitial = async (
    placementKey?: string,
    context?: Record<string, any>,
    options?: { muteAppAudio?: boolean }
  ) => {
    try {
      const now = Date.now();
      if (fullscreenAdLock || (now - lastFullscreenAdTime) < FULLSCREEN_AD_COOLDOWN_MS) {
        console.log('Fullscreen ad skipped by cooldown (interstitial).');
        return;
      }
      fullscreenAdLock = true;

      let placement: AdPlacement | null = null;

      if (placementKey) {
        placement = await getActivePlacement(placementKey);
      } else if (screenName && placements.length > 0) {
        placement = placements.find(p => p.ad_type === 'interstitial' && checkPlacementConditions(p, context || {})) || null;
      }

      if (placementKey && (!placement || placement.ad_type !== 'interstitial')) {
        await admobService.showInterstitial(
          context?.contentId,
          context?.contentType || 'general',
          placementKey,
          undefined,
          options
        );
        lastFullscreenAdTime = Date.now();
        return;
      }

      if (!placement || placement.ad_type !== 'interstitial') {
        console.warn('No interstitial placement found');
        return;
      }

      await admobService.showInterstitial(
        context?.contentId,
        context?.contentType || 'general',
        placement.placement_key,
        placement.ad_unit_id || undefined,
        options
      );
      lastFullscreenAdTime = Date.now();
    } catch (error) {
      console.error('Failed to show interstitial:', error);
    } finally {
      fullscreenAdLock = false;
    }
  };

  /**
   * Show a rewarded ad by placement key or screen
   */
  const showRewarded = async (
    placementKey?: string,
    context?: Record<string, any>
  ): Promise<void> => {
    try {
      const now = Date.now();
      if (fullscreenAdLock || (now - lastFullscreenAdTime) < FULLSCREEN_AD_COOLDOWN_MS) {
        console.log('Fullscreen ad skipped by cooldown (rewarded).');
        return;
      }
      fullscreenAdLock = true;

      let placement: AdPlacement | null = null;

      if (placementKey) {
        placement = await getActivePlacement(placementKey);
      } else if (screenName && placements.length > 0) {
        placement = placements.find(p => p.ad_type === 'rewarded' && checkPlacementConditions(p, context || {})) || null;
      }

      if (placementKey && (!placement || placement.ad_type !== 'rewarded')) {
        await admobService.showRewardedAd(
          context?.contentId,
          context?.contentType || 'general',
          placementKey,
          undefined
        );
        lastFullscreenAdTime = Date.now();
        return;
      }

      if (!placement || placement.ad_type !== 'rewarded') {
        console.warn('No rewarded placement found');
        return;
      }

      await admobService.showRewardedAd(
        context?.contentId,
        context?.contentType || 'general',
        placement.placement_key,
        placement.ad_unit_id || undefined
      );
      lastFullscreenAdTime = Date.now();
    } catch (error) {
      console.error('Failed to show rewarded ad:', error);
    } finally {
      fullscreenAdLock = false;
    }
  };

  /**
   * Hide banner ad. Safe to call when no banner is shown; never throws.
   */
  const hideBanner = () => {
    admobService.hideBanner().catch(() => {});
  };

  /**
   * Remove banner ad. Safe to call when no banner is shown; never throws.
   */
  const removeBanner = () => {
    admobService.removeBanner().catch(() => {});
  };

  /** Show either an interstitial or a rewarded ad at random; single lock/cooldown so they never clash. Resolves when ad is dismissed. */
  const showInterstitialOrRewarded = (
    options?: { contentId?: string; contentType?: string; interstitialPlacementKey?: string; rewardedPlacementKey?: string }
  ): Promise<void> => {
    return admobService.showInterstitialOrRewarded(options ?? {}).catch(() => {});
  };

  return {
    placements,
    isLoading,
    showBanner,
    showInterstitial,
    showRewarded,
    showInterstitialOrRewarded,
    hideBanner,
    removeBanner,
  };
}


