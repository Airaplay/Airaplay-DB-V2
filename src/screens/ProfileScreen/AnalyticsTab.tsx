import { useState, useEffect } from 'react';
import { Music, TrendingUp, TrendingDown } from 'lucide-react';
import { getCreatorAnalyticsOptimized, CreatorAnalytics } from '../../lib/supabase';
import { Skeleton } from '../../components/ui/skeleton';

export const AnalyticsTab = () => {
  const [analytics, setAnalytics] = useState<CreatorAnalytics | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAnalytics();
  }, []);

  const loadAnalytics = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getCreatorAnalyticsOptimized();
      setAnalytics(data);
    } catch (err) {
      console.error('Error loading analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setIsLoading(false);
    }
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const getColorClasses = (type: string) => {
    switch (type) {
      case 'song':
        return { bg: 'bg-blue-600/30', text: 'text-blue-400' };
      case 'album':
        return { bg: 'bg-purple-600/30', text: 'text-purple-400' };
      case 'video':
        return { bg: 'bg-pink-600/30', text: 'text-pink-400' };
      case 'short_clip':
        return { bg: 'bg-green-600/30', text: 'text-green-400' };
      default:
        return { bg: 'bg-gray-600/30', text: 'text-gray-400' };
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl bg-gradient-to-br from-blue-600/20 to-purple-600/20 backdrop-blur-md border border-blue-500/30 p-6 shadow-xl">
          <Skeleton variant="text" height="28px" width="60%" className="bg-white/10 mb-4" />
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center">
                <Skeleton variant="text" height="14px" width="70%" className="bg-white/10 mb-2 mx-auto" />
                <Skeleton variant="text" height="32px" width="50%" className="bg-white/10 mx-auto" />
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-5">
          <Skeleton variant="text" height="24px" width="50%" className="bg-white/10 mb-4" />
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-white/10 backdrop-blur-sm rounded-xl">
                <div className="flex items-center gap-3 flex-1">
                  <Skeleton variant="rectangular" width={48} height={48} className="rounded-xl bg-white/10" />
                  <div className="flex-1">
                    <Skeleton variant="text" height="16px" width="60%" className="bg-white/10 mb-1" />
                    <Skeleton variant="text" height="14px" width="40%" className="bg-white/10" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-red-600/20 backdrop-blur-md border border-red-500/30 p-6 shadow-xl">
        <h3 className="font-bold text-white text-lg mb-2">Unable to Load Analytics</h3>
        <p className="text-white/70 text-sm mb-4">{error}</p>
        <button
          onClick={loadAnalytics}
          className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-white text-sm font-medium transition-colors"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!analytics) {
    return (
      <div className="rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-8 text-center">
        <p className="text-white/60 text-sm">No analytics data available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Performance Overview */}
      <div className="rounded-2xl bg-gradient-to-br from-blue-600/20 to-purple-600/20 backdrop-blur-md border border-blue-500/30 p-6 shadow-xl">
        <h3 className="font-bold text-white text-xl mb-4">Performance Overview</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center">
            <p className="text-white/60 text-xs mb-1">Total Plays</p>
            <p className="font-bold text-white text-2xl">{formatNumber(analytics.totalPlays)}</p>
            {analytics.recentGrowth.playsGrowth !== 0 && (
              <div className="flex items-center justify-center gap-1 mt-1">
                {analytics.recentGrowth.playsGrowth > 0 ? (
                  <TrendingUp className="w-3 h-3 text-green-400" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-red-400" />
                )}
                <span className={`text-xs font-medium ${analytics.recentGrowth.playsGrowth > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {Math.abs(analytics.recentGrowth.playsGrowth)}%
                </span>
              </div>
            )}
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center">
            <p className="text-white/60 text-xs mb-1">Unique Listeners</p>
            <p className="font-bold text-white text-2xl">{formatNumber(analytics.uniqueListeners)}</p>
            {analytics.recentGrowth.listenersGrowth !== 0 && (
              <div className="flex items-center justify-center gap-1 mt-1">
                {analytics.recentGrowth.listenersGrowth > 0 ? (
                  <TrendingUp className="w-3 h-3 text-green-400" />
                ) : (
                  <TrendingDown className="w-3 h-3 text-red-400" />
                )}
                <span className={`text-xs font-medium ${analytics.recentGrowth.listenersGrowth > 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {Math.abs(analytics.recentGrowth.listenersGrowth)}%
                </span>
              </div>
            )}
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center">
            <p className="text-white/60 text-xs mb-1">Total Likes</p>
            <p className="font-bold text-white text-2xl">{formatNumber(analytics.totalLikes)}</p>
          </div>

          <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center">
            <p className="text-white/60 text-xs mb-1">Playlist Adds</p>
            <p className="font-bold text-white text-2xl">{formatNumber(analytics.playlistAdds)}</p>
          </div>
        </div>

        <div className="mt-3 text-center">
          <p className="text-white/50 text-xs">
            Growth comparison: Last 7 days vs previous 7 days
          </p>
        </div>
      </div>

      {/* Top Performing Content */}
      {analytics.topContent.length > 0 && (
        <div className="rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-5">
          <h3 className="font-bold text-white text-lg mb-4">Top Performing Content</h3>
          <div className="space-y-3">
            {analytics.topContent.map((content, index) => {
              const colorClasses = getColorClasses(content.type);
              return (
                <div
                  key={content.id}
                  className="flex items-center justify-between p-3 bg-white/10 backdrop-blur-sm rounded-xl hover:bg-white/15 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {content.coverUrl ? (
                      <img
                        src={content.coverUrl}
                        alt={content.title}
                        className="w-12 h-12 rounded-xl object-cover"
                      />
                    ) : (
                      <div className={`w-12 h-12 ${colorClasses.bg} rounded-xl flex items-center justify-center`}>
                        <Music className={`w-6 h-6 ${colorClasses.text}`} />
                      </div>
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-white/50 text-xs font-bold">#{index + 1}</span>
                        <p className="text-white text-sm font-medium">{content.title}</p>
                      </div>
                      <p className="text-white/60 text-xs capitalize">
                        {content.type.replace('_', ' ')} • {formatNumber(content.playCount)} plays
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Audience Insights */}
      <div className="rounded-2xl bg-white/5 backdrop-blur-sm border border-white/10 p-5">
        <h3 className="font-bold text-white text-lg mb-4">Audience Insights</h3>
        <div className="space-y-4">
          <div>
            <p className="text-white/70 text-sm font-medium mb-3">Top Locations</p>
            {analytics.topLocations.length > 0 && analytics.topLocations[0].country !== 'No location data available' ? (
              <div className="space-y-3">
                {analytics.topLocations.map((location) => (
                  <div key={location.country}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-white text-sm">{location.country}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-white/50 text-xs">{formatNumber(location.count)} listeners</p>
                        <p className="text-white/70 text-sm font-semibold">{location.percentage}%</p>
                      </div>
                    </div>
                    <div className="w-full bg-white/10 rounded-full h-2.5">
                      <div
                        className="bg-gradient-to-r from-blue-500 to-purple-600 h-2.5 rounded-full transition-all duration-500"
                        style={{ width: `${location.percentage}%` }}
                      ></div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white/5 rounded-lg p-4 text-center">
                <p className="text-white/50 text-sm">
                  No location data available yet. Location data is automatically detected from all listeners based on their IP address and device information.
                </p>
              </div>
            )}
          </div>

          <div className="pt-3 border-t border-white/10">
            <p className="text-white/70 text-sm font-medium mb-2">Engagement Metrics</p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-white/60 text-xs mb-1">Comments</p>
                <p className="text-white text-lg font-bold">{formatNumber(analytics.totalComments)}</p>
              </div>
              <div className="bg-white/5 rounded-lg p-3">
                <p className="text-white/60 text-xs mb-1">Engagement Rate</p>
                <p className="text-white text-lg font-bold">
                  {analytics.totalPlays > 0
                    ? ((analytics.totalLikes + analytics.totalComments) / analytics.totalPlays * 100).toFixed(1)
                    : '0'}%
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
