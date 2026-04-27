import { useState, useEffect } from 'react';
import { Plus, Trash2, Edit2, Eye, EyeOff, ExternalLink, TrendingUp, CreditCard, Upload, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { NativeAdCard } from '../../lib/nativeAdService';
import { LoadingLogo } from '../../components/LoadingLogo';
import { directUploadToBunny } from '../../lib/directBunnyUpload';

const AUDIO_AD_PLACEHOLDER_IMAGE_URL = 'https://placehold.co/1200x1200/111827/FFFFFF?text=Audio+Ad';
const AUDIO_MIME_TYPES = ['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/wav', 'audio/x-wav', 'audio/ogg', 'audio/webm'];
const VISUAL_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'video/mp4', 'video/webm', 'video/quicktime'];

type UploadedMediaType = 'visual' | 'audio';
type ListFilterType = 'all' | 'visual' | 'audio';

const PLAYER_ONLY_PLACEMENTS = ['music_player', 'album_player', 'playlist_player', 'daily_mix_player'] as const;
const ALL_PLACEMENTS = [
  'home_popup',
  'trending_near_you_grid',
  'explore_grid',
  'home_grid',
  'home_featured_banner',
  'home_featured_banner_secondary',
  'music_player_popup',
  'album_player_popup',
  'playlist_player_popup',
  'daily_mix_player_popup',
  ...PLAYER_ONLY_PLACEMENTS,
] as const;

const PLACEMENT_LABELS: Record<string, string> = {
  home_popup: 'Home Screen Popup',
  trending_near_you_grid: 'Trending Near You',
  explore_grid: 'Explore Grid',
  home_grid: 'Home Grid',
  home_featured_banner: 'Home Featured Banner',
  home_featured_banner_secondary: 'Home Featured Banner 2',
  music_player: 'Music Player Screen',
  album_player: 'Album Player Screen',
  playlist_player: 'Playlist Player Screen',
  daily_mix_player: 'Daily Mix Player Screen',
  music_player_popup: 'Music Player Popup',
  album_player_popup: 'Album Player Popup',
  playlist_player_popup: 'Playlist Player Popup',
  daily_mix_player_popup: 'Daily Mix Player Popup',
};

export const NativeAdsSection = (): JSX.Element => {
  const [ads, setAds] = useState<NativeAdCard[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingAd, setEditingAd] = useState<NativeAdCard | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedMediaType, setSelectedMediaType] = useState<UploadedMediaType>('visual');
  const [listFilterType, setListFilterType] = useState<ListFilterType>('all');

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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const isVisual = VISUAL_MIME_TYPES.includes(file.type);
    const isAudio = AUDIO_MIME_TYPES.includes(file.type);
    if (!isVisual && !isAudio) {
      setError('Please select an image/video file or an audio file (max 20MB)');
      return;
    }

    if (file.size > 20 * 1024 * 1024) {
      setError('File size must be less than 20MB');
      return;
    }

    setSelectedFile(file);
    setSelectedMediaType(isAudio ? 'audio' : 'visual');
    setError(null);
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(URL.createObjectURL(file));
  };

  const uploadMedia = async (): Promise<{ url: string; type: UploadedMediaType } | null> => {
    if (!selectedFile) {
      return null;
    }

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      throw new Error('Authentication session expired. Please sign in again.');
    }

    const mediaType: UploadedMediaType = AUDIO_MIME_TYPES.includes(selectedFile.type) ? 'audio' : 'visual';
    const isVideoCreative = mediaType === 'visual' && selectedFile.type.startsWith('video/');

    // Do not depend on Edge Function transport for audio ad uploads.
    // This avoids "Failed to send a request to the Edge Function" failures in admin.
    if (mediaType === 'audio') {
      const audioUpload = await uploadAudioToSupabaseStorage(selectedFile, session.user.id);
      if (!audioUpload.url) {
        throw new Error(audioUpload.error || 'Failed to upload audio ad media to storage. Please try again.');
      }
      return { url: audioUpload.url, type: mediaType };
    }

    if (isVideoCreative) {
      const bunnyStreamUrl = await uploadVideoToBunnyStream(selectedFile);
      if (!bunnyStreamUrl) {
        throw new Error('Failed to upload video to Bunny Stream. Please try again.');
      }
      return { url: bunnyStreamUrl, type: mediaType };
    }

    const uploadResult = await directUploadToBunny(selectedFile, {
      userId: session.user.id,
      contentType: mediaType === 'audio' ? 'audio' : 'image',
      // Keep ad visuals in thumbnails-like public paths when image upload is routed via Supabase.
      customPath: mediaType === 'visual' ? 'thumbnails' : undefined,
    });
    if (uploadResult.success && uploadResult.publicUrl) {
      return { url: uploadResult.publicUrl, type: mediaType };
    }

    throw new Error(`Failed to upload media: ${uploadResult.error || 'Unknown upload error'}`);
  };

  const uploadVideoToBunnyStream = async (file: File): Promise<string | null> => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('title', file.name.replace(/\.[^/.]+$/, ''));

      const { data, error } = await supabase.functions.invoke('bunny-stream-upload', {
        body: formData,
      });

      if (error) {
        console.error('Bunny Stream upload invoke failed:', error);
        return null;
      }

      const publicUrl = (data as { publicUrl?: string } | null)?.publicUrl;
      if (!publicUrl || typeof publicUrl !== 'string') {
        console.error('Bunny Stream upload returned invalid payload:', data);
        return null;
      }

      return publicUrl;
    } catch (error) {
      console.error('Bunny Stream upload error:', error);
      return null;
    }
  };

  const uploadAudioToSupabaseStorage = async (
    file: File,
    userId: string
  ): Promise<{ url: string | null; error?: string }> => {
    try {
      const fileExt = file.name.split('.').pop() || 'mp3';
      const safeExt = fileExt.toLowerCase().replace(/[^a-z0-9]/g, '');
      const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${safeExt}`;
      // Keep userId as first folder segment to satisfy storage RLS policies
      // that scope uploads to auth.uid() prefix.
      const filePath = `${userId}/native-ads/${fileName}`;
      const candidateBuckets = ['content-media', 'thumbnails', 'covers'] as const;
      const errors: string[] = [];

      for (const bucket of candidateBuckets) {
        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(filePath, file, {
            cacheControl: '2592000',
            upsert: true,
            contentType: file.type || 'audio/mpeg',
          });

        if (uploadError) {
          const message = uploadError.message || 'Unknown upload error';
          errors.push(`${bucket}: ${message}`);
          continue;
        }

        const { data } = supabase.storage.from(bucket).getPublicUrl(filePath);
        if (data?.publicUrl) {
          return { url: data.publicUrl };
        }
      }

      return {
        url: null,
        error: `Audio upload failed across buckets (${errors.join(' | ')})`,
      };
    } catch (error) {
      console.error('Audio fallback upload error:', error);
      return {
        url: null,
        error: error instanceof Error ? error.message : 'Unknown audio upload error',
      };
    }
  };


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setFormSuccess(null);
    setError(null);

    try {
      const uploadedMedia = await uploadMedia();
      const isAudioAd = uploadedMedia?.type === 'audio' || (!uploadedMedia && !!editingAd?.audio_url);
      const finalImageUrl = uploadedMedia?.type === 'visual'
        ? uploadedMedia.url
        : (editingAd?.image_url || AUDIO_AD_PLACEHOLDER_IMAGE_URL);
      const finalAudioUrl = uploadedMedia?.type === 'audio'
        ? uploadedMedia.url
        : (isAudioAd ? (editingAd?.audio_url || null) : null);
      const playerOnlyPlacements = new Set([
        ...PLAYER_ONLY_PLACEMENTS,
        'music_player_popup',
        'album_player_popup',
        'playlist_player_popup',
        'daily_mix_player_popup',
      ]);

      if (finalAudioUrl && !playerOnlyPlacements.has(formData.placement_type)) {
        throw new Error('Audio ads can only be assigned to music player placements.');
      }

      if (!editingAd && !uploadedMedia) {
        throw new Error('Ad media file is required');
      }

      const adData = {
        title: formData.title,
        description: formData.description || null,
        image_url: finalImageUrl,
        audio_url: finalAudioUrl,
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
    setSelectedFile(null);
    setSelectedMediaType(ad.audio_url ? 'audio' : 'visual');
    setPreviewUrl(ad.audio_url || ad.image_url);
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
    setSelectedFile(null);
    setSelectedMediaType('visual');
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
  };

  const calculateCTR = (ad: NativeAdCard): string => {
    if (ad.impression_count === 0) return '0.00';
    return ((ad.click_count / ad.impression_count) * 100).toFixed(2);
  };

  const isAudioAd = (ad: NativeAdCard): boolean => !!ad.audio_url && ad.audio_url.trim().length > 0;

  const filteredAds = ads.filter((ad) => {
    if (listFilterType === 'all') return true;
    if (listFilterType === 'audio') return isAudioAd(ad);
    return !isAudioAd(ad);
  });

  const placementOptions =
    selectedMediaType === 'audio'
      ? [...PLAYER_ONLY_PLACEMENTS, 'music_player_popup', 'album_player_popup', 'playlist_player_popup', 'daily_mix_player_popup']
      : ALL_PLACEMENTS;

  const ensureValidPlacementForMediaType = (mediaType: UploadedMediaType) => {
    const validAudioPlacements = new Set([
      ...PLAYER_ONLY_PLACEMENTS,
      'music_player_popup',
      'album_player_popup',
      'playlist_player_popup',
      'daily_mix_player_popup',
    ]);
    if (mediaType === 'audio' && !validAudioPlacements.has(formData.placement_type)) {
      setFormData((prev) => ({ ...prev, placement_type: 'music_player' }));
    }
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

      {/* List Filter */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setListFilterType('all')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            listFilterType === 'all'
              ? 'bg-[#309605] text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All Ads
        </button>
        <button
          type="button"
          onClick={() => setListFilterType('visual')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            listFilterType === 'visual'
              ? 'bg-[#309605] text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Visual Ads
        </button>
        <button
          type="button"
          onClick={() => setListFilterType('audio')}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
            listFilterType === 'audio'
              ? 'bg-[#309605] text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Audio Ads
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg p-6 space-y-4 border border-gray-100 shadow-sm">
          <h3 className="text-lg font-semibold text-gray-900 mb-1">
            {editingAd ? 'Edit Native Ad' : 'Create Native Ad'}
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            Upload visual or audio creative, set targeting and choose where this card appears.
          </p>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ad Title *
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#309605]/70 focus:border-[#309605]"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Advertiser Name *
              </label>
              <input
                type="text"
                value={formData.advertiser_name}
                onChange={(e) => setFormData({ ...formData, advertiser_name: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#309605]/70 focus:border-[#309605]"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#309605]/70 focus:border-[#309605]"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Ad Media (image/video/audio) *
              </label>
              {previewUrl ? (
                <div className="space-y-2">
                  <div className="relative rounded-lg overflow-hidden bg-white/10 h-32">
                    {selectedMediaType === 'audio' ? (
                      <div className="w-full h-full flex items-center justify-center bg-gray-50 border border-gray-200 rounded-lg px-4">
                        <audio src={previewUrl} controls className="w-full" />
                      </div>
                    ) : previewUrl.match(/\.(mp4|webm|mov)$/i) ? (
                      <video
                        src={previewUrl}
                        className="w-full h-full object-cover"
                        muted
                        autoPlay
                        loop
                      />
                    ) : (
                      <img
                        src={previewUrl}
                        alt="Ad preview"
                        className="w-full h-full object-cover"
                      />
                    )}
                    <button
                      type="button"
                      className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center"
                      onClick={() => {
                        setSelectedFile(null);
                        const nextType: UploadedMediaType = editingAd?.audio_url ? 'audio' : 'visual';
                        setSelectedMediaType(nextType);
                        ensureValidPlacementForMediaType(nextType);
                        if (previewUrl && previewUrl.startsWith('blob:')) {
                          URL.revokeObjectURL(previewUrl);
                        }
                        setPreviewUrl(editingAd?.audio_url || editingAd?.image_url || null);
                      }}
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="relative">
                  <input
                    id="native-ad-media"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/jpg,video/mp4,video/webm,video/quicktime,audio/mpeg,audio/mp3,audio/mp4,audio/x-m4a,audio/aac,audio/wav,audio/ogg,audio/webm"
                    className="hidden"
                    onChange={(e) => {
                      handleFileChange(e);
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const nextType: UploadedMediaType = AUDIO_MIME_TYPES.includes(file.type) ? 'audio' : 'visual';
                      ensureValidPlacementForMediaType(nextType);
                    }}
                  />
                  <label
                    htmlFor="native-ad-media"
                    className="flex flex-col items-center justify-center w-full h-32 bg-gray-50 border border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-gray-400 transition"
                  >
                    <Upload className="w-5 h-5 text-gray-600 mb-1" />
                    <span className="text-xs text-gray-800">Upload image, video, or audio ad</span>
                    <span className="text-[11px] text-gray-500 mt-0.5">Max 20MB · MP4/WebM/MP3/M4A/AAC/WAV or JPG/PNG/WebP</span>
                  </label>
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Click URL *
              </label>
              <input
                type="url"
                value={formData.click_url}
                onChange={(e) => setFormData({ ...formData, click_url: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#309605]/70 focus:border-[#309605]"
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-3 xl:grid-cols-4 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Placement Type *
              </label>
              <select
                value={formData.placement_type}
                onChange={(e) => setFormData({ ...formData, placement_type: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#309605]/70 focus:border-[#309605]"
                required
              >
                {placementOptions.map((placement) => (
                  <option key={placement} value={placement}>
                    {PLACEMENT_LABELS[placement]}
                  </option>
                ))}
              </select>
              {selectedMediaType === 'audio' ? (
                <p className="mt-1 text-[11px] text-gray-500">
                  Audio ads are limited to player placements.
                </p>
              ) : null}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priority (1-10) *
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#309605]/70 focus:border-[#309605]"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Expires At
              </label>
              <input
                type="date"
                value={formData.expires_at}
                onChange={(e) => setFormData({ ...formData, expires_at: e.target.value })}
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#309605]/70 focus:border-[#309605]"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Countries (comma-separated codes)
              </label>
              <input
                type="text"
                value={formData.target_countries}
                onChange={(e) => setFormData({ ...formData, target_countries: e.target.value })}
                placeholder="e.g., NG, US, GB"
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#309605]/70 focus:border-[#309605]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Target Genres (comma-separated IDs)
              </label>
              <input
                type="text"
                value={formData.target_genres}
                onChange={(e) => setFormData({ ...formData, target_genres: e.target.value })}
                placeholder="Leave empty for all genres"
                className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#309605]/70 focus:border-[#309605]"
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
            <label htmlFor="is_active" className="text-sm text-gray-700">
              Active (show this ad)
            </label>
          </div>

          <div className="flex gap-2 pt-4">
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2 bg-[#309605] hover:bg-[#3ba208] text-white rounded-lg transition-colors disabled:opacity-50 text-sm font-medium"
            >
              {isSubmitting ? 'Saving...' : editingAd ? 'Update Ad' : 'Create Ad'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="px-6 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-lg transition-colors text-sm font-medium"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Ads List */}
      <div className="space-y-4">
        {filteredAds.length === 0 ? (
          <div className="bg-white/5 rounded-lg p-8 text-center">
            <p className="text-gray-400">No ads match this filter</p>
          </div>
        ) : (
          filteredAds.map((ad) => (
            <div key={ad.id} className="bg-white/5 rounded-lg p-4">
              <div className="flex items-start gap-4">
                {/* Ad Media */}
                {ad.audio_url ? (
                  <div className="w-24 h-24 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-center p-2">
                    <audio src={ad.audio_url} controls className="w-full" />
                  </div>
                ) : (
                  <img
                    src={ad.image_url}
                    alt={ad.title}
                    className="w-24 h-24 object-cover rounded-lg"
                  />
                )}

                {/* Ad Details */}
                <div className="flex-1">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="text-white font-semibold">{ad.title}</h3>
                      <p className="text-gray-400 text-sm">{ad.advertiser_name}</p>
                      {isAudioAd(ad) ? (
                        <p className="text-xs text-blue-300 mt-1">Audio Ad (Player Placement)</p>
                      ) : (
                        <p className="text-xs text-gray-500 mt-1">Visual Ad</p>
                      )}
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
