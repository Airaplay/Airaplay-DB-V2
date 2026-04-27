import { supabase } from './supabase';

export interface NativeAdCard {
  id: string;
  title: string;
  description: string | null;
  image_url: string;
  audio_url?: string | null;
  companion_image_url?: string | null;
  companion_cta_text?: string | null;
  click_url: string;
  advertiser_name: string;
  placement_type: string;
  priority: number;
  is_active: boolean;
  impression_count: number;
  click_count: number;
  target_countries: string[] | null;
  target_genres: string[] | null;
  target_genders?: string[] | null;
  target_age_min?: number | null;
  target_age_max?: number | null;
  created_at: string;
  expires_at: string | null;
}

type NativeAdVariant = 'visual' | 'audio' | 'any';

const lastAudioAdPlaybackAtByPlacement = new Map<string, number>();

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
  targeting?: {
    userAge?: number | null;
    userGender?: string | null;
  },
  limit: number = 10,
  adVariant: NativeAdVariant = 'visual'
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
      // Filter by ad asset variant when requested.
      if (adVariant === 'audio') {
        if (!ad.audio_url || ad.audio_url.trim().length === 0) {
          return false;
        }
      } else if (adVariant === 'visual') {
        if (!ad.image_url || ad.image_url.trim().length === 0) {
          return false;
        }
      }

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

      const userAge = targeting?.userAge ?? null;
      const userGender = targeting?.userGender ?? null;

      // Check gender targeting
      if (ad.target_genders && ad.target_genders.length > 0 && userGender) {
        if (!ad.target_genders.includes(userGender)) {
          return false;
        }
      }

      // Check age targeting
      if (typeof userAge === 'number' && Number.isFinite(userAge)) {
        if (ad.target_age_min != null && userAge < ad.target_age_min) {
          return false;
        }
        if (ad.target_age_max != null && userAge > ad.target_age_max) {
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
 * Record an impression for a native ad
 */
export async function recordNativeAdImpression(adId: string): Promise<void> {
  try {
    const { error } = await supabase.rpc('increment_native_ad_impression', {
      ad_id: adId
    });

    if (error) {
      console.error('Error recording native ad impression:', error);
    }
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

function normalizeAudioUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const trimmed = url.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Plays a native audio ad for a player placement and resolves when it ends/fails.
 * Returns true when an audio ad was attempted and completed naturally.
 */
export async function playNativeAudioAdForPlacement(
  placementType: string,
  userCountry?: string | null,
  genreId?: string | null,
  targeting?: {
    userAge?: number | null;
    userGender?: string | null;
  },
  options?: {
    maxDurationMs?: number;
    minIntervalMs?: number;
  }
): Promise<boolean> {
  try {
    const now = Date.now();
    const minIntervalMs = options?.minIntervalMs ?? 45_000;
    const lastPlayedAt = lastAudioAdPlaybackAtByPlacement.get(placementType) ?? 0;
    if (now - lastPlayedAt < minIntervalMs) {
      return false;
    }

    const ads = await getNativeAdsForPlacement(placementType, userCountry, genreId, targeting, 5, 'audio');
    const ad = ads.find((item) => normalizeAudioUrl(item.audio_url) != null);
    if (!ad) {
      return false;
    }

    const audioUrl = normalizeAudioUrl(ad.audio_url);
    if (!audioUrl) return false;

    // Record impression right before playback attempt.
    void recordNativeAdImpression(ad.id);

    const adAudio = new Audio(audioUrl);
    adAudio.preload = 'auto';

    // Audio ad spec: 15–30s.
    const maxDurationMs = options?.maxDurationMs ?? 30_000;

    const completed = await new Promise<boolean>((resolve) => {
      let settled = false;

      const cleanup = () => {
        adAudio.removeEventListener('ended', onEnded);
        adAudio.removeEventListener('error', onError);
        window.clearTimeout(timeoutId);
      };

      const settle = (value: boolean) => {
        if (settled) return;
        settled = true;
        cleanup();
        // Hide companion display when audio finishes/fails.
        try {
          window.dispatchEvent(
            new CustomEvent('airaplay:audioAdCompanion', {
              detail: { action: 'hide', adId: ad.id },
            })
          );
        } catch {
          // Ignore event errors.
        }
        resolve(value);
      };

      const onEnded = () => {
        settle(true);
      };

      const onError = () => {
        settle(false);
      };

      const timeoutId = window.setTimeout(() => {
        try {
          adAudio.pause();
        } catch {
          // Ignore pause failures.
        }
        settle(false);
      }, maxDurationMs);

      adAudio.addEventListener('ended', onEnded, { once: true });
      adAudio.addEventListener('error', onError, { once: true });

      // Show companion display right before playback attempt.
      try {
        window.dispatchEvent(
          new CustomEvent('airaplay:audioAdCompanion', {
            detail: {
              action: 'show',
              ad: {
                id: ad.id,
                title: ad.title,
                imageUrl: ad.companion_image_url ?? ad.image_url,
                ctaText: ad.companion_cta_text ?? 'Learn More',
                clickUrl: ad.click_url,
                advertiserName: ad.advertiser_name,
              },
            },
          })
        );
      } catch {
        // Ignore event errors.
      }

      adAudio.play().catch(() => {
        settle(false);
      });
    });

    if (completed) {
      lastAudioAdPlaybackAtByPlacement.set(placementType, Date.now());
    }

    return completed;
  } catch (error) {
    console.error('Error playing native audio ad:', error);
    return false;
  }
}
