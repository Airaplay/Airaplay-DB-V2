import { Capacitor } from '@capacitor/core';
import {
  AdMob,
  BannerAdSize,
  BannerAdPosition,
  BannerAdPluginEvents,
  AdMobRewardItem,
  RewardAdPluginEvents,
  InterstitialAdPluginEvents
} from '@capacitor-community/admob';
import { supabase } from './supabase';
import { logAdReward, logAdImpression, logAdRevenue } from './adLoggingService';
import { getActivePlacement } from './adPlacementService';
import { getUserLocation } from './locationDetection';

const isNative = Capacitor.isNativePlatform();

export interface AdMobConfig {
  appId?: string; // AdMob App ID from database
  bannerAdId?: string; // Fallback/test ad ID
  interstitialAdId?: string; // Fallback/test ad ID
  rewardedAdId?: string; // Fallback/test ad ID
  testMode?: boolean;
}

class AdMobService {
  private config: AdMobConfig | null = null;
  private isInitialized = false;
  private bannerVisible = false; // Only call native hide/remove when we actually showed a banner (avoids native crash)
  private pendingBannerRequest: {
    position: BannerAdPosition;
    contentId?: string;
    contentType?: string;
    placementKey?: string;
    adUnitId?: string;
    margin?: number;
  } | null = null;
  private userCountryCache: { country: string | null; timestamp: number } | null = null;
  private readonly COUNTRY_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  /** Only one fullscreen ad (interstitial or rewarded) at a time; cooldown to avoid clash/crash */
  private fullscreenAdLock = false;
  private lastFullscreenAdTime = 0;
  // Global cooldown so fullscreen ads can never stack on top of each other.
  private static readonly FULLSCREEN_AD_COOLDOWN_MS = 2 * 60 * 1000; // 2 minutes
  private pendingFullscreenAd: { contentId?: string; contentType?: string; interstitialPlacementKey?: string; rewardedPlacementKey?: string } | null = null;

  /**
   * Initialize AdMob from database configuration
   * Loads AdMob App ID from ad_networks table
   */
  async initialize(config?: AdMobConfig) {
    if (!isNative) {
      console.log('AdMob: Skipping initialization (not native platform)');
      return;
    }

    try {
      // Load AdMob configuration from database
      const { data: adNetwork, error } = await supabase
        .from('ad_networks')
        .select('app_id, is_active')
        .eq('network', 'admob')
        .eq('is_active', true)
        .single();

      if (error || !adNetwork) {
        console.warn('AdMob network not found in database, using fallback config:', error);
        const hasConfig = config && (config.appId || config.bannerAdId || config.interstitialAdId || config.rewardedAdId);
        if (hasConfig) {
          this.config = { ...config };
        } else {
          console.error('Cannot initialize AdMob: No configuration found');
          return;
        }
      } else {
        this.config = {
          appId: adNetwork.app_id,
          ...config
        };
      }

      const appId = this.config.appId || this.config.bannerAdId?.split('/')[0]?.split('~')[0] || 'ca-app-pub-473942199229846~4630726757';

      await AdMob.initialize({
        testingDevices: config?.testMode ? ['YOUR_TEST_DEVICE_ID'] : undefined,
        initializeForTesting: config?.testMode || false,
      });

      this.setupBannerListeners();
      this.isInitialized = true;
      console.log('AdMob initialized successfully with App ID:', appId);

      // If the app tried to show a fullscreen ad before init completed, run it once now.
      const pendingFull = this.pendingFullscreenAd;
      this.pendingFullscreenAd = null;
      if (pendingFull) {
        this.showInterstitialOrRewarded(pendingFull).catch(() => {});
      }

      // If the app tried to show a banner before init completed, retry once now.
      const pending = this.pendingBannerRequest;
      this.pendingBannerRequest = null;
      if (pending) {
        this.showBanner(
          pending.position,
          pending.contentId,
          pending.contentType ?? 'general',
          pending.placementKey,
          pending.adUnitId,
          pending.margin
        ).catch(() => {});
      }
    } catch (error) {
      console.error('Failed to initialize AdMob:', error);
      this.isInitialized = false;
    }
  }

  private bannerListenerHandle: { remove: () => Promise<void> } | null = null;

  private setupBannerListeners(): void {
    if (!isNative || this.bannerListenerHandle) return;
    AdMob.addListener(
      BannerAdPluginEvents.FailedToLoad,
      (error: unknown) => {
        try {
          this.bannerVisible = false; // Native reported failure; keep state in sync
          const err = error as { code?: number; message?: string } | null | undefined;
          console.warn('AdMob: Banner failed to load', { code: err?.code, message: err?.message ?? 'unknown' });
        } catch (e) {
          console.warn('AdMob: Banner failed to load (callback error)', e);
        }
      }
    ).then((handle) => {
      this.bannerListenerHandle = handle;
    }).catch((err) => {
      console.warn('AdMob: Could not add banner FailedToLoad listener', err);
    });
  }

  /**
   * Get user's country with caching to prevent repeated lookups
   * Uses timeout to prevent blocking ad display
   */
  private async getUserCountryWithCache(userId?: string): Promise<string | null> {
    // Check cache first
    const now = Date.now();
    if (this.userCountryCache && (now - this.userCountryCache.timestamp) < this.COUNTRY_CACHE_DURATION) {
      return this.userCountryCache.country;
    }

    let userCountry: string | null = null;

    // Try to get country from user profile first (fastest)
    if (userId) {
      try {
        const { data: userProfile } = await supabase
          .from('users')
          .select('country')
          .eq('id', userId)
          .single();

        userCountry = userProfile?.country || null;
      } catch (error) {
        console.warn('Could not fetch user country from profile:', error);
      }
    }

    // If no country in profile, try location detection with timeout
    if (!userCountry) {
      try {
        const locationPromise = getUserLocation();
        const timeoutPromise = new Promise<null>((resolve) =>
          setTimeout(() => resolve(null), 2000)
        );

        const result = await Promise.race([locationPromise, timeoutPromise]);

        if (result && result.location) {
          userCountry = result.location.countryCode;
        }
      } catch (error) {
        console.warn('Location detection timed out or failed:', error);
      }
    }

    // Cache the result (even if null)
    this.userCountryCache = {
      country: userCountry,
      timestamp: now
    };

    return userCountry;
  }

  /**
   * Check if ads should be displayed based on admin-configured display rules
   * Checks user role, content type, and country restrictions
   * Returns true if ads should show, false if blocked
   */
  private async checkDisplayRules(contentType?: string): Promise<boolean> {
    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser();

      // Get user's country with caching and timeout
      const userCountry = await this.getUserCountryWithCache(user?.id);

      // Call database function to check if ads should be shown
      const { data, error } = await supabase.rpc('should_show_ads', {
        user_uuid: user?.id || null,
        content_type_param: contentType || null,
        country_param: userCountry
      });

      if (error) {
        console.error('Error checking ad display rules:', error);
        // Default to showing ads on error to avoid revenue loss
        return true;
      }

      if (data === false) {
        console.log('Ad blocked by display rules', {
          userId: user?.id,
          contentType,
          country: userCountry,
          reason: 'Matched blocking rule'
        });
      }

      return data === true;
    } catch (error) {
      console.error('Failed to check ad display rules:', error);
      // Default to showing ads on error to avoid revenue loss
      return true;
    }
  }

  /** Show banner. Pass contentId (song id) and contentType 'song' so revenue is attributed to that song. margin in dp: for BOTTOM_CENTER = margin from bottom (e.g. 64 = just above nav+mini). */
  async showBanner(position: BannerAdPosition = BannerAdPosition.BOTTOM_CENTER, contentId?: string, contentType: string = 'general', placementKey?: string, adUnitId?: string, margin?: number) {
    if (!isNative) return;
    if (!this.isInitialized) {
      // Queue the most recent banner request and retry after initialize() completes.
      this.pendingBannerRequest = { position, contentId, contentType, placementKey, adUnitId, margin };
      console.log('AdMob: Banner queued (not initialized yet)');
      return;
    }

    // Skip display rules check for general banners (Home/Explore/Create/Library/Profile)
    // to avoid 2+ second delay from country lookup and RPC calls.
    // Only check rules for content-specific banners (song/video/album).
    if (contentType !== 'general') {
      const shouldShowAd = await this.checkDisplayRules(contentType);
      if (!shouldShowAd) {
        console.log('AdMob: Banner blocked by display rules');
        return;
      }
    }

    try {
      let adUnitIdToUse: string | undefined = adUnitId;
      let placementKeyToUse: string | undefined = placementKey;

      // If placementKey is provided, fetch the placement configuration
      if (placementKey) {
        const placement = await getActivePlacement(placementKey);
        if (placement && placement.ad_unit && placement.ad_type === 'banner') {
          adUnitIdToUse = placement.ad_unit.unit_id;
          if (!adUnitId) {
            adUnitId = placement.ad_unit.id;
          }
          placementKeyToUse = placement.placement_key;
        } else {
          console.warn(`Placement '${placementKey}' not found or not a banner ad`);
          // Fallback to config if available
          if (!this.config?.bannerAdId) {
            console.error('No banner ad unit available');
            return;
          }
          adUnitIdToUse = this.config.bannerAdId;
        }
      } else if (this.config?.bannerAdId) {
        // Fallback to config banner ID
        adUnitIdToUse = this.config.bannerAdId;
      } else {
        console.error('No banner ad unit ID available');
        return;
      }

      // Never call native AdMob.showBanner with empty/invalid ID — plugin can NPE (AdView.setAdUnitId on null)
      const validAdId = typeof adUnitIdToUse === 'string' && adUnitIdToUse.trim().length > 0 ? adUnitIdToUse.trim() : null;
      if (!validAdId) {
        console.warn('AdMob: Skipping banner — no valid ad unit ID (prevents native NPE)');
        return;
      }

      await AdMob.showBanner({
        adId: validAdId,
        adSize: BannerAdSize.ADAPTIVE_BANNER,
        position,
        ...(margin !== undefined && margin >= 0 && { margin }),
      });
      this.bannerVisible = true;

      // Record impression in background; never let this throw so it cannot contribute to crashes
      this.recordImpression('banner', contentId, contentType, 0, true, placementKeyToUse, validAdId).catch((err) => {
        console.warn('Failed to record banner impression:', err);
      });
    } catch (error) {
      this.bannerVisible = false;
      console.error('Failed to show banner:', error);
    }
  }

  /**
   * Record every ad impression with content context. Revenue is attributed per song:
   * always pass contentId (song id) and contentType ('song') when the ad is shown during playback.
   */
  private async recordImpression(adType: string, contentId?: string, contentType: string = 'general', duration: number = 0, completed: boolean = false, placementKey?: string, adUnitId?: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return; // Skip if not authenticated

      // Record impression in ad_impressions table (content_uuid = song id for revenue attribution)
      const { data: impressionData, error: impressionError } = await supabase.rpc('record_ad_impression', {
        content_uuid: contentId || null,
        content_type_param: contentType,
        ad_type_param: adType,
        duration_viewed_param: duration,
        completed_param: completed
      });

      if (impressionError) {
        console.error('Failed to record ad impression:', impressionError);
        return;
      }

      // Enhanced logging
      await logAdImpression({
        adImpressionId: impressionData?.id || undefined,
        userId: user.id,
        adUnitId: adUnitId,
        placementKey: placementKey,
        network: 'admob',
        adType: adType,
        viewDuration: duration,
        completed: completed,
        failed: !completed && duration === 0
      });

      // Estimate revenue (simplified - in production, get actual CPM from ad network)
      const estimatedCPM = adType === 'rewarded' ? 3.0 : adType === 'interstitial' ? 2.0 : 1.0;
      const estimatedRevenue = (estimatedCPM / 1000) * (completed ? 1 : 0.5); // Partial credit if not completed

      await logAdRevenue({
        adImpressionId: impressionData?.id || undefined,
        adUnitId: adUnitId,
        networkId: undefined, // Will be populated from ad_units
        placementKey: placementKey,
        estimatedCPM: estimatedCPM,
        estimatedRevenue: estimatedRevenue,
        currency: 'USD',
        winningNetwork: 'admob'
      });
    } catch (error) {
      console.error('Failed to record ad impression:', error);
      // Don't throw - ad impression tracking failure shouldn't break ad display
    }
  }

  async hideBanner() {
    if (!isNative || !this.isInitialized) return;
    if (!this.bannerVisible) return;

    try {
      await AdMob.hideBanner();
      // Treat hidden as not-visible so future showBanner calls can re-show without needing removeBanner()
      this.bannerVisible = false;
    } catch (error) {
      console.error('Failed to hide banner:', error);
      // Keep state conservative so we can recover with a future showBanner
      this.bannerVisible = false;
    }
  }

  async removeBanner() {
    if (!isNative || !this.isInitialized) return;
    if (!this.bannerVisible) return;

    try {
      await AdMob.removeBanner();
      this.bannerVisible = false;
    } catch (error) {
      console.error('Failed to remove banner:', error);
      this.bannerVisible = false;
    }
  }

  async prepareInterstitial(placementKey?: string) {
    if (!isNative || !this.isInitialized) return;

    try {
      let adUnitIdToUse: string | undefined;

      // If placementKey is provided, fetch the placement configuration
      if (placementKey) {
        const placement = await getActivePlacement(placementKey);
        if (placement && placement.ad_unit && placement.ad_type === 'interstitial') {
          adUnitIdToUse = placement.ad_unit.unit_id;
        } else {
          console.warn(`Placement '${placementKey}' not found or not an interstitial ad`);
          // Fallback to config if available
          if (!this.config?.interstitialAdId) {
            console.error('No interstitial ad unit available');
            return;
          }
          adUnitIdToUse = this.config.interstitialAdId;
        }
      } else if (this.config?.interstitialAdId) {
        // Fallback to config interstitial ID
        adUnitIdToUse = this.config.interstitialAdId;
      } else {
        console.error('No interstitial ad unit ID available');
        return;
      }

      await AdMob.prepareInterstitial({
        adId: adUnitIdToUse,
      });
    } catch (error) {
      console.error('Failed to prepare interstitial:', error);
    }
  }

  async showInterstitial(
    contentId?: string,
    contentType: string = 'general',
    placementKey?: string,
    adUnitId?: string,
    options?: { muteAppAudio?: boolean }
  ): Promise<void> {
    if (!isNative || !this.isInitialized) {
      console.log('AdMob: Interstitial skipped (not native or not initialized)');
      return;
    }

    // Check display rules before showing ad
    const shouldShowAd = await this.checkDisplayRules(contentType);
    if (!shouldShowAd) {
      console.log('AdMob: Interstitial blocked by display rules');
      return;
    }

    try {
      let adUnitIdToUse: string | undefined = adUnitId;
      let placementKeyToUse: string | undefined = placementKey;

      // If placementKey is provided, fetch the placement configuration
      if (placementKey) {
        const placement = await getActivePlacement(placementKey);
        if (placement && placement.ad_unit && placement.ad_type === 'interstitial') {
          adUnitIdToUse = placement.ad_unit.unit_id;
          if (!adUnitId) {
            adUnitId = placement.ad_unit.id;
          }
          placementKeyToUse = placement.placement_key;
        } else {
          console.warn(`Placement '${placementKey}' not found or not an interstitial ad`);
          // Fallback to config if available
          if (!this.config?.interstitialAdId) {
            console.error('No interstitial ad unit available');
            return;
          }
          adUnitIdToUse = this.config.interstitialAdId;
        }
      } else if (this.config?.interstitialAdId) {
        // Fallback to config interstitial ID
        adUnitIdToUse = this.config.interstitialAdId;
      } else {
        console.error('No interstitial ad unit ID available');
        return;
      }

      // Prepare the ad first
      await this.prepareInterstitial(placementKeyToUse);

      const shouldMute = options?.muteAppAudio ?? true;

      // Optionally mute app audio while interstitial is visible (default: true).
      const restoreUnmute = () => {
        if (shouldMute && typeof AdMob.setApplicationMuted === 'function') {
          AdMob.setApplicationMuted({ muted: false }).catch(() => {});
        }
      };
      if (shouldMute && typeof AdMob.setApplicationMuted === 'function') {
        await AdMob.setApplicationMuted({ muted: true });
      }
      let resolveDismissed!: () => void;
      const dismissedPromise = new Promise<void>((r) => { resolveDismissed = r; });
      const dismissListener = await AdMob.addListener(InterstitialAdPluginEvents.Dismissed, () => {
        restoreUnmute();
        dismissListener.remove();
        resolveDismissed();
      });

      await AdMob.showInterstitial();

      // Record ad impression (interstitial ads are typically completed when shown)
      await this.recordImpression('interstitial', contentId, contentType, 0, true, placementKeyToUse, adUnitIdToUse || adUnitId);

      await dismissedPromise;
    } catch (error) {
      console.error('Failed to show interstitial:', error);
      if (shouldMute && typeof AdMob.setApplicationMuted === 'function') {
        AdMob.setApplicationMuted({ muted: false }).catch(() => {});
      }
      throw error;
    }
  }

  async prepareRewardedAd(placementKey?: string) {
    if (!isNative || !this.isInitialized) return;

    try {
      let adUnitIdToUse: string | undefined;

      // If placementKey is provided, fetch the placement configuration
      if (placementKey) {
        const placement = await getActivePlacement(placementKey);
        if (placement && placement.ad_unit && placement.ad_type === 'rewarded') {
          adUnitIdToUse = placement.ad_unit.unit_id;
        } else {
          console.warn(`Placement '${placementKey}' not found or not a rewarded ad`);
          // Fallback to config if available
          if (!this.config?.rewardedAdId) {
            console.error('No rewarded ad unit available');
            return;
          }
          adUnitIdToUse = this.config.rewardedAdId;
        }
      } else if (this.config?.rewardedAdId) {
        // Fallback to config rewarded ID
        adUnitIdToUse = this.config.rewardedAdId;
      } else {
        console.error('No rewarded ad unit ID available');
        return;
      }

      await AdMob.prepareRewardVideoAd({
        adId: adUnitIdToUse,
      });
    } catch (error) {
      console.error('Failed to prepare rewarded ad:', error);
    }
  }

  async showRewardedAd(contentId?: string, contentType: string = 'general', placementKey?: string, adUnitId?: string): Promise<AdMobRewardItem | null> {
    if (!isNative || !this.isInitialized) {
      console.log('AdMob: Rewarded ad skipped (not native or not initialized)');
      return null;
    }

    // Check display rules before showing ad
    const shouldShowAd = await this.checkDisplayRules(contentType);
    if (!shouldShowAd) {
      console.log('AdMob: Rewarded ad blocked by display rules');
      return null;
    }

    try {
      let adUnitIdToUse: string | undefined = adUnitId;
      let placementKeyToUse: string | undefined = placementKey;

      // If placementKey is provided, fetch the placement configuration
      if (placementKey) {
        const placement = await getActivePlacement(placementKey);
        if (placement && placement.ad_unit && placement.ad_type === 'rewarded') {
          adUnitIdToUse = placement.ad_unit.unit_id;
          if (!adUnitId) {
            adUnitId = placement.ad_unit.id;
          }
          placementKeyToUse = placement.placement_key;
        } else {
          console.warn(`Placement '${placementKey}' not found or not a rewarded ad`);
          // Fallback to config if available
          if (!this.config?.rewardedAdId) {
            console.error('No rewarded ad unit available');
            return null;
          }
          adUnitIdToUse = this.config.rewardedAdId;
        }
      } else if (this.config?.rewardedAdId) {
        // Fallback to config rewarded ID
        adUnitIdToUse = this.config.rewardedAdId;
      } else {
        console.error('No rewarded ad unit ID available');
        return null;
      }

      // Prepare the ad first
      await this.prepareRewardedAd(placementKeyToUse);
    } catch (error) {
      console.error('Failed to prepare rewarded ad:', error);
      return null;
    }

    return new Promise(async (resolve, reject) => {
      let rewardItem: AdMobRewardItem | null = null;
      let adStartTime = Date.now();
      let finalAdUnitId = adUnitId;
      let finalPlacementKey = placementKey;

      const rewardListener = await AdMob.addListener(
        RewardAdPluginEvents.Rewarded,
        async (reward: AdMobRewardItem) => {
          rewardItem = reward;
          const duration = Math.floor((Date.now() - adStartTime) / 1000);
          
          // Record completed rewarded ad impression
          await this.recordImpression('rewarded', contentId, contentType, duration, true, finalPlacementKey, finalAdUnitId);
          
          // Log reward completion
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await logAdReward({
              userId: user.id,
              adUnitId: finalAdUnitId,
              placementKey: finalPlacementKey,
              rewardType: 'treats',
              rewardAmount: reward.amount,
              completed: true,
              completionDuration: duration,
              metadata: { rewardType: reward.type }
            });
          }
        }
      );

      const dismissListener = await AdMob.addListener(
        RewardAdPluginEvents.Dismissed,
        async () => {
          // If ad was dismissed without reward, still record impression
          if (!rewardItem) {
            const duration = Math.floor((Date.now() - adStartTime) / 1000);
            await this.recordImpression('rewarded', contentId, contentType, duration, false, finalPlacementKey, finalAdUnitId);
            
            // Log skipped reward
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              await logAdReward({
                userId: user.id,
                adUnitId: finalAdUnitId,
                placementKey: finalPlacementKey,
                rewardType: 'treats',
                skipped: true,
                skipReason: 'Ad dismissed without completion',
                completionDuration: duration,
                metadata: { reason: 'user_dismissed' }
              });
            }
          }
          
          rewardListener.remove();
          dismissListener.remove();
          resolve(rewardItem);
        }
      );

      AdMob.showRewardVideoAd().catch((error) => {
        rewardListener.remove();
        dismissListener.remove();
        reject(error);
      });
    });
  }

  /**
   * Show either an interstitial or a rewarded ad at random, with a single lock and cooldown
   * so they never run at once and cannot clash or crash the app.
   */
  async showInterstitialOrRewarded(options: {
    contentId?: string;
    contentType?: string;
    interstitialPlacementKey?: string;
    rewardedPlacementKey?: string;
  } = {}): Promise<void> {
    if (!isNative) return;
    if (!this.isInitialized) {
      this.pendingFullscreenAd = { ...options };
      return;
    }

    const now = Date.now();
    if (this.fullscreenAdLock || (now - this.lastFullscreenAdTime) < AdMobService.FULLSCREEN_AD_COOLDOWN_MS) {
      return;
    }

    const contentType = options.contentType ?? 'general';
    const shouldShow = await this.checkDisplayRules(contentType);
    if (!shouldShow) return;

    const useInterstitial = Math.random() < 0.5;
    const interstitialKey = options.interstitialPlacementKey ?? 'after_song_play_interstitial';
    const rewardedKey = options.rewardedPlacementKey ?? 'after_video_play_rewarded';

    this.fullscreenAdLock = true;
    try {
      if (useInterstitial) {
        try {
          await this.showInterstitial(options.contentId, contentType, interstitialKey);
        } catch (e) {
          await this.showRewardedAd(options.contentId, contentType, rewardedKey).catch(() => {});
        }
      } else {
        try {
          await this.showRewardedAd(options.contentId, contentType, rewardedKey);
        } catch (e) {
          await this.showInterstitial(options.contentId, contentType, interstitialKey).catch(() => {});
        }
      }
    } catch (e) {
      console.warn('AdMob: showInterstitialOrRewarded failed', e);
    } finally {
      this.fullscreenAdLock = false;
      this.lastFullscreenAdTime = Date.now();
    }
  }

  isNativePlatform() {
    return isNative;
  }

  getInitializationStatus() {
    return this.isInitialized;
  }
}

export const admobService = new AdMobService();
