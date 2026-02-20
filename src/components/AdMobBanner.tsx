import { useEffect } from 'react';
import { admobService } from '../lib/admobService';
import { BannerAdPosition } from '@capacitor-community/admob';

interface AdMobBannerProps {
  position?: BannerAdPosition;
  show?: boolean;
}

export function AdMobBanner({ position = BannerAdPosition.BOTTOM_CENTER, show = true }: AdMobBannerProps) {
  useEffect(() => {
    if (!admobService.isNativePlatform()) {
      return;
    }

    if (show) {
      admobService.showBanner(position);
    } else {
      admobService.hideBanner();
    }

    return () => {
      admobService.removeBanner();
    };
  }, [show, position]);

  if (!admobService.isNativePlatform()) {
    return (
      <div className="bg-gray-200 p-4 text-center text-sm text-gray-600">
        Ad Banner (Preview - Shows on mobile)
      </div>
    );
  }

  return null;
}
