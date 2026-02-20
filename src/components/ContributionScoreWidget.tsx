import React, { useEffect, useState } from 'react';
import { Award, TrendingUp, Music, ListMusic, Heart, Sparkles } from 'lucide-react';
import { getUserContributionScore, subscribeToContributionScore, type ContributionScore } from '../lib/contributionService';
import { useAuth } from '../contexts/AuthContext';

interface ContributionScoreWidgetProps {
  userId?: string;
  compact?: boolean;
}

export const ContributionScoreWidget: React.FC<ContributionScoreWidgetProps> = ({ userId, compact = false }) => {
  const { user } = useAuth();
  const targetUserId = userId || user?.id;
  const [score, setScore] = useState<ContributionScore | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!targetUserId) return;

    const loadScore = async () => {
      try {
        const data = await getUserContributionScore(targetUserId);
        setScore(data);
      } catch (error) {
        console.error('Error loading contribution score:', error);
      } finally {
        setLoading(false);
      }
    };

    loadScore();

    // Subscribe to real-time updates
    const unsubscribe = subscribeToContributionScore(targetUserId, (updatedScore) => {
      setScore(updatedScore);
    });

    return () => {
      unsubscribe();
    };
  }, [targetUserId]);

  if (loading) {
    return (
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6 animate-pulse">
        <div className="h-6 bg-white/10 rounded w-1/2 mb-4"></div>
        <div className="h-10 bg-white/10 rounded w-3/4"></div>
      </div>
    );
  }

  // Show default state with 0 points if no score exists yet
  const displayScore: ContributionScore = score || {
    user_id: targetUserId || '',
    total_points: 0,
    current_period_points: 0,
    playlist_creation_points: 0,
    discovery_points: 0,
    curation_points: 0,
    engagement_points: 0,
    last_reward_date: null,
    updated_at: new Date().toISOString()
  };

  if (compact) {
    return (
      <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-white/70" />
            <span className="text-sm font-medium text-white/90">Contribution Score</span>
          </div>
          <span className="text-2xl font-bold text-white">
            {displayScore.total_points?.toLocaleString() || 0}
          </span>
        </div>
        <div className="mt-2 text-xs text-white/70">
          This period: {displayScore.current_period_points?.toLocaleString() || 0} pts
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-white/10 rounded-xl">
            <Award className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-['Inter',sans-serif] text-base font-semibold text-white">Contribution Score</h3>
            <p className="text-xs text-white/70">Earn from community value</p>
          </div>
        </div>
        <div className="text-right">
          <div className="text-3xl font-bold text-white">
            {displayScore.total_points?.toLocaleString() || 0}
          </div>
          <div className="text-xs text-white/60 mt-0.5">Total Points</div>
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between px-4 py-3 bg-white/10 rounded-xl border border-white/10">
          <div className="flex items-center gap-2.5">
            <TrendingUp className="w-4 h-4 text-white/70" />
            <span className="text-sm font-medium text-white/90">This Period</span>
          </div>
          <span className="text-sm font-semibold text-white">
            {displayScore.current_period_points?.toLocaleString() || 0} pts
          </span>
        </div>

        <div className="mt-4 px-4 py-3 bg-white/10 border border-white/10 rounded-xl">
          <p className="font-['Inter',sans-serif] text-xs text-white/90 leading-relaxed">
            <strong>Earnings Pool:</strong> Your share is based on your contribution score. More points = larger share!
          </p>
        </div>

        {displayScore.total_points === 0 && (
          <div className="mt-3 px-4 py-3 bg-white/10 border border-white/10 rounded-xl">
            <p className="font-['Inter',sans-serif] text-xs text-white/90 leading-relaxed">
              <strong>Get Started:</strong> Create playlists, discover music, and engage to earn points!
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
