import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Eye, EyeOff, ExternalLink, TrendingUp, CreditCard } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { NativeAdCard } from '../../lib/nativeAdService';
import { LoadingLogo } from '../../components/LoadingLogo';

export const NativeAdsSection = (): JSX.Element => {
  const [ads, setAds] = useState<NativeAdCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingAd, setEditingAd] = useState<NativeAdCard | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    image_url: '',
    click_url: '',
    advertiser_name: '',
    placement_type: 'trending_near_you_grid',
    priority: 5,
    is_active: true,
    target_countries: '',
    target_genres: '',
    expires_at: ''
  });

  useEffect(() => {
    fetchNativeAds();
  }, []);

  const fetchNativeAds = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase
        .from('native_ad_cards')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;

      setAds(data || []);
    } catch (err) {
      console.error('Error fetching native ads:', err);
      setError('Failed to load native ads');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormSuccess(null);
    setError(null);

    try {
      const adData = {
        title: formData.title,
        description: formData.description || null,
        image_url: formData.image_url,
        click_url: formData.click_url,
        advertiser_name: formData.advertiser_name,
        placement_type: formData.placement_type,
        priority: formData.priority,
        is_active: formData.is_active,
        target_countries: formData.target_countries
          ? formData.target_countries.split(',').map(c => c.trim()).filter(Boolean)
          : null,
        target_genres: formData.target_genres
          ? formData.target_genres.split(',').map(g => g.trim()).filter(Boolean)
          : null,
        expires_at: formData.expires_at || null
      };

      if (editingAd) {
        // Update existing ad
        const { error: updateError } = await supabase
          .from('native_ad_cards')
          .update(adData)
          .eq('id', editingAd.id);

        if (updateError) throw updateError;
        setFormSuccess('Native ad updated successfully!');
      } else {
        // Create new ad
        const { error: insertError } = await supabase
          .from('native_ad_cards')
          .insert(adData);

        if (insertError) throw insertError;
        setFormSuccess('Native ad created successfully!');
      }

      // Reset form and refresh list
      resetForm();
      fetchNativeAds();
    } catch (err: any) {
      console.error('Error saving native ad:', err);
      setError(err.message || 'Failed to save native ad');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (ad: NativeAdCard) => {
    setEditingAd(ad);
    setFormData({
      title: ad.title,
      description: ad.description || '',
      image_url: ad.image_url,
      click_url: ad.click_url,
      advertiser_name: ad.advertiser_name,
      placement_type: ad.placement_type,
      priority: ad.priority,
      is_active: ad.is_active,
      target_countries: ad.target_countries?.join(', ') || '',
      target_genres: ad.target_genres?.join(', ') || '',
      expires_at: ad.expires_at ? new Date(ad.expires_at).toISOString().split('T')[0] : ''
    });
    setShowForm(true);
  };

  const handleToggleActive = async (ad: NativeAdCard) => {
    try {
      const { error: updateError } = await supabase
        .from('native_ad_cards')
        .update({ is_active: !ad.is_active })
        .eq('id', ad.id);

      if (updateError) throw updateError;
      fetchNativeAds();
    } catch (err) {
      console.error('Error toggling ad status:', err);
      setError('Failed to update ad status');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this native ad?')) return;

    try {
      const { error: deleteError } = await supabase
        .from('native_ad_cards')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;
      fetchNativeAds();
    } catch (err) {
      console.error('Error deleting native ad:', err);
      setError('Failed to delete native ad');
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      image_url: '',
      click_url: '',
      advertiser_name: '',
      placement_type: 'trending_near_you_grid',
      priority: 5,
      is_active: true,
      target_countries: '',
      target_genres: '',
      expires_at: ''
    });
    setEditingAd(null);
    setShowForm(false);
    setFormSuccess(null);
    setError(null);
  };

  const calculateCTR = (ad: NativeAdCard): string => {
    if (ad.impression_count === 0) return '0.00';
    return ((ad.click_count / ad.impression_count) * 100).toFixed(2);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingLogo />
      </div>
    );
  }

  return (
    <div className="space-y-4 min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
            <CreditCard className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900 leading-tight">Native Ad Cards</h2>
            <p className="text-sm text-gray-400 mt-0.5">Manage native advertisement cards displayed in the app feed</p>
          </div>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-[#309605] hover:bg-[#3ba208] text-white rounded-lg transition-colors flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          {showForm ? 'Cancel' : 'Create Ad'}
        </button>
      </div>

      {/* Success/Error Messages */}
      {formSuccess && (
        <div className="bg-green-500/20 border border-green-500/30 rounded-lg p-4">
          <p className="text-green-400">{formSuccess}</p>
        </div>
      )}

      {error && (
        <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4">
          <p className="text-red-400">{error}</p>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white/5 rounded-lg p-6 space-y-4">
          <h3 className="text-lg font-semibold text-white mb-4">
            {editingAd ? 'Edit Native Ad' : 'Create Native Ad'}
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Ad Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Advertiser Name *
              </label>
              <input
                type="text"
                value={formData.advertiser_name}
                onChange={(e) => setFormData({ ...formData, advertiser_name: e.target.value })}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Image URL *
              </label>
              <input
                type="url"
                value={formData.image_url}
                onChange={(e) => setFormData({ ...formData, image_url: e.target.value })}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Click URL *
              </label>
              <input
                type="url"
                value={formData.click_url}
                onChange={(e) => setFormData({ ...formData, click_url: e.target.value })}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 xl:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Placement Type *
              </label>
              <select
                value={formData.placement_type}
                onChange={(e) => setFormData({ ...formData, placement_type: e.target.value })}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                required
              >
                <option value="trending_near_you_grid">Trending Near You</option>
                <option value="explore_grid">Explore Grid</option>
                <option value="home_grid">Home Grid</option>
                <option value="music_player">Music Player Screen</option>
                <option value="album_player">Album Player Screen</option>
                <option value="playlist_player">Playlist Player Screen</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Priority (1-10) *
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Expires At
              </label>
              <input
                type="date"
                value={formData.expires_at}
                onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Target Countries (comma-separated codes)
              </label>
              <input
                type="text"
                value={formData.target_countries}
                onChange={(e) => setFormData({ ...formData, target_countries: e.target.value })}
                placeholder="e.g., NG, US, GB"
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Target Genres (comma-separated IDs)
              </label>
              <input
                type="text"
                value={formData.target_genres}
                onChange={(e) => setFormData({ ...formData, target_genres: e.target.value })}
                placeholder="Leave empty for all genres"
                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-lg text-white"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_active"
              checked={formData.is_active}
              onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
              className="w-4 h-4"
            />
            <label htmlFor="is_active" className="text-sm text-gray-300">
              Active (show this ad)
            </label>
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-[#309605] hover:bg-[#3ba208] text-white rounded-lg transition-colors disabled:opacity-50"
            >
              {isSubmitting ? 'Saving...' : editingAd ? 'Update Ad' : 'Create Ad'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-6 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Ads List */}
      <div className="space-y-4">
        {ads.length === 0 ? (
          <div className="bg-white/5 rounded-lg p-8 text-center">
            <p className="text-gray-400">No native ads created yet</p>
          </div>
        ) : (
          ads.map((ad) => (
            <div key={ad.id} className="bg-white/5 rounded-lg p-4">
              <div className="flex items-start gap-4">
                {/* Ad Image */}
                <img
                  src={ad.image_url}
                  alt={ad.title}
                  className="w-24 h-24 object-cover rounded-lg"
                />

                {/* Ad Details */}
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-white font-semibold">{ad.title}</h3>
                      <p className="text-gray-400 text-sm">{ad.advertiser_name}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs ${
                        ad.is_active ? 'bg-green-500/20 text-green-400' : 'bg-gray-500/20 text-gray-400'
                      }`}>
                        {ad.is_active ? 'Active' : 'Inactive'}
                      </span>
                      <span className="px-2 py-1 rounded text-xs bg-blue-500/20 text-blue-400">
                        Priority: {ad.priority}
                      </span>
                    </div>
                  </div>

                  {ad.description && (
                    <p className="text-gray-400 text-sm mb-2">{ad.description}</p>
                  )}

                  <div className="flex items-center gap-4 text-sm text-gray-400 mb-3">
                    <div className="flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      <span>{ad.impression_count} views</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <ExternalLink className="w-4 h-4" />
                      <span>{ad.click_count} clicks</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="w-4 h-4" />
                      <span>CTR: {calculateCTR(ad)}%</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(ad)}
                      className="px-3 py-1.5 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded transition-colors flex items-center gap-1"
                    >
                      <Edit2 className="w-3 h-3" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleToggleActive(ad)}
                      className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded transition-colors flex items-center gap-1"
                    >
                      {ad.is_active ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      {ad.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                    <button
                      onClick={() => handleDelete(ad.id)}
                      className="px-3 py-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded transition-colors flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
