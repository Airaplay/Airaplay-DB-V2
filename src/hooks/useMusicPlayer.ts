import { useState, useRef, useCallback, useEffect } from 'react';
import { recordPlayback } from '../lib/playbackTracker';
import { supabase } from '../lib/supabase';
import { loadPlaybackState, getSongsFromIds } from '../lib/playbackState';
import { getSmartAutoplayRecommendation } from '../lib/smartAutoplayService';
import { getNextSongFromHistory } from '../lib/recentlyPlayedService';
import { getTrendingFallbackSong } from '../lib/trendingFallbackService';
import { generateContextKey, loadContextSettings, saveContextSettings } from '../lib/contextSettings';
import { trackListeningEngagement } from '../lib/contributionService';
import { useNetworkQuality } from './useNetworkQuality';
import { getAudioOptimizationSettings, shouldPreloadNextSong } from '../lib/audioOptimizationService';

interface Song {
  id: string;
  title: string;
  artist: string;
  artistId?: string | null;
  coverImageUrl?: string | null;
  audioUrl?: string | null;
  duration?: number;
  playCount?: number;
  featuredArtists?: string[] | null;
}

interface MusicPlayerState {
  currentSong: Song | null;
  playlist: Song[];
  currentIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  audioElement: HTMLAudioElement | null;
  nextAudioElement: HTMLAudioElement | null;
  isFullPlayerVisible: boolean;
  isMiniPlayerVisible: boolean;
  error: string | null;
  playlistContext: string;
  albumId: string | null;
  playlistId: string | null;
  isShuffleEnabled: boolean;
  repeatMode: 'off' | 'one' | 'all';
  shuffledPlaylist: Song[];
}


const isDiscoveryContext = (context?: string): boolean => {
  if (!context) return true;

  // Explicitly check for non-discovery contexts first
  // These are curated collections that should NOT use Smart Autoplay
  if (context.startsWith('playlist-') ||
      context.startsWith('album-') ||
      context.startsWith('mix-') ||
      context.startsWith('profile-') ||
      context === 'Album' ||
      context === 'Playlist') {
    return false;
  }

  const discoveryContexts = [
    'Global Trending',
    'Trending Near You',
    'New Releases',
    'Trending Albums',
    'AI Recommended',
    'Inspired By You',
    'Explore',
    'unknown',
    'smart-autoplay'  // Smart Autoplay is a discovery context that should continue playing
  ];

  return discoveryContexts.includes(context);
};

export const useMusicPlayer = () => {
  // Get network quality for audio optimization
  const { isSlowNetwork, isMediumNetwork, isFastNetwork, saveData, effectiveType } = useNetworkQuality();
  const networkInfo = { isSlowNetwork, isMediumNetwork, isFastNetwork, saveData, effectiveType };
  const audioSettings = getAudioOptimizationSettings(networkInfo);

  const [state, setState] = useState<MusicPlayerState>({
    currentSong: null,
    playlist: [],
    currentIndex: 0,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    audioElement: null,
    nextAudioElement: null,
    isFullPlayerVisible: false,
    isMiniPlayerVisible: false,
    error: null,
    playlistContext: 'unknown',
    albumId: null,
    playlistId: null,
    isShuffleEnabled: false,
    repeatMode: 'off',
    shuffledPlaylist: [],
  });

  const playbackStartTimeRef = useRef<number | null>(null);
  const hasRecordedPlaybackRef = useRef(false);
  const audioCleanupRef = useRef<(() => void) | null>(null);
  const nextAudioCleanupRef = useRef<(() => void) | null>(null);
  const lastSaveTimeRef = useRef<number>(0);
  const playNextSongRef = useRef<(() => void) | null>(null);
  const stateRef = useRef<MusicPlayerState>(state);
  const currentContextKeyRef = useRef<string>('');
  const hasTrackedSongStartRef = useRef(false);
  const hasTrackedSongCompleteRef = useRef(false);
  const currentSongGenreRef = useRef<string | null>(null);
  const currentSongArtistPlaysRef = useRef<number | null>(null);

  // Keep stateRef in sync with state
  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  // Cleanup effect for when the hook unmounts
  useEffect(() => {
    return () => {
      // Clean up any active audio element when the hook unmounts
      if (audioCleanupRef.current) {
        audioCleanupRef.current();
        audioCleanupRef.current = null;
      }
      if (nextAudioCleanupRef.current) {
        nextAudioCleanupRef.current();
        nextAudioCleanupRef.current = null;
      }
    };
  }, []);

  // Auto-save playback state
  useEffect(() => {
    const saveInterval = setInterval(() => {
      if (state.currentSong && state.isPlaying) {
        savePlaybackState();
      }
    }, 10000); // Save every 10 seconds

    return () => clearInterval(saveInterval);
  }, [state.currentSong, state.currentTime, state.isPlaying, state.currentIndex, state.playlist]);

  // Removed redundant useEffect that was causing performance issues
  // shuffledPlaylist is now updated directly in playSong() and toggleShuffle()

  // Load context-specific settings when context changes
  useEffect(() => {
    const loadSettings = async () => {
      const contextKey = generateContextKey(state.playlistContext, state.albumId);
      console.log('[useMusicPlayer] Context detected:', state.playlistContext, 'albumId:', state.albumId, 'key:', contextKey);

      if (contextKey !== currentContextKeyRef.current) {
        console.log('[useMusicPlayer] Context changed from', currentContextKeyRef.current, 'to', contextKey);
        currentContextKeyRef.current = contextKey;

        const settings = await loadContextSettings(contextKey);
        console.log('[useMusicPlayer] Loaded settings for', contextKey, ':', settings);

        setState(prev => ({
          ...prev,
          isShuffleEnabled: settings.shuffle_enabled,
          repeatMode: settings.repeat_mode,
          shuffledPlaylist: settings.shuffle_enabled && prev.playlist.length > 1
            ? [...prev.playlist].sort(() => Math.random() - 0.5)
            : [...prev.playlist],
        }));
      }
    };

    if (state.playlistContext && state.currentSong) {
      loadSettings();
    }
  }, [state.playlistContext, state.albumId, state.currentSong]);

  // Preloading next song is disabled to save bandwidth and CDN costs
  // Audio loads on-demand when playback starts

  const createAudioElement = useCallback((song: Song): { audio: HTMLAudioElement; cleanup: () => void } | null => {
    if (!song.audioUrl) {
      console.error('Cannot create audio element: song.audioUrl is missing', song);
      return null;
    }

    // Validate URL format before creating audio element
    // Allow https:// URLs and blob: URLs (for offline playback)
    const isValidUrl = song.audioUrl.startsWith('https://') || song.audioUrl.startsWith('blob:');
    if (!isValidUrl) {
      console.error('Invalid audio URL: must start with https:// or blob:', song.audioUrl);
      setState(prev => ({ ...prev, error: 'Invalid audio URL format. Please re-upload this song.' }));
      return null;
    }

    // Check if URL is malformed (missing CDN domain) - only for https URLs, not blob URLs
    if (song.audioUrl.startsWith('https://') && song.audioUrl.includes('https://airaplay/')) {
      console.error('Malformed audio URL detected: missing .b-cdn.net domain', song.audioUrl);
      setState(prev => ({ ...prev, error: 'Audio file URL is malformed. Please re-upload this song.' }));
      return null;
    }

    console.log('Creating audio element for song:', {
      id: song.id,
      title: song.title,
      audioUrl: song.audioUrl
    });

    const audio = new Audio();
    audio.src = song.audioUrl;

    // Network-aware preload setting to balance bandwidth and UX
    // Slow networks: 'none' (no preload) | Medium: 'metadata' only | Fast: 'metadata'
    audio.preload = audioSettings.preload;

    console.log(`Audio preload set to '${audioSettings.preload}' (network: ${effectiveType}, bitrate: ${audioSettings.recommendedBitrate})`);

    // Only set crossOrigin if the URL is from a different origin
    // Blob URLs don't need CORS handling as they're always same-origin
    if (!song.audioUrl.startsWith('blob:')) {
      const audioUrl = new URL(song.audioUrl, window.location.href);
      const isCrossOrigin = audioUrl.origin !== window.location.origin;

      if (isCrossOrigin) {
        audio.crossOrigin = 'anonymous';
        console.log('Audio is cross-origin, CORS enabled for:', audioUrl.origin);
      }
    }

    // Create event handler functions so we can remove them later
    const handleLoadedMetadata = () => {
      setState(prev => ({ ...prev, duration: audio.duration }));
    };

    const handleTimeUpdate = () => {
      setState(prev => ({ ...prev, currentTime: audio.currentTime }));
    };

    const handlePlay = async () => {
      setState(prev => ({ ...prev, isPlaying: true, error: null }));
      playbackStartTimeRef.current = Date.now();
      hasRecordedPlaybackRef.current = false;
      hasTrackedSongCompleteRef.current = false;

      // Track song start for contribution rewards (only once per song)
      if (!hasTrackedSongStartRef.current) {
        hasTrackedSongStartRef.current = true;

        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            // Fetch song details for genre and artist total plays
            const { data: songData } = await supabase
              .from('songs')
              .select('genre, artist_id')
              .eq('id', song.id)
              .single();

            if (songData) {
              currentSongGenreRef.current = songData.genre || null;

              // Get artist total plays if artist_id exists
              if (songData.artist_id) {
                const { count } = await supabase
                  .from('playback_history')
                  .select('*', { count: 'exact', head: true })
                  .eq('artist_id', songData.artist_id);

                currentSongArtistPlaysRef.current = count || null;
              }

              // Track song started
              await trackListeningEngagement(
                user.id,
                song.id,
                false,
                currentSongGenreRef.current || undefined,
                currentSongArtistPlaysRef.current || undefined
              );
            }
          }
        } catch (error) {
          console.error('Error tracking song start:', error);
        }
      }
    };

    const handleCanPlay = () => {
      setState(prev => ({ ...prev, error: null }));
    };

    const handlePause = async () => {
      setState(prev => ({ ...prev, isPlaying: false }));
      // Record playback when paused
      if (playbackStartTimeRef.current && !hasRecordedPlaybackRef.current) {
        const durationListened = Math.floor((Date.now() - playbackStartTimeRef.current) / 1000);
        recordPlayback(song.id, durationListened, false);
        hasRecordedPlaybackRef.current = true;
      }

      // Track song completion for contribution rewards (if 80%+ listened)
      if (!hasTrackedSongCompleteRef.current && audio.duration > 0) {
        const completionPercentage = (audio.currentTime / audio.duration) * 100;

        if (completionPercentage >= 80) {
          hasTrackedSongCompleteRef.current = true;

          try {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
              await trackListeningEngagement(
                user.id,
                song.id,
                true,
                currentSongGenreRef.current || undefined,
                currentSongArtistPlaysRef.current || undefined
              );
            }
          } catch (error) {
            console.error('Error tracking song completion on pause:', error);
          }
        }
      }
    };

    const handleEnded = async () => {
      // Record playback when song ends
      if (playbackStartTimeRef.current && !hasRecordedPlaybackRef.current) {
        const durationListened = Math.floor((Date.now() - playbackStartTimeRef.current) / 1000);
        recordPlayback(song.id, durationListened, false);
        hasRecordedPlaybackRef.current = true;
      }

      // Track song completion for contribution rewards (song ended = 100% completion)
      if (!hasTrackedSongCompleteRef.current) {
        hasTrackedSongCompleteRef.current = true;

        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            await trackListeningEngagement(
              user.id,
              song.id,
              true,
              currentSongGenreRef.current || undefined,
              currentSongArtistPlaysRef.current || undefined
            );
          }
        } catch (error) {
          console.error('Error tracking song completion on end:', error);
        }
      }

      setState(prev => ({ ...prev, isPlaying: false }));

      // Use stateRef to get current state, not stale closure state
      const currentState = stateRef.current;

      console.log('[useMusicPlayer] Song ended. Context:', currentState.playlistContext, 'Playlist length:', currentState.playlist.length, 'Current index:', currentState.currentIndex, 'Repeat:', currentState.repeatMode);

      // Handle repeat one mode
      if (currentState.repeatMode === 'one') {
        console.log('[useMusicPlayer] Repeat mode is "one" - replaying current song');
        if (currentState.audioElement) {
          currentState.audioElement.currentTime = 0;
          currentState.audioElement.play().catch(err => {
            if (err.name !== 'AbortError') {
              console.error('Error replaying audio:', err);
            }
          });
        }
        return;
      }

      const getCurrentPlaylist = () => {
        return currentState.isShuffleEnabled ? currentState.shuffledPlaylist : currentState.playlist;
      };

      const currentPlaylist = getCurrentPlaylist();
      const isAtEndOfPlaylist = currentPlaylist.length > 0 && currentState.currentIndex >= currentPlaylist.length - 1;
      const isDiscovery = isDiscoveryContext(currentState.playlistContext);

      console.log('[handleEnded] Playlist status:', {
        playlistLength: currentPlaylist.length,
        currentIndex: currentState.currentIndex,
        isAtEnd: isAtEndOfPlaylist,
        isDiscovery,
        context: currentState.playlistContext,
        shuffleEnabled: currentState.isShuffleEnabled,
        repeatMode: currentState.repeatMode
      });

      // Handle repeat all mode - restart playlist from beginning
      if (currentState.repeatMode === 'all' && currentPlaylist.length > 0) {
        console.log('[handleEnded] Repeat mode is "all" - restarting playlist');
        playNextSongRef.current?.();
        return;
      }

      // PRIORITY: If there are more songs in the playlist, play next (regardless of context type)
      if (currentPlaylist.length > 0 && !isAtEndOfPlaylist) {
        console.log('[handleEnded] More songs in playlist - playing next track');
        console.log('[handleEnded] playNextSongRef.current exists?', !!playNextSongRef.current);
        console.log('[handleEnded] About to call playNextSongRef.current()');
        if (playNextSongRef.current) {
          playNextSongRef.current();
          console.log('[handleEnded] Successfully called playNextSongRef.current()');
        } else {
          console.error('[handleEnded] playNextSongRef.current is NULL!');
        }
        return;
      }

      // At end of playlist - behavior depends on context
      if (isAtEndOfPlaylist && currentPlaylist.length > 0) {
        // Check for creator profile context - transition from singles to albums
        if (currentState.playlistContext.startsWith('profile-') && currentState.playlistContext.endsWith('-singles')) {
          console.log('[handleEnded] End of creator singles - checking for albums');

          const userId = currentState.playlistContext.replace('profile-', '').replace('-singles', '');

          try {
            const { getCreatorAlbumTracks } = await import('../lib/creatorPlaybackHelper');
            const { tracks: albumTracks } = await getCreatorAlbumTracks(userId);

            if (albumTracks.length > 0) {
              console.log('[handleEnded] Found', albumTracks.length, 'album tracks - transitioning to albums');

              const firstAlbumTrack = albumTracks[0];
              const albumContext = `profile-${userId}-albums`;

              // Update state with album playlist
              setState(prev => ({
                ...prev,
                currentSong: firstAlbumTrack,
                playlist: albumTracks,
                currentIndex: 0,
                playlistContext: albumContext,
                isPlaying: false,
                shuffledPlaylist: prev.isShuffleEnabled && albumTracks.length > 1
                  ? [...albumTracks].sort(() => Math.random() - 0.5)
                  : [...albumTracks],
              }));

              // Create new audio element for the first album track
              const result = createAudioElement(firstAlbumTrack);
              if (result) {
                const { audio, cleanup } = result;

                if (audioCleanupRef.current) {
                  audioCleanupRef.current();
                }
                audioCleanupRef.current = cleanup;

                setState(prev => ({ ...prev, audioElement: audio }));

                audio.play().catch(err => {
                  if (err.name !== 'AbortError') {
                    console.error('[handleEnded] Error playing first album track:', err);
                  }
                });
              }

              return;
            } else {
              console.log('[handleEnded] No albums found - stopping playback');
              // No more content from this creator, stop playback
              return;
            }
          } catch (error) {
            console.error('[handleEnded] Error fetching album tracks:', error);
            // On error, stop playback
            return;
          }
        }
        // Check for creator profile albums context - all content has been played, stop playback
        else if (currentState.playlistContext.startsWith('profile-') && currentState.playlistContext.endsWith('-albums')) {
          console.log('[handleEnded] End of creator albums - all creator content has been played. Stopping playback');
          // All creator content exhausted, stop playback
          return;
        }
        // For non-discovery contexts (albums, playlists), ALWAYS stop playback - never use Smart Autoplay
        else if (!isDiscovery) {
          console.log('[handleEnded] End of curated collection (Album/Playlist) - stopping playback. Context:', currentState.playlistContext);
          return;
        }
        // For discovery contexts, enable smart autoplay only if repeat is off
        else if (currentState.repeatMode !== 'off') {
          console.log('[handleEnded] Repeat mode is active - stopping instead of Smart Autoplay');
          return;
        } else {
          console.log('[handleEnded] Reached end of discovery playlist - enabling Smart Autoplay');
          // Fall through to Smart Autoplay logic below
        }
      } else if (currentPlaylist.length === 0) {
        console.warn('[handleEnded] Playlist is empty - should not happen!');
        return;
      } else {
        console.log('[handleEnded] Unexpected state - stopping playback');
        return;
      }

      // Smart Autoplay logic (only reached for discovery contexts at end of playlist with repeat off)
      let nextSong: Song | null = null;

      console.log('[useMusicPlayer] Searching for next song...');
      nextSong = await getSmartAutoplayRecommendation(
        song, 
        currentState.playlistContext, 
        currentState.albumId,
        currentPlaylist // Pass current playlist for duplicate checking
      );

      if (nextSong) {
        console.log('[useMusicPlayer] Found similar song:', nextSong.title, 'by', nextSong.artist);
      } else {
        console.log('[useMusicPlayer] No similar songs found, trying recently played history');
        nextSong = await getNextSongFromHistory(song);
        // Validate fallback recommendation
        if (nextSong) {
          const isDuplicate = currentPlaylist.some(s => s.id === nextSong!.id);
          const isCurrentSong = nextSong.id === song.id;
          if (isDuplicate || isCurrentSong) {
            console.warn('[useMusicPlayer] History fallback is duplicate, trying trending');
            nextSong = null;
          }
        }
      }

      if (nextSong) {
        console.log('[useMusicPlayer] Found from history:', nextSong.title, 'by', nextSong.artist);
      } else {
        console.log('[useMusicPlayer] No recently played songs, trying trending fallback');
        const { data: { user } } = await supabase.auth.getUser();
        const userCountry = user?.user_metadata?.country || 'NG';
        nextSong = await getTrendingFallbackSong(userCountry);
        // Validate trending fallback recommendation
        if (nextSong) {
          const isDuplicate = currentPlaylist.some(s => s.id === nextSong!.id);
          const isCurrentSong = nextSong.id === song.id;
          if (isDuplicate || isCurrentSong) {
            console.warn('[useMusicPlayer] Trending fallback is duplicate, stopping');
            nextSong = null;
          }
        }
      }

      if (nextSong) {
        // Final validation before appending to playlist
        const isDuplicate = currentPlaylist.some(s => s.id === nextSong!.id);
        const isCurrentSong = nextSong.id === song.id;

        if (isDuplicate || isCurrentSong) {
          console.warn('[useMusicPlayer] Duplicate detected, skipping recommendation:', {
            isDuplicate,
            isCurrentSong,
            songTitle: nextSong.title,
            songId: nextSong.id
          });
          console.log('[useMusicPlayer] No valid recommendation found - stopping playback');
          return;
        }

        console.log('[useMusicPlayer] Transitioning to:', nextSong.title, 'by', nextSong.artist);

        // Append the recommended song to the playlist for continuous discovery
        // Limit playlist to last 30 songs to prevent accumulation and improve performance
        setState(prev => {
          const updatedPlaylist = [...prev.playlist, nextSong];
          // Keep only last 30 songs to prevent playlist from growing indefinitely
          const limitedPlaylist = updatedPlaylist.slice(-30);
          const newIndex = limitedPlaylist.length - 1;
          const newContext = prev.playlistContext || 'smart-autoplay';

          console.log('[useMusicPlayer] Appending to playlist. New length:', limitedPlaylist.length, 'New index:', newIndex, 'Context:', newContext);

          return {
            ...prev,
            currentSong: nextSong,
            currentIndex: newIndex,
            playlist: limitedPlaylist,
            playlistContext: newContext,
            isPlaying: false,
            // Update shuffled playlist if shuffle is enabled (also limit to 30)
            shuffledPlaylist: prev.isShuffleEnabled
              ? [...prev.shuffledPlaylist, nextSong].slice(-30)
              : limitedPlaylist
          };
        });

        // Create new audio element for the recommended song
        const result = createAudioElement(nextSong);
        if (result) {
          const { audio, cleanup } = result;

          if (audioCleanupRef.current) {
            audioCleanupRef.current();
          }
          audioCleanupRef.current = cleanup;

          setState(prev => ({ ...prev, audioElement: audio }));

          audio.play().catch(err => {
            if (err.name !== 'AbortError') {
              console.error('[useMusicPlayer] Error playing smart autoplay song:', err);
            }
          });
        }
      } else {
        console.log('[useMusicPlayer] No songs available for autoplay - stopping playback');
      }
    };

    const handleError = (e: Event) => {
      const target = e.target as HTMLAudioElement;
      const mediaError = target.error;
      let errorMessage = 'Failed to load audio';
      const isOfflineSong = song.audioUrl?.startsWith('blob:');

      if (mediaError) {
        switch (mediaError.code) {
          case MediaError.MEDIA_ERR_ABORTED:
            errorMessage = 'Audio loading was aborted';
            break;
          case MediaError.MEDIA_ERR_NETWORK:
            errorMessage = isOfflineSong
              ? 'Failed to play offline audio. The download may be corrupted.'
              : 'Network error while loading audio';
            break;
          case MediaError.MEDIA_ERR_DECODE:
            errorMessage = isOfflineSong
              ? 'Offline audio file is corrupted. Please re-download.'
              : 'Audio file is corrupted or unsupported';
            break;
          case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            errorMessage = isOfflineSong
              ? 'Offline audio file is not supported. Please re-download.'
              : 'Audio format not supported or CORS blocked';
            break;
          default:
            errorMessage = isOfflineSong
              ? 'Failed to play offline audio. Please try re-downloading.'
              : 'Unknown audio error occurred';
        }
      }

      console.error('Audio playback error:', {
        message: errorMessage,
        mediaErrorCode: mediaError?.code,
        mediaErrorMessage: mediaError?.message,
        audioUrl: song.audioUrl,
        songId: song.id,
        songTitle: song.title,
        audioSrc: target.src,
        networkState: target.networkState,
        readyState: target.readyState,
        isOfflineSong,
        blobUrlValid: isOfflineSong && song.audioUrl ? song.audioUrl.startsWith('blob:') : null
      });

      // Test if URL is accessible (only for non-blob URLs)
      if (!isOfflineSong && song.audioUrl) {
        fetch(song.audioUrl, { method: 'HEAD', mode: 'no-cors' })
          .then(() => console.log('✅ Audio URL is accessible (no-cors check passed)'))
          .catch(err => console.error('❌ Audio URL fetch failed:', err));
      } else if (isOfflineSong) {
        console.log('🔍 Offline song error - blob URL:', song.audioUrl);
        console.log('💡 If the blob URL is invalid, try refreshing the download from IndexedDB');
      }

      setState(prev => ({ ...prev, isPlaying: false, error: errorMessage }));
    };

    // Add event listeners
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);

    // Create cleanup function
    const cleanup = () => {
      try {
        // Record playback before cleanup if needed
        if (playbackStartTimeRef.current && !hasRecordedPlaybackRef.current) {
          const durationListened = Math.floor((Date.now() - playbackStartTimeRef.current) / 1000);
          recordPlayback(song.id, durationListened, false);
          hasRecordedPlaybackRef.current = true;
        }

        // Pause the audio first
        audio.pause();
        
        // Clear the source to stop any ongoing loading
        audio.src = '';
        audio.load(); // This will abort any ongoing network requests
        
        // Remove all event listeners
        audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
        audio.removeEventListener('timeupdate', handleTimeUpdate);
        audio.removeEventListener('canplay', handleCanPlay);
        audio.removeEventListener('play', handlePlay);
        audio.removeEventListener('pause', handlePause);
        audio.removeEventListener('ended', handleEnded);
        audio.removeEventListener('error', handleError);
      } catch (cleanupError) {
        console.warn('Error during audio cleanup:', cleanupError);
      }
    };

    return { audio, cleanup };
  }, []);

  // Update playNext ref to always use the latest state
  useEffect(() => {
    playNextSongRef.current = () => {
      const getCurrentPlaylist = () => {
        return state.isShuffleEnabled ? state.shuffledPlaylist : state.playlist;
      };

      const currentPlaylist = getCurrentPlaylist();
      if (currentPlaylist.length === 0) return;

      let nextIndex: number;
      let nextSongInOriginalPlaylist: number;

      if (state.isShuffleEnabled) {
        const currentShuffledIndex = state.shuffledPlaylist.findIndex(s => s.id === state.currentSong?.id);
        if (currentShuffledIndex === state.shuffledPlaylist.length - 1) {
          if (state.repeatMode === 'all') {
            nextIndex = 0;
          } else {
            return; // End of playlist
          }
        } else {
          nextIndex = currentShuffledIndex + 1;
        }

        // Find the next song's index in the original playlist for proper tracking
        const nextSongId = state.shuffledPlaylist[nextIndex]?.id;
        nextSongInOriginalPlaylist = state.playlist.findIndex(s => s.id === nextSongId);
      } else {
        if (state.currentIndex === currentPlaylist.length - 1) {
          if (state.repeatMode === 'all') {
            nextIndex = 0;
          } else {
            return; // End of playlist
          }
        } else {
          nextIndex = state.currentIndex + 1;
        }
        nextSongInOriginalPlaylist = nextIndex;
      }

      const nextSong = currentPlaylist[nextIndex];
      if (nextSong) {
        // Cleanup current audio
        if (audioCleanupRef.current) {
          audioCleanupRef.current();
          audioCleanupRef.current = null;
        }

        // Create new audio element
        const audioResult = createAudioElement(nextSong);
        if (!audioResult) return;

        const { audio: newAudio, cleanup } = audioResult;
        audioCleanupRef.current = cleanup;

        setState(prev => ({
          ...prev,
          currentSong: nextSong,
          currentIndex: nextSongInOriginalPlaylist >= 0 ? nextSongInOriginalPlaylist : nextIndex,
          audioElement: newAudio,
          currentTime: 0,
          duration: 0,
          error: null,
        }));

        // Start playback
        newAudio.play().catch(err => {
          if (err.name !== 'AbortError') {
            console.error('Error playing audio:', err);
          }
        });
      }
    };
  }, [state, createAudioElement]);

  const savePlaybackState = useCallback(async () => {
    const now = Date.now();
    if (now - lastSaveTimeRef.current < 5000) return; // Throttle saves
    lastSaveTimeRef.current = now;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user || !state.currentSong) return;

      const { error } = await supabase
        .from('user_playback_state')
        .upsert({
          user_id: session.user.id,
          song_id: state.currentSong.id,
          playback_position: Math.floor(state.currentTime),
          playlist: state.playlist.map(s => s.id),
          current_index: state.currentIndex,
          playlist_context: state.playlistContext,
          is_shuffle_enabled: state.isShuffleEnabled,
          repeat_mode: state.repeatMode,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (error) {
        console.warn('Failed to save playback state:', error);
      }
    } catch (error) {
      console.warn('Error saving playback state:', error);
    }
  }, [state.currentSong, state.currentTime, state.currentIndex, state.playlist, state.playlistContext, state.isShuffleEnabled, state.repeatMode]);

  // Smart preloading: Only preload next song on fast networks
  const preloadNextSong = useCallback(() => {
    // Only preload if network conditions allow
    if (!audioSettings.shouldPreloadNext) {
      return;
    }

    const currentPlaylist = state.isShuffleEnabled ? state.shuffledPlaylist : state.playlist;
    if (currentPlaylist.length === 0) return;

    // Calculate next song index
    let nextIndex: number;
    if (state.isShuffleEnabled) {
      const currentShuffledIndex = state.shuffledPlaylist.findIndex(s => s.id === state.currentSong?.id);
      if (currentShuffledIndex === state.shuffledPlaylist.length - 1) {
        if (state.repeatMode === 'all') {
          nextIndex = 0;
        } else {
          return; // No next song
        }
      } else {
        nextIndex = currentShuffledIndex + 1;
      }
    } else {
      if (state.currentIndex === currentPlaylist.length - 1) {
        if (state.repeatMode === 'all') {
          nextIndex = 0;
        } else {
          return; // No next song
        }
      } else {
        nextIndex = state.currentIndex + 1;
      }
    }

    const nextSong = currentPlaylist[nextIndex];
    if (!nextSong || !nextSong.audioUrl) return;

    // Check if we should preload based on current playback progress
    const currentProgress = state.duration > 0 ? state.currentTime / state.duration : 0;
    const hasNextSong = !!nextSong;

    if (shouldPreloadNextSong(networkInfo, currentProgress, hasNextSong)) {
      // Only create next audio element if it doesn't exist yet
      if (!state.nextAudioElement || state.nextAudioElement.src !== nextSong.audioUrl) {
        console.log('Smart preloading next song:', nextSong.title, '(fast network + >50% progress)');

        // Cleanup existing next audio if any
        if (nextAudioCleanupRef.current) {
          nextAudioCleanupRef.current();
          nextAudioCleanupRef.current = null;
        }

        const nextAudio = new Audio();
        nextAudio.src = nextSong.audioUrl;
        nextAudio.preload = 'metadata'; // Only preload metadata

        if (!nextSong.audioUrl.startsWith('blob:')) {
          nextAudio.crossOrigin = 'anonymous';
        }

        // Store cleanup function
        nextAudioCleanupRef.current = () => {
          nextAudio.pause();
          nextAudio.src = '';
          nextAudio.load();
        };

        setState(prev => ({ ...prev, nextAudioElement: nextAudio }));
      }
    }
  }, [state, audioSettings, networkInfo]);

  // Monitor playback progress to trigger smart preloading
  useEffect(() => {
    if (state.isPlaying && state.currentSong && audioSettings.shouldPreloadNext) {
      preloadNextSong();
    }
  }, [state.currentTime, state.isPlaying, state.currentSong, audioSettings.shouldPreloadNext, preloadNextSong]);


  const playNext = useCallback(() => {
    const getCurrentPlaylist = () => {
      return state.isShuffleEnabled ? state.shuffledPlaylist : state.playlist;
    };

    const currentPlaylist = getCurrentPlaylist();

    console.log('[playNext] Playlist status:', {
      playlistLength: currentPlaylist.length,
      shuffledPlaylistLength: state.shuffledPlaylist.length,
      currentIndex: state.currentIndex,
      shuffleEnabled: state.isShuffleEnabled,
      repeatMode: state.repeatMode,
      context: state.playlistContext,
      currentSong: state.currentSong?.title
    });

    if (currentPlaylist.length === 0) {
      console.warn('[playNext] Cannot play next - playlist is empty');
      return;
    }

    let nextIndex: number;
    if (state.isShuffleEnabled) {
      const currentShuffledIndex = state.shuffledPlaylist.findIndex(s => s.id === state.currentSong?.id);
      if (currentShuffledIndex === state.shuffledPlaylist.length - 1) {
        if (state.repeatMode === 'all') {
          nextIndex = 0;
        } else {
          console.log('[playNext] End of shuffled playlist reached');
          return;
        }
      } else {
        nextIndex = currentShuffledIndex + 1;
      }
    } else {
      if (state.currentIndex === currentPlaylist.length - 1) {
        if (state.repeatMode === 'all') {
          nextIndex = 0;
        } else {
          console.log('[playNext] End of playlist reached');
          return;
        }
      } else {
        nextIndex = state.currentIndex + 1;
      }
    }

    const nextSong = currentPlaylist[nextIndex];
    if (nextSong) {
      console.log('[playNext] Playing next song:', nextSong.title, 'at index:', nextIndex);
      // Cleanup current audio
      if (audioCleanupRef.current) {
        audioCleanupRef.current();
        audioCleanupRef.current = null;
      }

      // Create new audio element
      const audioResult = createAudioElement(nextSong);
      if (!audioResult) return;

      const { audio: newAudio, cleanup } = audioResult;
      audioCleanupRef.current = cleanup;

      setState(prev => ({
        ...prev,
        currentSong: nextSong,
        currentIndex: state.isShuffleEnabled ? prev.currentIndex : nextIndex,
        audioElement: newAudio,
        currentTime: 0,
        duration: 0,
        error: null,
      }));

      // Start playback
      newAudio.play().catch(err => {
        if (err.name !== 'AbortError') {
          console.error('Error playing audio:', err);
        }
      });
    } else {
      console.error('[playNext] Next song not found at index:', nextIndex);
    }
  }, [state.currentIndex, state.playlist, state.currentSong, state.isShuffleEnabled, state.shuffledPlaylist, state.repeatMode, state.playlistContext, createAudioElement]);

  const playPrevious = useCallback(() => {
    // If current song has been playing for more than 5 seconds, restart it
    if (state.currentTime > 5 && state.audioElement) {
      state.audioElement.currentTime = 0;
      setState(prev => ({ ...prev, currentTime: 0 }));
      return;
    }

    const getCurrentPlaylist = () => {
      return state.isShuffleEnabled ? state.shuffledPlaylist : state.playlist;
    };

    const currentPlaylist = getCurrentPlaylist();
    if (currentPlaylist.length === 0) return;

    let previousIndex: number;
    if (state.isShuffleEnabled) {
      const currentShuffledIndex = state.shuffledPlaylist.findIndex(s => s.id === state.currentSong?.id);
      previousIndex = currentShuffledIndex > 0 ? currentShuffledIndex - 1 : state.shuffledPlaylist.length - 1;
    } else {
      previousIndex = state.currentIndex > 0 ? state.currentIndex - 1 : currentPlaylist.length - 1;
    }

    const previousSong = currentPlaylist[previousIndex];
    if (previousSong) {
      changeSong(previousSong, state.isShuffleEnabled ? undefined : previousIndex);
    }
  }, [state.currentTime, state.currentIndex, state.playlist, state.audioElement, state.currentSong, state.isShuffleEnabled, state.shuffledPlaylist]);

  const toggleShuffle = useCallback(() => {
    setState(prev => {
      const newShuffleState = !prev.isShuffleEnabled;
      const newShuffledPlaylist = newShuffleState && prev.playlist.length > 1
        ? [...prev.playlist].sort(() => Math.random() - 0.5)
        : [...prev.playlist];

      const contextKey = currentContextKeyRef.current || generateContextKey(prev.playlistContext, prev.albumId);
      if (contextKey) {
        console.log('[toggleShuffle] Saving settings for context:', contextKey, 'shuffle:', newShuffleState);
        saveContextSettings(contextKey, {
          shuffle_enabled: newShuffleState,
          repeat_mode: prev.repeatMode
        });
      } else {
        console.warn('[toggleShuffle] No context key available');
      }

      return {
        ...prev,
        isShuffleEnabled: newShuffleState,
        shuffledPlaylist: newShuffledPlaylist
      };
    });
  }, []);

  const toggleRepeat = useCallback(() => {
    setState(prev => {
      const modes: ('off' | 'one' | 'all')[] = ['off', 'one', 'all'];
      const currentModeIndex = modes.indexOf(prev.repeatMode);
      const nextMode = modes[(currentModeIndex + 1) % modes.length];

      const contextKey = currentContextKeyRef.current || generateContextKey(prev.playlistContext, prev.albumId);
      if (contextKey) {
        console.log('[toggleRepeat] Saving settings for context:', contextKey, 'repeat:', nextMode);
        saveContextSettings(contextKey, {
          shuffle_enabled: prev.isShuffleEnabled,
          repeat_mode: nextMode
        });
      } else {
        console.warn('[toggleRepeat] No context key available');
      }

      return { ...prev, repeatMode: nextMode };
    });
  }, []);

  const restorePlaybackState = useCallback(async () => {
    try {
      const savedState = await loadPlaybackState();
      if (!savedState || !savedState.songId) return false;

      const songs = await getSongsFromIds([savedState.songId, ...savedState.playlist]);
      if (songs.length === 0) return false;

      const currentSong = songs.find(s => s.id === savedState.songId);
      if (!currentSong) return false;

      const playlist = savedState.playlist.length > 0
        ? await getSongsFromIds(savedState.playlist)
        : songs;

      // Create audio element
      const audioResult = createAudioElement(currentSong);
      if (!audioResult) return false;

      const { audio: newAudio, cleanup } = audioResult;
      audioCleanupRef.current = cleanup;

      // Set the playback position
      newAudio.currentTime = savedState.playbackPosition;

      // Update state with restored data
      setState(prev => ({
        ...prev,
        currentSong,
        playlist,
        currentIndex: savedState.currentIndex,
        audioElement: newAudio,
        isMiniPlayerVisible: true,
        isFullPlayerVisible: false,
        currentTime: savedState.playbackPosition,
        playlistContext: savedState.playlistContext,
        isShuffleEnabled: savedState.isShuffleEnabled,
        repeatMode: savedState.repeatMode,
      }));

      return true;
    } catch (error) {
      console.error('Error restoring playback state:', error);
      return false;
    }
  }, [createAudioElement]);

  const showMiniPlayer = useCallback((song: Song, playlist: Song[] = [], context: string = 'unknown', playlistId: string | null = null) => {
    // This is the primary entry point for all music playback in the app
    // Clean up current audio if it exists
    if (audioCleanupRef.current) {
      audioCleanupRef.current();
      audioCleanupRef.current = null;
    }

    // Create new audio element
    const audioResult = createAudioElement(song);
    if (!audioResult) return;

    const { audio: newAudio, cleanup } = audioResult;

    // Store the cleanup function for later use
    audioCleanupRef.current = cleanup;

    setState(prev => ({
      ...prev,
      currentSong: song,
      playlist,
      currentIndex: playlist.findIndex(s => s.id === song.id) !== -1 ? playlist.findIndex(s => s.id === song.id) : 0,
      audioElement: newAudio,
      isMiniPlayerVisible: true,
      isFullPlayerVisible: false,
      currentTime: 0,
      duration: 0,
      error: null,
      playlistContext: context,
      playlistId,
    }));

    // Start playback
    newAudio.play().catch(err => {
      // Only log errors that aren't AbortError (play interrupted by pause)
      if (err.name !== 'AbortError') {
        console.error('Error playing audio:', err);
      }
    });
  }, [createAudioElement]);

  const hideMiniPlayer = useCallback(() => {
    // Clean up current audio if it exists
    if (audioCleanupRef.current) {
      audioCleanupRef.current();
      audioCleanupRef.current = null;
    }

    setState(prev => ({
      ...prev,
      currentSong: null,
      audioElement: null,
      isMiniPlayerVisible: false,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      error: null,
    }));
  }, []);

  const playSong = useCallback((song: Song, expandFullPlayer: boolean = true, playlist: Song[] = [], index: number = 0, context: string = 'unknown', albumId: string | null = null, playlistId: string | null = null) => {
    // Clean up current audio if it exists
    if (audioCleanupRef.current) {
      audioCleanupRef.current();
      audioCleanupRef.current = null;
    }

    // Reset contribution tracking refs for new song
    hasTrackedSongStartRef.current = false;
    hasTrackedSongCompleteRef.current = false;
    currentSongGenreRef.current = null;
    currentSongArtistPlaysRef.current = null;

    // Create new audio element
    const audioResult = createAudioElement(song);
    if (!audioResult) return;

    const { audio: newAudio, cleanup } = audioResult;

    // Store the cleanup function for later use
    audioCleanupRef.current = cleanup;

    console.log('[playSong] Setting player visibility - expandFullPlayer:', expandFullPlayer);

    setState(prev => ({
      ...prev,
      currentSong: song,
      playlist,
      currentIndex: index,
      audioElement: newAudio,
      isFullPlayerVisible: expandFullPlayer,
      // Always show mini player when a song is playing, unless full player is explicitly requested
      isMiniPlayerVisible: true,
      currentTime: 0,
      duration: 0,
      error: null,
      playlistContext: context,
      albumId,
      playlistId,
      // Update shuffledPlaylist immediately to match the new playlist
      shuffledPlaylist: prev.isShuffleEnabled && playlist.length > 1
        ? [...playlist].sort(() => Math.random() - 0.5)
        : [...playlist],
    }));

    // User-initiated click - load and play immediately
    // With preload='none', calling load() then play() will download and start playback
    newAudio.load(); // Start loading the media
    newAudio.play().catch(err => {
      // Only log errors that aren't AbortError (play interrupted by pause)
      if (err.name !== 'AbortError') {
        console.error('Error playing audio:', err);
        setState(prev => ({ ...prev, error: 'Failed to play audio. Please try again.' }));
      }
    });
  }, [createAudioElement]);

  const changeSong = useCallback((song: Song, index?: number) => {
    // Clean up current audio if it exists
    if (audioCleanupRef.current) {
      audioCleanupRef.current();
      audioCleanupRef.current = null;
    }

    // Create new audio element
    const audioResult = createAudioElement(song);
    if (!audioResult) return;

    const { audio: newAudio, cleanup } = audioResult;

    // Store the cleanup function for later use
    audioCleanupRef.current = cleanup;

    console.log('[changeSong] Changing to:', song.title, '- keeping mini player visible');

    setState(prev => ({
      ...prev,
      currentSong: song,
      currentIndex: index !== undefined ? index : prev.currentIndex,
      audioElement: newAudio,
      currentTime: 0,
      duration: 0,
      error: null,
      // Ensure mini player stays visible when changing songs
      isMiniPlayerVisible: true,
    }));

    // Start playback
    newAudio.play().catch(err => {
      // Only log errors that aren't AbortError (play interrupted by pause)
      if (err.name !== 'AbortError') {
        console.error('Error playing audio:', err);
      }
    });
  }, [createAudioElement]);

  const togglePlayPause = useCallback(() => {
    if (!state.audioElement) return;

    if (state.isPlaying) {
      state.audioElement.pause();
    } else {
      state.audioElement.play().catch(err => {
        // Only log errors that aren't AbortError (play interrupted by pause)
        if (err.name !== 'AbortError') {
          console.error('Error playing audio:', err);
        }
      });
    }
  }, [state.audioElement, state.isPlaying]);

  const expandFullPlayer = useCallback(() => {
    // When expanding to full player, preserve the current audio element and playback state
    // Don't create a new audio element - the full player will use the existing one
    console.log('[expandFullPlayer] Expanding to full player, keeping mini player visible');
    setState(prev => ({
      ...prev,
      isFullPlayerVisible: true,
      // Keep mini player visible - it will be hidden by route-based logic if needed
      isMiniPlayerVisible: true,
    }));
  }, []);

  const hideFullPlayer = useCallback(() => {
    console.log('[hideFullPlayer] Closing full player, showing mini player');
    setState(prev => ({
      ...prev,
      isFullPlayerVisible: false,
      // Always show mini player when closing full player if a song is playing
      isMiniPlayerVisible: prev.currentSong ? true : false,
    }));
  }, []);

  const hideAllPlayers = useCallback(() => {
    // Hide both players without stopping playback
    // Useful when a custom player UI (like AlbumPlayerScreen) is active
    setState(prev => ({
      ...prev,
      isFullPlayerVisible: false,
      isMiniPlayerVisible: false,
    }));
  }, []);

  const seekTo = useCallback((time: number) => {
    if (state.audioElement) {
      state.audioElement.currentTime = time;
      setState(prev => ({ ...prev, currentTime: time }));
    }
  }, [state.audioElement]);

  return {
    currentSong: state.currentSong,
    playlist: state.playlist,
    currentIndex: state.currentIndex,
    isPlaying: state.isPlaying,
    currentTime: state.currentTime,
    duration: state.duration,
    audioElement: state.audioElement,
    isFullPlayerVisible: state.isFullPlayerVisible,
    isMiniPlayerVisible: state.isMiniPlayerVisible,
    error: state.error,
    playlistContext: state.playlistContext,
    albumId: state.albumId,
    playlistId: state.playlistId,
    isShuffleEnabled: state.isShuffleEnabled,
    repeatMode: state.repeatMode,
    playSong,
    changeSong,
    togglePlayPause,
    expandFullPlayer,
    hideFullPlayer,
    hideAllPlayers,
    seekTo,
    showMiniPlayer,
    hideMiniPlayer,
    playNext,
    playPrevious,
    toggleShuffle,
    toggleRepeat,
    savePlaybackState,
    restorePlaybackState,
  };
};