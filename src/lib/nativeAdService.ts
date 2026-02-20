import { supabase } from './supabase';
import { logAdImpression, logAdRevenue } from './adLoggingService';

export interface NativeAdCard {
  id: string;
  title: string;
  description: string | null;
  image_url: string;
  click_url: string;
  advertiser_name: string;
  placement_type: string;
  priority: number;
  is_active: boolean;
  impression_count: number;
  click_count: number;
  target_countries: string[] | null;
  target_genres: string[] | null;
  created_at: string;
  expires_at: string | null;
}

export interface GridItem {
  id: string;
  isAd: boolean;
  adData?: NativeAdCard;
  songData?: any;
}

/**
 * Fetch active native ads for a specific placement
 */
export async function getNativeAdsForPlacement(
  placementType: string,
  userCountry?: string | null,
  genreId?: string | null,
  limit: number = 10
): Promise<NativeAdCard[]> {
  try {
    let query = supabase
      .from('native_ad_cards')
      .select('*')
      .eq('placement_type', placementType)
      .eq('is_active', true)
      .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
      .order('priority', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching native ads:', error);
      return [];
    }

    if (!data || data.length === 0) {
      return [];
    }

    // Filter ads by targeting rules
    const filteredAds = data.filter((ad: NativeAdCard) => {
      // Check country targeting
      if (ad.target_countries && ad.target_countries.length > 0 && userCountry) {
        if (!ad.target_countries.includes(userCountry)) {
          return false;
        }
      }

      // Check genre targeting
      if (ad.target_genres && ad.target_genres.length > 0 && genreId) {
        if (!ad.target_genres.includes(genreId)) {
          return false;
        }
      }

      return true;
    });

    return filteredAds;
  } catch (error) {
    console.error('Error in getNativeAdsForPlacement:', error);
    return [];
  }
}

/**
 * Record an impression for a native ad (increments counter + logs revenue)
 */
export async function recordNativeAdImpression(adId: string): Promise<void> {
  try {
    const { error } = await supabase.rpc('increment_native_ad_impression', {
      ad_id: adId
    });

    if (error) {
      console.error('Error recording native ad impression:', error);
    }

    const { data: { user } } = await supabase.auth.getUser();
    const estimatedCPM = 0.5;
    const estimatedRevenue = estimatedCPM / 1000;

    await logAdImpression({
      userId: user?.id,
      adUnitId: adId,
      placementKey: 'native_grid',
      network: 'native',
      adType: 'native',
      completed: true,
    });

    await logAdRevenue({
      adUnitId: adId,
      placementKey: 'native_grid',
      estimatedCPM,
      estimatedRevenue,
      winningNetwork: 'native',
    });
  } catch (error) {
    console.error('Error in recordNativeAdImpression:', error);
  }
}

/**
 * Record a click for a native ad
 */
export async function recordNativeAdClick(adId: string): Promise<void> {
  try {
    const { error } = await supabase.rpc('increment_native_ad_click', {
      ad_id: adId
    });

    if (error) {
      console.error('Error recording native ad click:', error);
    }
  } catch (error) {
    console.error('Error in recordNativeAdClick:', error);
  }
}

/**
 * Inject native ads into a content grid
 * @param items - Array of content items (songs, videos, etc.)
 * @param ads - Array of native ad cards
 * @param frequency - Insert an ad every N items (default: 6)
 * @param maxAds - Maximum number of ads to inject (default: unlimited)
 * @returns Array of items with ads injected at regular intervals
 */
export function injectAdsIntoGrid<T extends { id: string }>(
  items: T[],
  ads: NativeAdCard[],
  frequency: number = 6,
  maxAds?: number
): GridItem[] {
  if (!ads || ads.length === 0 || items.length === 0) {
    // No ads available or no items, return items as-is
    return items.map(item => ({
      id: item.id,
      isAd: false,
      songData: item
    }));
  }

  const result: GridItem[] = [];
  let adIndex = 0;
  let adsInjected = 0;

  for (let i = 0; i < items.length; i++) {
    // Add the content item
    result.push({
      id: items[i].id,
      isAd: false,
      songData: items[i]
    });

    // Check if we should inject an ad after this item
    const shouldInjectAd = (i + 1) % frequency === 0 &&
                          adIndex < ads.length &&
                          i < items.length - 1; // Don't inject ad after last item

    // Check maxAds limit
    const hasReachedMaxAds = maxAds !== undefined && adsInjected >= maxAds;

    if (shouldInjectAd && !hasReachedMaxAds) {
      const ad = ads[adIndex % ads.length]; // Cycle through ads if needed
      result.push({
        id: `ad-${ad.id}-${i}`,
        isAd: true,
        adData: ad
      });
      adIndex++;
      adsInjected++;
    }
  }

  return result;
}

/**
 * Get ad injection frequency based on admin configuration
 * Default is every 6 items if no config exists
 */
export async function getAdFrequencyConfig(): Promise<number> {
  try {
    // This could be extended to fetch from a configuration table
    // For now, return default value
    return 6;
  } catch (error) {
    console.error('Error fetching ad frequency config:', error);
    return 6; // Default fallback
  }
}
