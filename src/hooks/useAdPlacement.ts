import { useEffect, useState } from 'react';
import { admobService } from '../lib/admobService';
import { getActivePlacement, getActivePlacementsForScreen, checkPlacementConditions, AdPlacement } from '../lib/adPlacementService';
import { BannerAdPosition } from '@capacitor-community/admob';

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
   * Show a banner ad by placement key or screen
   */
  const showBanner = async (
    placementKey?: string,
    position: BannerAdPosition = BannerAdPosition.BOTTOM_CENTER,
    context?: Record<string, any>
  ) => {
    try {
      let placement: AdPlacement | null = null;

      if (placementKey) {
        // Use specific placement key
        placement = await getActivePlacement(placementKey);
      } else if (screenName && placements.length > 0) {
        // Use first banner placement for screen
        placement = placements.find(p => p.ad_type === 'banner' && checkPlacementConditions(p, context || {})) || null;
      }

      if (!placement || placement.ad_type !== 'banner') {
        console.warn('No banner placement found');
        return;
      }

      await admobService.showBanner(
        position,
        context?.contentId,
        context?.contentType || 'general',
        placement.placement_key,
        placement.ad_unit_id || undefined
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
    context?: Record<string, any>
  ) => {
    try {
      let placement: AdPlacement | null = null;

      if (placementKey) {
        // Use specific placement key
        placement = await getActivePlacement(placementKey);
      } else if (screenName && placements.length > 0) {
        // Use first interstitial placement for screen
        placement = placements.find(p => p.ad_type === 'interstitial' && checkPlacementConditions(p, context || {})) || null;
      }

      if (!placement || placement.ad_type !== 'interstitial') {
        console.warn('No interstitial placement found');
        return;
      }

      await admobService.showInterstitial(
        context?.contentId,
        context?.contentType || 'general',
        placement.placement_key,
        placement.ad_unit_id || undefined
      );
    } catch (error) {
      console.error('Failed to show interstitial:', error);
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
      let placement: AdPlacement | null = null;

      if (placementKey) {
        // Use specific placement key
        placement = await getActivePlacement(placementKey);
      } else if (screenName && placements.length > 0) {
        // Use first rewarded placement for screen
        placement = placements.find(p => p.ad_type === 'rewarded' && checkPlacementConditions(p, context || {})) || null;
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
    } catch (error) {
      console.error('Failed to show rewarded ad:', error);
    }
  };

  /**
   * Hide banner ad
   */
  const hideBanner = () => {
    admobService.hideBanner();
  };

  /**
   * Remove banner ad
   */
  const removeBanner = () => {
    admobService.removeBanner();
  };

  return {
    placements,
    isLoading,
    showBanner,
    showInterstitial,
    showRewarded,
    hideBanner,
    removeBanner,
  };
}


