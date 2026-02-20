import { memo, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { HeroSection } from "./sections/HeroSection";
import { TrendingSection } from "./sections/TrendingSection";
import { useTabPersistence } from "../../hooks/useTabPersistence";

// Lazy load non-critical sections for faster initial render
const TrendingNearYouSection = lazy(() => import("./sections/TrendingNearYouSection").then(m => ({ default: m.TrendingNearYouSection })));
const NewReleasesSection = lazy(() => import("./sections/NewReleasesSection").then(m => ({ default: m.NewReleasesSection })));
const MustWatchSection = lazy(() => import("./sections/MustWatchSection").then(m => ({ default: m.MustWatchSection })));
const AIRecommendedSection = lazy(() => import("./sections/AIRecommendedSection").then(m => ({ default: m.AIRecommendedSection })));
const TrendingAlbumsSection = lazy(() => import("./sections/TrendingAlbumsSection").then(m => ({ default: m.TrendingAlbumsSection })));
const TopArtisteSection = lazy(() => import("./sections/TopArtisteSection").then(m => ({ default: m.TopArtisteSection })));
const InspiredByYouSection = lazy(() => import("./sections/InspiredByYouSection").then(m => ({ default: m.InspiredByYouSection })));
const MixForYouSection = lazy(() => import("./sections/MixForYouSection").then(m => ({ default: m.MixForYouSection })));
const ListenerCurationsSection = lazy(() => import("./sections/ListenerCurationsSection").then(m => ({ default: m.ListenerCurationsSection })));
const TracksBlowingUpSection = lazy(() => import("./sections/TracksBlowingUpSection").then(m => ({ default: m.TracksBlowingUpSection })));
const DailyMixSection = lazy(() => import("./sections/DailyMixSection").then(m => ({ default: m.DailyMixSection })));

interface HomePlayerProps {
  onOpenMusicPlayer: (song: Song, playlist?: Song[], context?: string) => void;
  onFormVisibilityChange?: (isVisible: boolean) => void;
}

interface Song {
  id: string;
  title: string;
  artist: string;
  artistId?: string | null;
  coverImageUrl?: string | null;
  audioUrl?: string | null;
  videoUrl?: string | null;
  duration?: number;
  playCount?: number;
}

// Memoize critical sections
const MemoizedHeroSection = memo(HeroSection);
const MemoizedTrendingSection = memo(TrendingSection);

// Skeleton loader for lazy sections
const SectionSkeleton = () => (
  <div className="px-5 py-6 animate-pulse">
    <div className="h-6 w-32 bg-white/10 rounded-lg mb-4"></div>
    <div className="flex gap-3 overflow-hidden">
      {[...Array(3)].map((_, i) => (
        <div key={i} className="w-40 h-40 bg-white/10 rounded-2xl flex-shrink-0"></div>
      ))}
    </div>
  </div>
);

const HomePlayerContent = memo(({ onOpenMusicPlayer }: HomePlayerProps): JSX.Element => {
  const navigate = useNavigate();
  const { containerRef } = useTabPersistence('home-player');
  const { isInitialized } = useAuth();

  // Show skeleton while auth initializes
  if (!isInitialized) {
    return (
      <div className="flex flex-col min-h-screen min-h-[100dvh] content-with-nav overflow-y-auto relative z-0 bg-gradient-to-b from-[#0a0a0a] via-[#0d0d0d] to-[#000000]">
        <div className="px-5 py-6 animate-pulse">
          <div className="h-8 w-48 bg-white/10 rounded-lg mb-6"></div>
          <div className="h-48 bg-white/10 rounded-2xl mb-6"></div>
          <div className="h-6 w-32 bg-white/10 rounded-lg mb-4"></div>
          <div className="flex gap-3 overflow-hidden">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="w-40 h-40 bg-white/10 rounded-2xl flex-shrink-0"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="flex flex-col min-h-screen min-h-[100dvh] content-with-nav overflow-y-auto relative z-0 animate-in fade-in duration-300 bg-gradient-to-b from-[#0a0a0a] via-[#0d0d0d] to-[#000000]">
      {/* Critical above-the-fold content - loads immediately */}
      <MemoizedHeroSection
        onShowNotificationsModal={() => navigate('/notifications')}
      />
      <MemoizedTrendingSection onOpenMusicPlayer={onOpenMusicPlayer} />

      {/* Daily Mix AI - Personalized playlists */}
      <Suspense fallback={<SectionSkeleton />}>
        <DailyMixSection />
      </Suspense>

      {/* Non-critical content - lazy loaded with suspense */}
      <Suspense fallback={<SectionSkeleton />}>
        <TrendingNearYouSection onOpenMusicPlayer={onOpenMusicPlayer} />
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        <MixForYouSection />
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        <ListenerCurationsSection />
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        <TracksBlowingUpSection onOpenMusicPlayer={onOpenMusicPlayer} />
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        <InspiredByYouSection onOpenMusicPlayer={onOpenMusicPlayer} />
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        <MustWatchSection />
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        <NewReleasesSection onOpenMusicPlayer={onOpenMusicPlayer} />
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        <TopArtisteSection />
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        <TrendingAlbumsSection />
      </Suspense>

      <Suspense fallback={<SectionSkeleton />}>
        <AIRecommendedSection onOpenMusicPlayer={onOpenMusicPlayer} />
      </Suspense>
    </div>
  );
});

HomePlayerContent.displayName = 'HomePlayerContent';

export const HomePlayer = memo(({ onOpenMusicPlayer }: HomePlayerProps): JSX.Element => {
  return <HomePlayerContent onOpenMusicPlayer={onOpenMusicPlayer} />;
});

HomePlayer.displayName = 'HomePlayer';