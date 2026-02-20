import { useEffect, useRef, useState } from 'react';
import { isWebTarget } from '../lib/buildTarget';
import { webAdService, WebAdSlot, WebAdPlacement } from '../lib/webAdService';

interface WebAdBannerProps {
  placement: WebAdPlacement;
  className?: string;
  style?: React.CSSProperties;
}

declare global {
  interface Window {
    adsbygoogle: unknown[];
  }
}

const ADSENSE_FORMAT_MAP: Record<string, { format: string; fullWidthResponsive: string; layout?: string }> = {
  banner_top:         { format: 'auto', fullWidthResponsive: 'true' },
  banner_bottom:      { format: 'auto', fullWidthResponsive: 'true' },
  sidebar:            { format: 'auto', fullWidthResponsive: 'false' },
  in_feed:            { format: 'fluid', fullWidthResponsive: 'false', layout: 'in-article' },
  in_article:         { format: 'fluid', fullWidthResponsive: 'true', layout: 'in-article' },
  anchor:             { format: 'auto', fullWidthResponsive: 'true' },
  responsive_display: { format: 'auto', fullWidthResponsive: 'true' },
  multiplex:          { format: 'autorelaxed', fullWidthResponsive: 'true' },
};

export function WebAdBanner({ placement, className = '', style }: WebAdBannerProps) {
  const adRef = useRef<HTMLModElement>(null);
  const [slot, setSlot] = useState<WebAdSlot | null>(null);
  const pushed = useRef(false);

  useEffect(() => {
    if (!isWebTarget()) return;

    const refresh = () => {
      pushed.current = false;
      setSlot(webAdService.getSlot(placement));
    };

    refresh();

    const unsubscribe = webAdService.onReload(refresh);
    return unsubscribe;
  }, [placement]);

  useEffect(() => {
    if (!slot || !adRef.current || pushed.current) return;
    if (slot.network !== 'adsense') return;
    if (!slot.publisher_id || !slot.slot_id) return;

    pushed.current = true;
    webAdService.pushAdSense();
  }, [slot]);

  if (!isWebTarget() || !slot || !slot.is_active) return null;

  if (slot.network === 'adsense') {
    if (!slot.publisher_id || !slot.slot_id) return null;

    const fmtConfig = ADSENSE_FORMAT_MAP[placement] ?? { format: 'auto', fullWidthResponsive: 'true' };

    return (
      <div className={`web-ad-container ${className}`} style={style} aria-label="Advertisement">
        <ins
          ref={adRef}
          className="adsbygoogle"
          style={{ display: 'block', ...style }}
          data-ad-client={slot.publisher_id}
          data-ad-slot={slot.slot_id}
          data-ad-format={fmtConfig.format}
          data-full-width-responsive={fmtConfig.fullWidthResponsive}
          {...(fmtConfig.layout ? { 'data-ad-layout': fmtConfig.layout } : {})}
        />
      </div>
    );
  }

  if (slot.network === 'monetag_web') {
    if (!slot.slot_id) return null;

    return (
      <div
        className={`web-ad-container ${className}`}
        style={style}
        aria-label="Advertisement"
        id={`monetag-web-${placement}-${slot.slot_id}`}
      />
    );
  }

  return null;
}
