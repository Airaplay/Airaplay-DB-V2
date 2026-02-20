import { supabase } from './supabase';
import { isWebTarget } from './buildTarget';
import { logAdImpression, logAdRevenue } from './adLoggingService';

export type WebAdPlacement =
  | 'sidebar'
  | 'banner_top'
  | 'banner_bottom'
  | 'interstitial_web'
  | 'in_feed'
  | 'in_article'
  | 'anchor'
  | 'responsive_display'
  | 'multiplex'
  | 'push_notification'
  | 'native_banner'
  | 'onclick_popunder'
  | 'in_page_push'
  | 'vignette';

export interface WebAdSlot {
  id: string;
  network: 'adsense' | 'monetag_web';
  slot_id: string;
  publisher_id: string;
  placement: WebAdPlacement;
  is_active: boolean;
}

type ReloadListener = () => void;

class WebAdService {
  private slots: WebAdSlot[] = [];
  private initialized = false;
  private adsenseScriptLoaded = false;
  private monetagScriptsLoaded = new Set<string>();
  private reloadListeners: ReloadListener[] = [];

  async initialize(): Promise<void> {
    if (!isWebTarget()) return;

    try {
      const { data, error } = await supabase
        .from('web_ad_config')
        .select('*')
        .eq('is_active', true);

      if (error) {
        console.warn('WebAdService: Failed to load config', error);
        return;
      }

      this.slots = (data as WebAdSlot[]) || [];
      await this.loadAdSenseScript();
      await this.loadMonetagScripts();
      this.initialized = true;
    } catch (err) {
      console.warn('WebAdService: Initialization error', err);
    }
  }

  async reload(): Promise<void> {
    if (!isWebTarget()) return;

    try {
      const { data, error } = await supabase
        .from('web_ad_config')
        .select('*')
        .eq('is_active', true);

      if (error) {
        console.warn('WebAdService: Failed to reload config', error);
        return;
      }

      this.slots = (data as WebAdSlot[]) || [];
      await this.loadAdSenseScript();
      await this.loadMonetagScripts();
      this.initialized = true;

      this.reloadListeners.forEach(fn => fn());
    } catch (err) {
      console.warn('WebAdService: Reload error', err);
    }
  }

  onReload(fn: ReloadListener): () => void {
    this.reloadListeners.push(fn);
    return () => {
      this.reloadListeners = this.reloadListeners.filter(l => l !== fn);
    };
  }

  private async loadAdSenseScript(): Promise<void> {
    if (this.adsenseScriptLoaded) return;

    const adsenseSlots = this.slots.filter(s => s.network === 'adsense' && s.publisher_id);
    if (!adsenseSlots.length) return;

    const publisherId = adsenseSlots[0].publisher_id;
    const scriptId = 'adsense-init';

    if (document.getElementById(scriptId)) {
      this.adsenseScriptLoaded = true;
      return;
    }

    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.id = scriptId;
      script.async = true;
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisherId}`;
      script.crossOrigin = 'anonymous';
      script.onload = () => {
        this.adsenseScriptLoaded = true;
        resolve();
      };
      script.onerror = () => {
        console.warn('WebAdService: AdSense script failed to load (may be blocked by ad blocker)');
        resolve();
      };
      document.head.appendChild(script);
    });
  }

  private async loadMonetagScripts(): Promise<void> {
    const monetagSlots = this.slots.filter(s => s.network === 'monetag_web' && s.slot_id);
    if (!monetagSlots.length) return;

    const uniqueZones = [...new Set(monetagSlots.map(s => s.slot_id))];
    await Promise.all(uniqueZones.map(zoneId => this.loadMonetagZone(zoneId)));
  }

  private loadMonetagZone(zoneId: string): Promise<void> {
    if (this.monetagScriptsLoaded.has(zoneId)) return Promise.resolve();

    const scriptId = `monetag-web-${zoneId}`;
    if (document.getElementById(scriptId)) {
      this.monetagScriptsLoaded.add(zoneId);
      return Promise.resolve();
    }

    return new Promise((resolve) => {
      const script = document.createElement('script');
      script.id = scriptId;
      script.async = true;
      script.setAttribute('data-zone', zoneId);
      script.src = 'https://monetag.com/show.js';
      script.onload = () => {
        this.monetagScriptsLoaded.add(zoneId);
        resolve();
      };
      script.onerror = () => {
        console.warn(`WebAdService: Monetag script failed to load for zone ${zoneId}`);
        resolve();
      };
      document.head.appendChild(script);
    });
  }

  getSlot(placement: WebAdPlacement): WebAdSlot | null {
    return this.slots.find(s => s.placement === placement && s.is_active) ?? null;
  }

  getAllSlots(): WebAdSlot[] {
    return this.slots;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  isAdSenseReady(): boolean {
    return this.adsenseScriptLoaded && this.slots.some(s => s.network === 'adsense' && s.is_active);
  }

  isMonetagWebReady(): boolean {
    return this.monetagScriptsLoaded.size > 0 && this.slots.some(s => s.network === 'monetag_web' && s.is_active);
  }

  pushAdSense(): void {
    try {
      ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
    } catch (err) {
      console.warn('WebAdService: AdSense push failed', err);
    }
  }

  async showMonetagInterstitial(): Promise<void> {
    const slot = this.getSlot('interstitial_web');
    if (!slot || slot.network !== 'monetag_web' || !slot.slot_id) return;
    const fn = (window as any)[`show_${slot.slot_id}`];
    if (typeof fn === 'function') {
      let completed = false;
      try {
        await fn();
        completed = true;
      } catch (err) {
        console.warn('WebAdService: Monetag interstitial failed', err);
      }
      await this.recordWebImpression(slot, 'interstitial', completed);
    }
  }

  async showMonetagVignette(): Promise<void> {
    const slot = this.getSlot('vignette');
    if (!slot || slot.network !== 'monetag_web' || !slot.slot_id) return;
    const fn = (window as any)[`show_${slot.slot_id}`];
    if (typeof fn === 'function') {
      let completed = false;
      try {
        await fn();
        completed = true;
      } catch (err) {
        console.warn('WebAdService: Monetag vignette failed', err);
      }
      await this.recordWebImpression(slot, 'vignette', completed);
    }
  }

  private async recordWebImpression(slot: WebAdSlot, adType: string, completed: boolean): Promise<void> {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const estimatedCPM = adType === 'interstitial' ? 2.0 : adType === 'vignette' ? 2.5 : 1.0;
      const estimatedRevenue = (estimatedCPM / 1000) * (completed ? 1 : 0.5);

      await logAdImpression({
        userId: user?.id,
        placementKey: slot.placement,
        network: slot.network,
        adType,
        completed,
        failed: !completed,
      });

      await logAdRevenue({
        placementKey: slot.placement,
        estimatedCPM,
        estimatedRevenue,
        winningNetwork: slot.network,
      });
    } catch (err) {
      console.warn('WebAdService: Failed to record web impression revenue', err);
    }
  }
}

export const webAdService = new WebAdService();
