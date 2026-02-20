import { persistentCache } from './persistentCache';
import { backgroundPrefetcher } from './backgroundPrefetch';
import { fetchOptimizedHomeScreen } from './optimizedDataFetcher';

class AppInitializer {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      // Add timeout to prevent blocking
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Initialization timeout')), 5000)
      );

      await Promise.race([
        persistentCache.init(),
        timeoutPromise
      ]).catch(err => {
        console.warn('Cache initialization failed, continuing without cache:', err);
      });

      this.startBackgroundPrefetch();

      this.setupVisibilityHandlers();

      this.setupConnectionMonitoring();

      this.initialized = true;
    } catch (error) {
      console.error('Failed to initialize app:', error);
      // Don't throw - allow app to continue even if initialization fails
      this.initialized = true;
    }
  }

  private startBackgroundPrefetch(): void {
    // Disabled - let individual screens load their own data on demand
    // This prevents aggressive prefetching and reduces network load
  }

  private setupVisibilityHandlers(): void {
    // Disabled - prefetch only when user explicitly navigates
    // No automatic refreshing on visibility change
  }

  private setupConnectionMonitoring(): void {
    // Disabled - let components handle their own loading
    // No automatic prefetching on network changes
  }

  async clearAllCaches(): Promise<void> {
    await persistentCache.clear();
    backgroundPrefetcher.clearQueue();
  }
}

export const appInitializer = new AppInitializer();
