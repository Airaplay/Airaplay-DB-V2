import React, { useState } from 'react';
import { RefreshCw, Globe, Music, Sparkles, CheckCircle, AlertCircle } from 'lucide-react';
import { refreshGlobalMixesIfNeeded } from '../../lib/globalDailyMixGenerator';

export const GlobalDailyMixManagerSection: React.FC = () => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  const handleGenerateGlobalMixes = async () => {
    try {
      setIsGenerating(true);
      setMessage({ type: 'info', text: 'Generating global daily mixes...' });

      const wasGenerated = await refreshGlobalMixesIfNeeded();

      if (wasGenerated) {
        setMessage({ type: 'success', text: 'Global daily mixes generated successfully!' });
      } else {
        setMessage({ type: 'info', text: 'Global mixes are still fresh, no regeneration needed.' });
      }
    } catch (error) {
      console.error('Error generating global mixes:', error);
      setMessage({ type: 'error', text: 'Failed to generate global mixes. Check console for details.' });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleForceRegenerate = async () => {
    try {
      setIsGenerating(true);
      setMessage({ type: 'info', text: 'Force regenerating global daily mixes...' });

      // Import the generator and force regenerate
      const { generateGlobalMixes } = await import('../../lib/globalDailyMixGenerator');
      
      // Force delete old mixes first
      const { supabase } = await import('../../lib/supabase');
      await supabase.from('global_daily_mix_playlists').delete().neq('id', '00000000-0000-0000-0000-000000000000');

      // Generate new ones
      await generateGlobalMixes();

      setMessage({ type: 'success', text: 'Global daily mixes force regenerated successfully!' });
    } catch (error) {
      console.error('Error force regenerating global mixes:', error);
      setMessage({ type: 'error', text: 'Failed to force regenerate global mixes. Check console for details.' });
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
          <Globe className="w-6 h-6 text-white" />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-white">Global Daily Mix Manager</h2>
          <p className="text-white/60 text-sm">
            Manage global daily mixes for non-authenticated and new users
          </p>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5">
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-white font-semibold mb-2">About Global Mixes</h3>
            <p className="text-white/70 text-sm leading-relaxed mb-3">
              Global daily mixes are automatically generated playlists visible to all users (authenticated and non-authenticated).
              They are based on trending songs, popular genres, and global listening patterns.
            </p>
            <ul className="text-white/60 text-sm space-y-1.5">
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span>Updated automatically every 24 hours</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span>No listening history required</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span>Cached for optimal performance</span>
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-400" />
                <span>Includes artist images and metadata</span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={handleGenerateGlobalMixes}
          disabled={isGenerating}
          className="flex items-center justify-center gap-3 p-5 bg-gradient-to-br from-purple-500/20 to-pink-500/20 border border-purple-500/30 rounded-xl hover:from-purple-500/30 hover:to-pink-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-5 h-5 text-purple-400 ${isGenerating ? 'animate-spin' : ''}`} />
          <div className="text-left">
            <div className="text-white font-semibold">Generate If Needed</div>
            <div className="text-white/60 text-xs">Only generates if mixes are expired</div>
          </div>
        </button>

        <button
          onClick={handleForceRegenerate}
          disabled={isGenerating}
          className="flex items-center justify-center gap-3 p-5 bg-gradient-to-br from-orange-500/20 to-red-500/20 border border-orange-500/30 rounded-xl hover:from-orange-500/30 hover:to-red-500/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Music className={`w-5 h-5 text-orange-400 ${isGenerating ? 'animate-pulse' : ''}`} />
          <div className="text-left">
            <div className="text-white font-semibold">Force Regenerate</div>
            <div className="text-white/60 text-xs">Delete old mixes and create new ones</div>
          </div>
        </button>
      </div>

      {/* Status Message */}
      {message && (
        <div
          className={`p-4 rounded-xl border ${
            message.type === 'success'
              ? 'bg-green-500/10 border-green-500/30 text-green-400'
              : message.type === 'error'
              ? 'bg-red-500/10 border-red-500/30 text-red-400'
              : 'bg-blue-500/10 border-blue-500/30 text-blue-400'
          }`}
        >
          <div className="flex items-center gap-3">
            {message.type === 'success' ? (
              <CheckCircle className="w-5 h-5" />
            ) : message.type === 'error' ? (
              <AlertCircle className="w-5 h-5" />
            ) : (
              <Sparkles className="w-5 h-5" />
            )}
            <span className="text-sm font-medium">{message.text}</span>
          </div>
        </div>
      )}

      {/* Technical Details */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-5">
        <h3 className="text-white font-semibold mb-3">Technical Details</h3>
        <div className="space-y-2 text-sm text-white/60">
          <div className="flex justify-between">
            <span>Tables:</span>
            <span className="text-white/80 font-mono">global_daily_mix_playlists, global_daily_mix_tracks</span>
          </div>
          <div className="flex justify-between">
            <span>RLS Policies:</span>
            <span className="text-white/80">Public read, Admin write only</span>
          </div>
          <div className="flex justify-between">
            <span>Cache Duration:</span>
            <span className="text-white/80">4 hours (client-side)</span>
          </div>
          <div className="flex justify-between">
            <span>Expires After:</span>
            <span className="text-white/80">24 hours (database)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
