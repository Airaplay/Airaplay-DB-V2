import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { recordNativeAdClick } from '../lib/nativeAdService';

type CompanionAd = {
  id: string;
  title?: string;
  advertiserName?: string;
  imageUrl?: string | null;
  clickUrl?: string | null;
  ctaText?: string | null;
};

type CompanionPayload =
  | {
      action: 'show';
      ad: CompanionAd;
    }
  | {
      action: 'hide';
      adId?: string;
    };

export function AudioAdCompanionOverlay(): JSX.Element | null {
  const [visible, setVisible] = useState(false);
  const [ad, setAd] = useState<CompanionAd | null>(null);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<CompanionPayload>).detail;
      if (!detail) return;

      if (detail.action === 'show') {
        setAd(detail.ad);
        setVisible(true);
        return;
      }
      if (detail.action === 'hide') {
        setVisible(false);
        return;
      }
    };

    window.addEventListener('airaplay:audioAdCompanion', handler as EventListener);
    return () => {
      window.removeEventListener('airaplay:audioAdCompanion', handler as EventListener);
    };
  }, []);

  const imageUrl = useMemo(() => {
    const url = (ad?.imageUrl ?? '').toString().trim();
    return url.length > 0 ? url : null;
  }, [ad?.imageUrl]);

  const ctaText = useMemo(() => {
    const raw = (ad?.ctaText ?? '').toString().trim();
    return raw.length > 0 ? raw : 'Learn More';
  }, [ad?.ctaText]);

  const clickUrl = useMemo(() => {
    const url = (ad?.clickUrl ?? '').toString().trim();
    return url.length > 0 ? url : null;
  }, [ad?.clickUrl]);

  if (!visible || !ad) return null;

  const handleClick = () => {
    if (!clickUrl) return;
    try {
      window.open(clickUrl, '_blank', 'noopener,noreferrer');
      void recordNativeAdClick(ad.id);
    } catch {
      // Ignore.
    }
  };

  return (
    <div className="fixed inset-0 z-[9998] flex items-center justify-center bg-black/70 backdrop-blur-sm px-4 py-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center justify-between mb-2">
          <div className="min-w-0">
            <p className="text-white/80 text-[11px] font-semibold uppercase tracking-wider truncate">
              Ad break
            </p>
            <p className="text-white text-sm font-semibold truncate">
              {ad.title || ad.advertiserName || 'Sponsored'}
            </p>
          </div>
          <button
            type="button"
            className="p-2 rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
            onClick={() => setVisible(false)}
            aria-label="Hide ad"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="rounded-2xl overflow-hidden bg-white/5 border border-white/10 shadow-2xl">
          <div className="w-full aspect-square bg-black/30 flex items-center justify-center">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={ad.title || 'Ad'}
                className="w-full h-full object-cover"
                draggable={false}
              />
            ) : (
              <div className="text-white/60 text-sm">Sponsored</div>
            )}
          </div>

          <div className="p-3">
            <button
              type="button"
              onClick={handleClick}
              disabled={!clickUrl}
              className={cn(
                'w-full inline-flex items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-all',
                clickUrl
                  ? 'bg-white text-black hover:opacity-90 active:scale-[0.99]'
                  : 'bg-white/20 text-white/60 cursor-not-allowed'
              )}
            >
              <ExternalLink className="w-4 h-4" />
              {ctaText}
            </button>
          </div>
        </div>

        <p className="mt-3 text-center text-white/60 text-[11px]">
          Audio ad is playing…
        </p>
      </div>
    </div>
  );
}

