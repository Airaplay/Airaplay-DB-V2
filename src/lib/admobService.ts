import { Capacitor } from '@capacitor/core';
import {
  AdMob,
  BannerAdSize,
  BannerAdPosition,
  AdMobRewardItem,
  RewardAdPluginEvents
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
  private userCountryCache: { country: string | null; timestamp: number } | null = null;
  private readonly COUNTRY_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

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
        // Use fallback config if provided
        if (config?.appId) {
          this.config = config;
        } else {
          console.error('Cannot initialize AdMob: No configuration found');
          return;
        }
      } else {
        // Use App ID from database
        this.config = {
          appId: adNetwork.app_id,
          ...config
        };
      }

      // Initialize AdMob with App ID
      const appId = this.config.appId || this.config.bannerAdId?.split('/')[0]?.split('~')[0] || 'ca-app-pub-4739421992298461~4630726757';
      
      await AdMob.initialize({
        // requestTrackingAuthorization: true, // Removed - not supported in type definition
        testingDevices: config?.testMode ? ['YOUR_TEST_DEVICE_ID'] : undefined,
        initializeForTesting: config?.testMode || false,
      });

      this.isInitialized = true;
      console.log('AdMob initialized successfully with App ID:', appId);
    } catch (error) {
      console.error('Failed to initialize AdMob:', error);
      this.isInitialized = false;
    }
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

  async showBanner(position: BannerAdPosition = BannerAdPosition.BOTTOM_CENTER, contentId?: string, contentType: string = 'general', placementKey?: string, adUnitId?: string) {
    if (!isNative || !this.isInitialized) {
      console.log('AdMob: Banner skipped (not native or not initialized)');
      return;
    }

    // Check display rules before showing ad
    const shouldShowAd = await this.checkDisplayRules(contentType);
    if (!shouldShowAd) {
      console.log('AdMob: Banner blocked by display rules');
      return;
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

      await AdMob.showBanner({
        adId: adUnitIdToUse,
        adSize: BannerAdSize.ADAPTIVE_BANNER,
        position,
      });

      // Record ad impression with placement key
      await this.recordImpression('banner', contentId, contentType, 0, true, placementKeyToUse, adUnitId);
    } catch (error) {
      console.error('Failed to show banner:', error);
    }
  }

  private async recordImpression(adType: string, contentId?: string, contentType: string = 'general', duration: number = 0, completed: boolean = false, placementKey?: string, adUnitId?: string) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return; // Skip if not authenticated

      // Record impression in ad_impressions table
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

    try {
      await AdMob.hideBanner();
    } catch (error) {
      console.error('Failed to hide banner:', error);
    }
  }

  async removeBanner() {
    if (!isNative || !this.isInitialized) return;

    try {
      await AdMob.removeBanner();
    } catch (error) {
      console.error('Failed to remove banner:', error);
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

  async showInterstitial(contentId?: string, contentType: string = 'general', placementKey?: string, adUnitId?: string): Promise<void> {
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
      
      await AdMob.showInterstitial();
      
      // Record ad impression (interstitial ads are typically completed when shown)
      await this.recordImpression('interstitial', contentId, contentType, 0, true, placementKeyToUse, adUnitIdToUse || adUnitId);
    } catch (error) {
      console.error('Failed to show interstitial:', error);
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

  isNativePlatform() {
    return isNative;
  }

  getInitializationStatus() {
    return this.isInitialized;
  }
}

export const admobService = new AdMobService();
