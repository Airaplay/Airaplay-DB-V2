import React, { useState, useEffect, useCallback } from 'react';
import { X, Music, Search, Plus, Trash2, Image as ImageIcon, Globe, Lock } from 'lucide-react';
import { supabase, addSongToPlaylist } from '../lib/supabase';
import { Link } from 'react-router-dom';
import { trackPlaylistCreated } from '../lib/contributionService';

interface CreatePlaylistModalProps {
  onClose: () => void;
  onSuccess: () => void;
  initialSongId?: string | null;
}

interface Song {
  id: string;
  title: string;
  artist_name: string;
  artistId?: string | null;
  duration_seconds: number;
  cover_image_url: string | null;
}

interface ArtistWithProfiles {
  id: string;
  name: string;
  artist_profiles?: { user_id: string }[];
}

export const CreatePlaylistModal: React.FC<CreatePlaylistModalProps> = ({
  onClose,
  onSuccess,
  initialSongId
}) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
  });
  const [isPublic, setIsPublic] = useState(true);
  const [selectedCoverFile, setSelectedCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<Song[]>([]);
  const [selectedSongs, setSelectedSongs] = useState<Song[]>([]);

  const searchSongs = useCallback(async (query: string) => {
    if (!query.trim()) return;

    setIsSearching(true);
    try {
      const { data, error } = await supabase
        .from('songs')
        .select(`
          id,
          title,
          duration_seconds,
          cover_image_url,
          artist:artist_id(
            id,
            name,
            artist_profiles(user_id)
          )
        `)
        .ilike('title', `%${query}%`)
        .limit(10);

      if (error) throw error;

      if (!data) {
        setSearchResults([]);
        return;
      }

      const formattedResults = data.map(song => {
        const artist = song.artist as unknown as ArtistWithProfiles;
        const artistUserId = artist?.artist_profiles?.[0]?.user_id || null;

        return {
          id: song.id,
          title: song.title,
          artist_name: artist?.name || 'Unknown Artist',
          artistId: artistUserId,
          duration_seconds: song.duration_seconds || 0,
          cover_image_url: song.cover_image_url
        };
      });

      const filteredResults = formattedResults.filter(
        song => !selectedSongs.some(selected => selected.id === song.id)
      );

      setSearchResults(filteredResults);
    } catch (err) {
      console.error('Error in song search:', err);
    } finally {
      setIsSearching(false);
    }
  }, [selectedSongs]);

  useEffect(() => {
    return () => {
      if (coverPreviewUrl && coverPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(coverPreviewUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (initialSongId) {
      fetchInitialSong(initialSongId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSongId]);

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        searchSongs(searchQuery);
      } else {
        setSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, searchSongs]);

  const fetchInitialSong = async (songId: string) => {
    try {
      const { data, error } = await supabase
        .from('songs')
        .select(`
          id,
          title,
          duration_seconds,
          cover_image_url,
          artist:artist_id (
            id,
            name,
            artist_profiles(user_id)
          )
        `)
        .eq('id', songId)
        .single();

      if (error) {
        console.error('Error fetching initial song:', error);
        return;
      }

      if (!data) return;

      const artist = data.artist as unknown as ArtistWithProfiles;
      const artistUserId = artist?.artist_profiles?.[0]?.user_id || null;

      const song: Song = {
        id: data.id,
        title: data.title,
        artist_name: artist?.name || 'Unknown Artist',
        artistId: artistUserId,
        duration_seconds: data.duration_seconds || 0,
        cover_image_url: data.cover_image_url
      };

      setSelectedSongs([song]);
    } catch (error) {
      console.error('Error fetching initial song:', error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleCoverFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        setError('Please select a valid image file (JPEG, PNG, or WebP) for cover art');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError('Cover art image size must be less than 5MB');
        return;
      }

      setSelectedCoverFile(file);
      setError(null);
      if (coverPreviewUrl) {
        URL.revokeObjectURL(coverPreviewUrl);
      }
      setCoverPreviewUrl(URL.createObjectURL(file));
    }
  };

  const addSongToSelection = (song: Song) => {
    if (!selectedSongs.some(s => s.id === song.id)) {
      setSelectedSongs(prev => [...prev, song]);
    }
    setSearchQuery('');
    setSearchResults([]);
  };

  const removeSongFromSelection = (songId: string) => {
    setSelectedSongs(prev => prev.filter(song => song.id !== songId));
  };

  const uploadCoverFile = async (userId: string): Promise<{ url: string; storagePath: string } | null> => {
    if (!selectedCoverFile) return null;

    try {
      const fileExt = selectedCoverFile.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${userId}/playlists/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('covers')
        .upload(filePath, selectedCoverFile, {
          cacheControl: '3600',
          upsert: true
        });

      if (uploadError) {
        throw new Error(uploadError.message || 'Upload failed');
      }

      const { data: { publicUrl } } = supabase.storage
        .from('covers')
        .getPublicUrl(filePath);

      return {
        url: publicUrl,
        storagePath: filePath
      };
    } catch (err) {
      console.error('Error uploading playlist cover:', err);
      throw err;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.title.trim()) {
      setError('Playlist title is required');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error('Authentication session expired. Please sign in again.');
      }
      const userId = session.user.id;

      let coverResult = null;
      if (selectedCoverFile) {
        coverResult = await uploadCoverFile(userId);
      }

      const { data: playlistData, error: insertError } = await supabase
        .from('playlists')
        .insert({
          user_id: userId,
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          cover_image_url: coverResult?.url || null,
          is_public: isPublic,
        })
        .select()
        .single();

      if (insertError) {
        throw new Error(`Failed to create playlist: ${insertError.message}`);
      }

      if (selectedSongs.length > 0 && playlistData) {
        for (const song of selectedSongs) {
          await addSongToPlaylist(playlistData.id, song.id);
        }
      }

      // Track playlist creation for contribution rewards
      if (playlistData) {
        await trackPlaylistCreated(playlistData.id).catch(console.error);
      }

      if (coverPreviewUrl) {
        URL.revokeObjectURL(coverPreviewUrl);
      }

      onSuccess();
      onClose();
    } catch (err) {
      console.error('Error creating playlist:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[110] flex items-end sm:items-center justify-center">
      <div className="w-full max-w-lg bg-gradient-to-b from-[#1a1a1a] via-[#0d0d0d] to-[#000000] rounded-t-3xl sm:rounded-3xl max-h-[95vh] overflow-y-auto border-t border-white/10 sm:border shadow-2xl">
        <div className="sticky top-0 z-10 bg-gradient-to-b from-[#1a1a1a] to-transparent backdrop-blur-sm px-6 py-4 border-b border-white/10">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">Create New Playlist</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-full transition-all"
              aria-label="Close"
            >
              <X className="w-5 h-5 text-white/80" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 pb-24 space-y-6">
          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Playlist Title *
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              required
              className="w-full h-12 px-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#309605]/50 focus:border-[#309605]/50 transition-all"
              placeholder="e.g., My Workout Mix"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Description (Optional)
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-4 py-3 bg-white/10 backdrop-blur-sm border border-white/20 rounded-xl text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#309605]/50 focus:border-[#309605]/50 transition-all resize-none"
              placeholder="Tell us about your playlist..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-white/80 mb-3">
              Privacy
            </label>
            <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition-all">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-all ${
                  isPublic
                    ? 'bg-[#00ad74]/20'
                    : 'bg-white/10'
                }`}>
                  {isPublic ? (
                    <Globe className="w-5 h-5 text-[#00ad74]" />
                  ) : (
                    <Lock className="w-5 h-5 text-white/60" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-white">
                    {isPublic ? 'Public' : 'Private'}
                  </p>
                  <p className="text-xs text-white/60 mt-0.5">
                    {isPublic
                      ? 'Anyone can view and play this playlist'
                      : 'Only you can view and play this playlist'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPublic(!isPublic)}
                className={`relative w-12 h-6 rounded-full transition-all ${
                  isPublic
                    ? 'bg-[#00ad74]'
                    : 'bg-white/20'
                }`}
                aria-label={isPublic ? 'Set to private' : 'Set to public'}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full transition-transform shadow-lg ${
                    isPublic ? 'translate-x-6' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-white/80 mb-2">
              Playlist Cover (Optional)
            </label>

            {selectedCoverFile ? (
              <div className="relative">
                <div className="w-full h-48 rounded-xl overflow-hidden bg-white/5">
                  <img
                    src={coverPreviewUrl || undefined}
                    alt="Playlist cover preview"
                    className="w-full h-full object-cover"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCoverFile(null);
                    if (coverPreviewUrl) {
                      URL.revokeObjectURL(coverPreviewUrl);
                      setCoverPreviewUrl(null);
                    }
                  }}
                  className="absolute top-3 right-3 w-10 h-10 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-all shadow-lg"
                  aria-label="Remove cover"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="file"
                  accept="image/jpeg,image/jpg,image/png,image/webp"
                  onChange={handleCoverFileChange}
                  className="hidden"
                  id="playlist-cover-upload"
                />
                <label
                  htmlFor="playlist-cover-upload"
                  className="flex flex-col items-center justify-center w-full h-32 bg-white/5 border-2 border-dashed border-white/20 hover:border-white/40 rounded-xl cursor-pointer transition-all group"
                >
                  <ImageIcon className="w-8 h-8 text-white/60 group-hover:text-white/80 mb-2 transition-colors" />
                  <p className="text-sm font-medium text-white/80">Upload Cover Image</p>
                  <p className="text-xs text-white/60 mt-1">JPEG, PNG, WebP (max 5MB)</p>
                </label>
              </div>
            )}
          </div>

          <div className="pt-2">
            <h3 className="text-base font-semibold text-white mb-3">
              Add Songs to Playlist
            </h3>

            <div className="relative mb-4">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-white/40" />
              <input
                type="text"
                placeholder="Search for songs to add..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-12 pl-12 pr-4 bg-white/10 backdrop-blur-sm border border-white/20 rounded-full text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-[#309605]/50 focus:border-[#309605]/50 transition-all"
              />
            </div>

            {isSearching && (
              <div className="flex items-center justify-center py-4">
                <div className="w-5 h-5 border-2 border-[#309605] border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm text-white/70 ml-3">Searching...</p>
              </div>
            )}

            {searchResults.length > 0 && (
              <div className="mb-4 p-2 bg-white/5 rounded-xl max-h-60 overflow-y-auto space-y-1">
                {searchResults.map((song) => (
                  <div
                    key={song.id}
                    onClick={() => addSongToSelection(song)}
                    className="flex items-center justify-between p-3 hover:bg-white/10 rounded-lg transition-all cursor-pointer group"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-10 h-10 rounded-lg bg-white/10 flex-shrink-0 overflow-hidden">
                        {song.cover_image_url ? (
                          <img
                            src={song.cover_image_url}
                            alt={song.title}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Music className="w-5 h-5 text-white/40" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-white truncate">{song.title}</p>
                        <p className="text-xs text-white/60 truncate">{song.artist_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-white/60">{formatDuration(song.duration_seconds)}</span>
                      <div className="w-8 h-8 rounded-full bg-[#309605]/20 group-hover:bg-[#309605]/30 flex items-center justify-center transition-all">
                        <Plus className="w-4 h-4 text-[#309605]" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {searchQuery.length >= 2 && searchResults.length === 0 && !isSearching && (
              <div className="p-4 bg-white/5 rounded-lg text-center mb-4">
                <p className="text-sm text-white/70">No songs found matching &quot;{searchQuery}&quot;</p>
              </div>
            )}

            <div>
              <h4 className="text-sm font-medium text-white/80 mb-2">
                Selected Songs ({selectedSongs.length})
              </h4>

              {selectedSongs.length === 0 ? (
                <div className="p-4 bg-white/5 rounded-lg text-center">
                  <p className="text-sm text-white/70">Search and add songs to your playlist</p>
                </div>
              ) : (
                <div className="space-y-1 max-h-60 overflow-y-auto p-2 bg-white/5 rounded-xl">
                  {selectedSongs.map((song, index) => (
                    <div
                      key={song.id}
                      className="flex items-center justify-between p-2 hover:bg-white/10 rounded-lg transition-all group"
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className="w-6 h-6 rounded-full bg-[#309605]/20 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs text-[#309605] font-medium">{index + 1}</span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white truncate">{song.title}</p>
                          <p className="text-xs text-white/60 truncate">
                            {song.artistId ? (
                              <Link
                                to={`/user/${song.artistId}`}
                                className="hover:text-[#309605] hover:underline transition-colors"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {song.artist_name}
                              </Link>
                            ) : (
                              song.artist_name
                            )}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeSongFromSelection(song.id)}
                        className="w-8 h-8 rounded-full hover:bg-red-500/20 flex items-center justify-center transition-all opacity-0 group-hover:opacity-100"
                        aria-label="Remove song"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="p-4 bg-red-500/20 border border-red-500/30 rounded-xl">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-12 bg-white/10 hover:bg-white/20 border border-white/20 rounded-xl font-medium text-white transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !formData.title.trim()}
              className="flex-1 h-12 bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed rounded-xl font-medium text-black transition-all shadow-lg"
            >
              {isSubmitting ? 'Creating...' : 'Create Playlist'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
