import { useEffect, useState } from 'react';
import { isWebTarget } from '../lib/buildTarget';
import { webAdService } from '../lib/webAdService';
import { WebAdBanner } from './WebAdBanner';

interface WebAdSidebarProps {
  side: 'left' | 'right';
}

function checkHasAds(): boolean {
  const sidebarSlot = webAdService.getSlot('sidebar');
  const infeedSlot = webAdService.getSlot('in_feed');
  return !!(sidebarSlot?.is_active || infeedSlot?.is_active);
}

export function WebAdSidebar({ side }: WebAdSidebarProps) {
  const [hasAds, setHasAds] = useState(false);

  useEffect(() => {
    if (!isWebTarget()) return;

    setHasAds(checkHasAds());

    const unsubscribe = webAdService.onReload(() => {
      setHasAds(checkHasAds());
    });

    return unsubscribe;
  }, []);

  if (!isWebTarget() || !hasAds) return null;

  return (
    <aside
      className={`hidden xl:flex flex-col gap-6 w-[160px] 2xl:w-[200px] flex-shrink-0 ${
        side === 'left' ? 'mr-4' : 'ml-4'
      }`}
      aria-label="Advertisements"
    >
      <div className="sticky top-6 flex flex-col gap-6">
        <WebAdBanner
          placement="sidebar"
          style={{ width: '160px', minHeight: '600px' }}
          className="overflow-hidden rounded-lg"
        />
        <WebAdBanner
          placement="in_feed"
          style={{ width: '160px', minHeight: '250px' }}
          className="overflow-hidden rounded-lg"
        />
      </div>
    </aside>
  );
}
