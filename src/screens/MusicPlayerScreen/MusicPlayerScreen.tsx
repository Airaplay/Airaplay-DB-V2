import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Spinner } from '../../components/Spinner';
import { Heart, Download, SkipBack, SkipForward, Play, Pause, Share2, MessageCircle, UserPlus, UserMinus, Gift, Plus, Check, Flag, X } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
import { recordPlayback } from '../../lib/playbackTracker';
import { supabase, isSongFavorited, toggleSongFavorite, recordShareEvent, isFollowing, followUser, unfollowUser, getRandomSongs, getFollowerCount, getUserPlaylistsForSong, toggleSongInPlaylist, getContentCommentsCount } from '../../lib/supabase';
import { shareSong } from '../../lib/shareService';
import { useDownloadManager } from '../../hooks/useDownloadManager';
import { useMusicPlayer } from '../../hooks/useMusicPlayer';
import { useAdPlacement } from '../../hooks/useAdPlacement';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import { artistCache } from '../../lib/artistCache';
import { CommentsModal } from '../../components/CommentsModal';
import { TippingModal } from '../../components/TippingModal';
import { CreatePlaylistModal } from '../../components/CreatePlaylistModal';
import { ReportModal } from '../../components/ReportModal';
import { CustomConfirmDialog } from '../../components/CustomConfirmDialog';
import { ArtistTopTracksSection } from '../../components/ArtistTopTracksSection';
import { SimilarSongsSection } from '../../components/SimilarSongsSection';
import { createSafeHtml } from '../../lib/sanitizeHtml';
import { getSmartAutoplayRecommendation } from '../../lib/smartAutoplayService';
import { getNextSongFromHistory } from '../../lib/recentlyPlayedService';
import { getTrendingFallbackSong } from '../../lib/trendingFallbackService';
import { recordContribution } from '../../lib/contributionService';
import { PlayerStaticAdBanner } from '../../components/PlayerStaticAdBanner';
import { getNativeAdsForPlacement, NativeAdCard } from '../../lib/nativeAdService';

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
  featuredArtists?: string[] | null;
}

interface AdContent {
  type: 'image' | 'html' | 'video';
  content: string;
  link?: string;
}

interface MusicPlayerScreenProps {
  song: Song;
  playlist?: Song[];
  currentIndex?: number;
  playlistContext?: string;
  isPlaying?: boolean;
  currentTime?: number;
  duration?: number;
  audioElement?: HTMLAudioElement | null;
  playerError?: string | null;
  onClose: () => void;
  onPlayPause?: () => void;
  onSeek?: (time: number) => void;
  onSongChange?: (song: Song, index?: number) => void;
  adContent?: AdContent;
  onShowAuthModal?: () => void;
  initialArtistProfile?: any;
  initialFollowerCount?: number;
}

const isDiscoveryContext = (context?: string): boolean => {
  if (!context) return true;

  const discoveryContexts = [
    'Global Trending',
    'Trending Near You',
    'New Releases',
    'Trending Albums',
    'AI Recommended',
    'Inspired By You',
    'Explore',
    'unknown'
  ];

  return discoveryContexts.includes(context);
};

export const MusicPlayerScreen: React.FC<MusicPlayerScreenProps> = ({
  song,
  playlist = [],
  currentIndex = 0,
  playlistContext: _playlistContext,
  isPlaying: externalIsPlaying,
  currentTime: externalCurrentTime,
  duration: externalDuration,
  audioElement: externalAudioElement,
  onClose,
  onPlayPause: externalOnPlayPause,
  onSeek: externalOnSeek,
  onSongChange,
  playerError,
  adContent,
  onShowAuthModal,
  initialArtistProfile,
  initialFollowerCount
}) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAuthenticated, isInitialized } = useAuth();
  const { showAlert } = useAlert();
  const audioRef = useRef<HTMLAudioElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [internalIsPlaying, setInternalIsPlaying] = useState(false);
  const [internalCurrentTime, setInternalCurrentTime] = useState(0);
  const [internalDuration, setInternalDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isFavorited, setIsFavorited] = useState(false);
  const [isFollowingArtist, setIsFollowingArtist] = useState(false);
  const [isLoadingFollow, setIsLoadingFollow] = useState(false);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [artistFollowerCount, setArtistFollowerCount] = useState(initialFollowerCount || 0);
  const [artistProfile, setArtistProfile] = useState<any>(initialArtistProfile || null);
  const [artistUserId, setArtistUserId] = useState<string | null>(initialArtistProfile?.id || null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [shuffledPlaylist, setShuffledPlaylist] = useState<Song[]>([]);
  const [originalPlaylist, setOriginalPlaylist] = useState<Song[]>([]);
  const [showTippingModal, setShowTippingModal] = useState(false);
  const [showCreatePlaylistModal, setShowCreatePlaylistModal] = useState(false);
  const [showPlaylistsDropdown, setShowPlaylistsDropdown] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [userPlaylists, setUserPlaylists] = useState<any[]>([]);
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [userCountry, setUserCountry] = useState<string | undefined>();
  const [staticAd, setStaticAd] = useState<NativeAdCard | null>(null);

  const {
    repeatMode: globalRepeatMode,
  } = useMusicPlayer();

  // Ad placement for during song playback
  const { showBanner, hideBanner, removeBanner } = useAdPlacement('MusicPlayerScreen');

  const { isDownloaded, downloadSong, deleteSong, getDownloadProgress } = useDownloadManager();
  const [isDownloadInProgress, setIsDownloadInProgress] = useState(false);
  const [showDownloadConfirm, setShowDownloadConfirm] = useState(false);

  const playbackStartTimeRef = useRef<number | null>(null);
  const hasRecordedPlaybackRef = useRef(false);
  const playlistDropdownRef = useRef<HTMLDivElement>(null);
  const currentArtistIdRef = useRef<string | null>(null);
  const currentSongIdRef = useRef<string | null>(null);
  const isTogglingFavoriteRef = useRef(false);
  const initialPathnameRef = useRef(location.pathname);
  const onCloseRef = useRef(onClose);

  const isPlaying = externalIsPlaying !== undefined ? externalIsPlaying : internalIsPlaying;
  const currentTime = externalCurrentTime !== undefined ? externalCurrentTime : internalCurrentTime;
  const duration = externalDuration !== undefined ? externalDuration : internalDuration;
  const usingExternalAudio = !!externalAudioElement;

  // Update onClose ref
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Close player when navigating to different routes
  useEffect(() => {
    const mainRoutes = ['/', '/explore', '/library', '/create', '/profile'];
    // Only close if we're navigating away from the initial route
    if (location.pathname !== initialPathnameRef.current && mainRoutes.includes(location.pathname)) {
      onCloseRef.current();
    }
  }, [location.pathname]);

  useEffect(() => {
    currentSongIdRef.current = song.id;

    setOriginalPlaylist(playlist);
    setShuffledPlaylist(playlist);

    if (isInitialized && isAuthenticated && user) {
      setCurrentUserId(user.id);
      loadUserCountry();
    } else {
      setCurrentUserId(null);
      setUserCountry(undefined);
    }

    if (usingExternalAudio) {
      setIsLoading(false);
    } else if (song.videoUrl) {
      // Only create local media element for VIDEO content
      pauseAllOtherMedia();
      loadAndPlaySong();
    } else {
      // For audio-only content without external audio, this shouldn't happen
      // but set loading to false to avoid stuck state
      setIsLoading(false);
      setError('Audio player not initialized');
    }

    return () => {
      // Only cleanup local video element, never audio (that's managed by context)
      if (videoRef.current) {
        videoRef.current.pause();
        videoRef.current.src = '';
      }
      removeBanner();
    };
  }, [song.id, usingExternalAudio, playlist, removeBanner, isInitialized, isAuthenticated, user]);

  // Load static ad for player screen
  useEffect(() => {
    const loadStaticAd = async () => {
      try {
        const ads = await getNativeAdsForPlacement(
          'music_player',
          userCountry,
          null, // genre targeting not needed for player ads
          1 // Only need one ad
        );

        if (ads && ads.length > 0) {
          setStaticAd(ads[0]);
        } else {
          setStaticAd(null);
        }
      } catch (error) {
        console.error('Failed to load static ad:', error);
        setStaticAd(null);
      }
    };

    loadStaticAd();
  }, [userCountry]);

  useEffect(() => {
    console.log('[MusicPlayerScreen] Song changed:', {
      songId: song.id,
      title: song.title,
      artist: song.artist,
      artistId: song.artistId
    });

    // Reset follow status when switching to a different artist
    setIsFollowingArtist(false);

    // Update the ref to track current artist
    currentArtistIdRef.current = song.artistId || null;

    if (song.artistId) {
      console.log('[MusicPlayerScreen] Song has artistId, checking cache...');
      // Check cache first for instant display
      const cachedData = artistCache.getImmediate(song.artistId);
      console.log('[MusicPlayerScreen] Immediate cache data:', cachedData);

      if (cachedData) {
        // Display cached data instantly (even if stale)
        console.log('[MusicPlayerScreen] Using cached data for instant display');
        setArtistProfile(cachedData.profile);
        setArtistUserId(cachedData.userId);
        setArtistFollowerCount(cachedData.followerCount);
      } else if (initialArtistProfile) {
        // Fallback to initial props if no cache
        console.log('[MusicPlayerScreen] Using initial artist profile:', initialArtistProfile);
        setArtistProfile(initialArtistProfile);
        setArtistUserId(initialArtistProfile.id);
        setArtistFollowerCount(initialFollowerCount || 0);
      } else {
        // No cached or initial data
        console.log('[MusicPlayerScreen] No cached or initial data available');
        setArtistProfile(null);
        setArtistUserId(null);
        setArtistFollowerCount(0);
      }

      // Always refresh in background to ensure data is fresh
      console.log('[MusicPlayerScreen] Calling loadArtistData in background...');
      loadArtistData();
    } else {
      // No artistId, reset everything
      console.log('[MusicPlayerScreen] No artistId, resetting artist data');
      setArtistProfile(null);
      setArtistUserId(null);
      setArtistFollowerCount(0);
    }

    if (isAuthenticated && !isTogglingFavoriteRef.current) {
      checkFavoriteStatus();
      checkFollowStatus();
    }
    isTogglingFavoriteRef.current = false;
    loadCommentCount();
  }, [song.id, song.artistId]);

  // Check follow and favorite status when authentication state changes
  useEffect(() => {
    if (isAuthenticated) {
      checkFavoriteStatus();
      if (artistUserId) {
        checkFollowStatus();
      }
    } else {
      // Reset statuses when user logs out
      setIsFollowingArtist(false);
      setIsFavorited(false);
    }
  }, [isAuthenticated, artistUserId]);

  // Show banner ad during song playback
  useEffect(() => {
    if (isPlaying && !isLoading) {
      // Show banner ad with placement key for during song playback
      showBanner('during_song_playback_banner', undefined, {
        contentId: song.id,
        contentType: 'song'
      }).catch(err => {
        console.error('Failed to show ad during playback:', err);
      });
    } else {
      // Hide banner when not playing
      hideBanner();
    }

    return () => {
      // Cleanup: remove banner when playback stops or component unmounts
      removeBanner();
    };
  }, [isPlaying, isLoading, song.id, showBanner, hideBanner, removeBanner]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showPlaylistsDropdown && playlistDropdownRef.current && !playlistDropdownRef.current.contains(event.target as Node)) {
        setShowPlaylistsDropdown(false);
      }
    };

    if (showPlaylistsDropdown) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showPlaylistsDropdown]);

  const loadArtistData = async () => {
    const artistId = song.artistId;
    console.log('[MusicPlayerScreen] loadArtistData called for artistId:', artistId);
    console.log('[MusicPlayerScreen] Song:', { id: song.id, title: song.title, artist: song.artist });

    if (!artistId) {
      console.log('[MusicPlayerScreen] No artistId provided');
      return;
    }

    try {
      // Use artistCache for persistent data across component unmounts
      console.log('[MusicPlayerScreen] Fetching from artistCache...');
      const cachedData = await artistCache.get(artistId);
      console.log('[MusicPlayerScreen] Cached data received:', cachedData);

      if (!cachedData) {
        // No data available
        console.log('[MusicPlayerScreen] No cached data available for artistId:', artistId);
        if (currentArtistIdRef.current === artistId && song.artistId === artistId) {
          setArtistFollowerCount(0);
          setArtistProfile(null);
          setArtistUserId(null);
        }
        return;
      }

      // Only update if the artist hasn't changed while loading
      if (currentArtistIdRef.current === artistId && song.artistId === artistId) {
        console.log('[MusicPlayerScreen] Updating state with cached data:', {
          profile: cachedData.profile,
          userId: cachedData.userId,
          followerCount: cachedData.followerCount
        });
        setArtistProfile(cachedData.profile);
        setArtistUserId(cachedData.userId);
        setArtistFollowerCount(cachedData.followerCount);
      } else {
        console.log('[MusicPlayerScreen] Artist changed during load, skipping update');
      }
    } catch (error) {
      console.error('[ArtistData] Error loading artist data:', error);
      // Reset on error only if this is still the current artist
      if (currentArtistIdRef.current === artistId && song.artistId === artistId) {
        setArtistFollowerCount(0);
        setArtistProfile(null);
        setArtistUserId(null);
      }
    }
  };

  const loadCommentCount = async () => {
    try {
      const count = await getContentCommentsCount(song.id, 'song');
      setCommentCount(count);
    } catch (error) {
      console.error('Error loading comment count:', error);
    }
  };

  const loadUserCountry = async () => {
    if (!user?.id) return;

    try {
      const { data: userData } = await supabase
        .from('users')
        .select('country')
        .eq('id', user.id)
        .maybeSingle();

      if (userData?.country) {
        setUserCountry(userData.country);
      }
    } catch (error) {
      console.error('[MusicPlayerScreen] Error loading user country:', error);
    }
  };

  const checkFavoriteStatus = async () => {
    if (!isAuthenticated) return;

    const songIdToCheck = song.id;
    try {
      const favorited = await isSongFavorited(songIdToCheck);

      if (currentSongIdRef.current === songIdToCheck) {
        setIsFavorited(favorited);
      }
    } catch (error) {
      console.error('Error checking favorite status:', error);
    }
  };

  const checkFollowStatus = async () => {
    if (!isAuthenticated || !artistUserId) return;

    try {
      const following = await isFollowing(artistUserId);
      setIsFollowingArtist(following);
    } catch (error) {
      console.error('Error checking follow status:', error);
    }
  };

  const pauseAllOtherMedia = () => {
    // Pause ALL audio elements (including external/global player)
    const audioElements = document.getElementsByTagName('audio');
    for (let i = 0; i < audioElements.length; i++) {
      audioElements[i].pause();
    }

    // Pause all video elements except our own
    const videoElements = document.getElementsByTagName('video');
    for (let i = 0; i < videoElements.length; i++) {
      if (videoElements[i] !== videoRef.current) {
        videoElements[i].pause();
      }
    }
  };

  const loadAndPlaySong = async () => {
    setIsLoading(true);
    setError(null);
    hasRecordedPlaybackRef.current = false;

    try {
      const mediaUrl = song.audioUrl || song.videoUrl;
      if (!mediaUrl) {
        throw new Error('No media URL available');
      }

      const isVideo = !!song.videoUrl;
      const mediaElement = isVideo ? videoRef.current : audioRef.current;

      if (!mediaElement) {
        throw new Error('Media element not available');
      }

      const handleLoadedMetadata = () => {
        setInternalDuration(mediaElement.duration);
        setIsLoading(false);
      };

      const handleTimeUpdate = () => {
        setInternalCurrentTime(mediaElement.currentTime);
      };

      const handlePlay = () => {
        setInternalIsPlaying(true);
        playbackStartTimeRef.current = Date.now();
        hasRecordedPlaybackRef.current = false;
      };

      const handlePause = () => {
        setInternalIsPlaying(false);
        recordPlaybackIfNeeded();
      };

      const handleEnded = () => {
        setInternalIsPlaying(false);
        recordPlaybackIfNeeded();
        handleAutoPlayNext();
      };

      const handleError = () => {
        setError('Failed to load media');
        setIsLoading(false);
      };

      mediaElement.addEventListener('loadedmetadata', handleLoadedMetadata);
      mediaElement.addEventListener('timeupdate', handleTimeUpdate);
      mediaElement.addEventListener('play', handlePlay);
      mediaElement.addEventListener('pause', handlePause);
      mediaElement.addEventListener('ended', handleEnded);
      mediaElement.addEventListener('error', handleError);

      // Set preload to 'none' to prevent downloading before user plays
      mediaElement.preload = 'none';
      mediaElement.src = mediaUrl;
      mediaElement.load();

      try {
        await mediaElement.play();
      } catch (playError) {
        console.warn('Autoplay failed:', playError);
        setIsLoading(false);
      }

      return () => {
        mediaElement.removeEventListener('loadedmetadata', handleLoadedMetadata);
        mediaElement.removeEventListener('timeupdate', handleTimeUpdate);
        mediaElement.removeEventListener('play', handlePlay);
        mediaElement.removeEventListener('pause', handlePause);
        mediaElement.removeEventListener('ended', handleEnded);
        mediaElement.removeEventListener('error', handleError);
      };
    } catch (err) {
      console.error('Error loading song:', err);
      setError(err instanceof Error ? err.message : 'Failed to load song');
      setIsLoading(false);
    }
  };

  const handleAutoPlayNext = async () => {
    console.log('[Smart Autoplay] Song ended. Context:', _playlistContext, 'Playlist length:', playlist.length, 'Current index:', currentIndex, 'Repeat:', repeatMode);
    console.log('[Smart Autoplay] globalRepeatMode:', globalRepeatMode, 'local repeatMode:', repeatMode);

    // Always use the global repeat mode from context, not the local state
    const currentRepeatMode = globalRepeatMode;
    console.log('[Smart Autoplay] Using repeat mode:', currentRepeatMode);

    if (currentRepeatMode === 'one') {
      console.log('[Smart Autoplay] Repeat mode is "one" - replaying current song');
      const mediaElement = song.videoUrl ? videoRef.current : (usingExternalAudio ? externalAudioElement : null);
      if (mediaElement) {
        mediaElement.currentTime = 0;
        mediaElement.play().catch(err => {
          console.error('Error replaying media:', err);
        });
      }
      return;
    }

    const currentPlaylist = getCurrentPlaylist();
    const isAtEndOfPlaylist = currentPlaylist.length > 0 && currentIndex >= currentPlaylist.length - 1;
    const isDiscovery = isDiscoveryContext(_playlistContext);

    console.log('[Smart Autoplay] Playlist status - Length:', currentPlaylist.length, 'At end:', isAtEndOfPlaylist, 'Discovery context:', isDiscovery);

    if (currentRepeatMode === 'all' && currentPlaylist.length > 0) {
      console.log('[Smart Autoplay] Repeat mode is "all" - restarting playlist');
      handleNextSong();
      return;
    }

    if (currentPlaylist.length > 0 && !isAtEndOfPlaylist) {
      console.log('[Smart Autoplay] More songs in playlist - playing next track');
      handleNextSong();
      return;
    }

    if (isAtEndOfPlaylist && currentPlaylist.length > 0) {
      console.log('[Autoplay] Reached end of playlist - stopping playback');
      console.log('[Autoplay] Context:', _playlistContext, '- All songs in this section have been played');
      return;
    }

    if (currentPlaylist.length === 0) {
      console.log('[Smart Autoplay] No playlist - enabling Smart Autoplay');
    } else {
      // Not at end of playlist or other edge case - don't continue
      return;
    }

    let nextSong: Song | null = null;

    try {
      console.log('[Smart Autoplay] Searching for next song...');
      
      // Try Smart Autoplay (service already has timeout, no need for duplicate wrapper)
      try {
        nextSong = await getSmartAutoplayRecommendation(
          song,
          _playlistContext,
          undefined, // albumId
          currentPlaylist // Pass playlist for duplicate checking
        );
      } catch (error) {
        console.warn('[Smart Autoplay] Smart recommendation failed:', error);
      }

      // Only try fallback if first attempt failed
      if (!nextSong) {
        try {
          console.log('[Smart Autoplay] No similar songs found, trying recently played history');
          nextSong = await getNextSongFromHistory(song);
          // Validate fallback
          if (nextSong) {
            const isDuplicate = currentPlaylist.some(s => s.id === nextSong!.id);
            const isCurrentSong = nextSong.id === song.id;
            if (isDuplicate || isCurrentSong) {
              console.warn('[Smart Autoplay] History fallback is duplicate');
              nextSong = null;
            }
          }
        } catch (error) {
          console.warn('[Smart Autoplay] History fallback failed:', error);
        }
      }

      // Only try trending if still no song
      if (!nextSong) {
        try {
          console.log('[Smart Autoplay] No recently played songs, trying trending fallback');
          const country = userCountry || 'NG'; // Fallback to default country
          nextSong = await getTrendingFallbackSong(country);
          // Validate trending fallback
          if (nextSong) {
            const isDuplicate = currentPlaylist.some(s => s.id === nextSong!.id);
            const isCurrentSong = nextSong.id === song.id;
            if (isDuplicate || isCurrentSong) {
              console.warn('[Smart Autoplay] Trending fallback is duplicate');
              nextSong = null;
            }
          }
        } catch (error) {
          console.warn('[Smart Autoplay] Trending fallback failed:', error);
        }
      }

      if (nextSong) {
        // Final validation before transitioning
        const isDuplicate = currentPlaylist.some(s => s.id === nextSong!.id);
        const isCurrentSong = nextSong.id === song.id;
        
        if (isDuplicate || isCurrentSong) {
          console.warn('[Smart Autoplay] Final validation failed - duplicate detected');
          console.log('[Smart Autoplay] No valid recommendation - stopping playback');
        } else {
          console.log('[Smart Autoplay] Transitioning to:', nextSong.title, 'by', nextSong.artist);
          onSongChange?.(nextSong);
        }
      } else {
        console.log('[Smart Autoplay] No songs available for autoplay - stopping playback');
      }
    } catch (error) {
      console.error('[Smart Autoplay] Error in autoplay chain:', error);
    }
  };

  const getCurrentPlaylist = () => {
    return originalPlaylist;
  };

  const handlePreviousSong = () => {
    const currentPlaylist = getCurrentPlaylist();

    if (currentPlaylist.length === 0) {
      return;
    }

    if (currentPlaylist.length === 1) {
      const mediaElement = song.videoUrl ? videoRef.current : (usingExternalAudio ? externalAudioElement : null);
      if (mediaElement) {
        mediaElement.currentTime = 0;
        mediaElement.play().catch(err => {
          console.error('Error replaying media:', err);
        });
      }
      return;
    }

    const previousIndex = currentIndex > 0 ? currentIndex - 1 : currentPlaylist.length - 1;

    const previousSong = currentPlaylist[previousIndex];
    if (previousSong) {
      onSongChange?.(previousSong, previousIndex);
    }
  };

  const handleNextSong = async () => {
    const currentPlaylist = getCurrentPlaylist();

    if (currentPlaylist.length === 0) {
      return;
    }

    if (currentPlaylist.length === 1) {
      if (globalRepeatMode === 'one') {
        const mediaElement = song.videoUrl ? videoRef.current : (usingExternalAudio ? externalAudioElement : null);
        if (mediaElement) {
          mediaElement.currentTime = 0;
          mediaElement.play().catch(err => {
            console.error('Error replaying media:', err);
          });
        }
      }
      return;
    }

    let nextIndex;
    if (currentIndex === currentPlaylist.length - 1) {
      if (globalRepeatMode === 'all') {
        nextIndex = 0;
      } else {
        return;
      }
    } else {
      nextIndex = currentIndex + 1;
    }

    const nextSong = currentPlaylist[nextIndex];
    if (nextSong) {
      onSongChange?.(nextSong, nextIndex);
    }
  };

  const recordPlaybackIfNeeded = () => {
    if (playbackStartTimeRef.current && !hasRecordedPlaybackRef.current) {
      const durationListened = Math.floor((Date.now() - playbackStartTimeRef.current) / 1000);
      recordPlayback(song.id, durationListened, !!song.videoUrl);
      hasRecordedPlaybackRef.current = true;
      playbackStartTimeRef.current = null;
    }
  };

  const togglePlayPause = () => {
    if (externalOnPlayPause) {
      // Use external play/pause handler when available (preserves audio element and position)
      externalOnPlayPause();
    } else if (song.videoUrl && videoRef.current) {
      // Only handle video playback internally
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play().catch(err => {
          console.error('Error playing video:', err);
          setError('Failed to play video');
        });
      }
    } else {
      // For audio content, external handler must be provided
      console.error('No external play/pause handler for audio content');
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);

    if (externalOnSeek) {
      // Use external seek handler when available (preserves audio element and updates position)
      externalOnSeek(newTime);
    } else if (song.videoUrl && videoRef.current) {
      // Only handle video seeking internally
      videoRef.current.currentTime = newTime;
      setInternalCurrentTime(newTime);
    } else {
      // For audio content, external handler must be provided
      console.error('No external seek handler for audio content');
    }
  };

  const handleToggleFavorite = async () => {
    if (!isAuthenticated) {
      if (onShowAuthModal) {
        onShowAuthModal();
      } else {
        alert('Please sign in to add songs to your favorites');
      }
      return;
    }

    isTogglingFavoriteRef.current = true;
    const previousState = isFavorited;
    setIsFavorited(!isFavorited);

    try {
      const newFavoriteStatus = await toggleSongFavorite(song.id);
      setIsFavorited(newFavoriteStatus);

      // Track engagement contribution when user likes content
      if (newFavoriteStatus && !previousState) {
        recordContribution('song_like', song.id, 'song').catch(console.error);
      }
    } catch (error) {
      setIsFavorited(previousState);
      console.error('Error toggling favorite:', error);
      alert('Failed to update favorite status');
    } finally {
      isTogglingFavoriteRef.current = false;
    }
  };

  const handleToggleDownload = async () => {
    if (!song.audioUrl) {
      showAlert({
        title: 'Cannot Download',
        message: 'This song cannot be downloaded',
        type: 'error'
      });
      return;
    }

    const songIsDownloaded = isDownloaded(song.id);

    if (songIsDownloaded) {
      const downloadedSongs = JSON.parse(localStorage.getItem('downloaded_songs') || '[]');
      const downloadedSong = downloadedSongs.find((ds: any) => ds.songId === song.id);
      if (downloadedSong) {
        deleteSong(downloadedSong.id);
        showAlert({
          title: 'Download Removed',
          message: 'Song removed from offline downloads',
          type: 'success'
        });
      }
    } else {
      setShowDownloadConfirm(true);
    }
  };

  const handleConfirmDownload = async () => {
    setShowDownloadConfirm(false);
    setIsDownloadInProgress(true);
    try {
      await downloadSong({
        id: song.id,
        title: song.title,
        artist: song.artist,
        duration: formatTime(song.duration || 0),
        audioUrl: song.audioUrl,
        coverImageUrl: song.coverImageUrl || undefined,
      });
      showAlert({
        title: 'Download Complete',
        message: 'Song downloaded for offline listening!',
        type: 'success'
      });
    } catch (error) {
      console.error('Error downloading song:', error);
      showAlert({
        title: 'Download Failed',
        message: 'Failed to download song. Please try again.',
        type: 'error'
      });
    } finally {
      setIsDownloadInProgress(false);
    }
  };

  const handleToggleFollow = async () => {
    if (!isAuthenticated) {
      // Show auth modal for non-authenticated users
      onShowAuthModal?.();
      return;
    }

    if (!artistUserId) {
      console.warn('No artistUserId available for follow action');
      return;
    }

    setIsLoadingFollow(true);
    try {
      if (isFollowingArtist) {
        await unfollowUser(artistUserId);
        setIsFollowingArtist(false);
        setArtistFollowerCount(prev => Math.max(0, prev - 1));
        // Update cache
        if (song.artistId) {
          artistCache.updateFollowerCount(song.artistId, -1);
        }
      } else {
        await followUser(artistUserId);
        setIsFollowingArtist(true);
        setArtistFollowerCount(prev => prev + 1);
        // Update cache
        if (song.artistId) {
          artistCache.updateFollowerCount(song.artistId, 1);
        }
        // Track artist follow for contribution rewards
        recordContribution('artist_follow', artistUserId, 'artist').catch(console.error);
      }
    } catch (error) {
      console.error('Error toggling follow status:', error);
      // Show user-friendly error message
      if (error instanceof Error && error.message.includes('not authenticated')) {
        onShowAuthModal?.();
      } else {
        alert('Failed to update follow status. Please try again.');
      }
    } finally {
      setIsLoadingFollow(false);
    }
  };

  const handleShare = async () => {
    try {
      await recordShareEvent(song.id, 'song');
      // Track share for contribution rewards
      recordContribution('content_share', song.id, 'song').catch(console.error);
    } catch (error) {
      console.error('Error recording share event:', error);
    }

    try {
      await shareSong(song.id, song.title, song.artist);
    } catch (error) {
      console.error('Error sharing song:', error);
    }
  };

  const handleAdClick = () => {
    if (adContent?.link) {
      window.open(adContent.link, '_blank', 'noopener,noreferrer');
    }
  };

  const handleAddToPlaylist = async () => {
    if (!isAuthenticated) {
      onShowAuthModal?.();
      return;
    }

    setIsLoadingPlaylists(true);
    try {
      const playlists = await getUserPlaylistsForSong(song.id);
      setUserPlaylists(playlists);
      setShowPlaylistsDropdown(true);
    } catch (error) {
      console.error('Error loading playlists:', error);
    } finally {
      setIsLoadingPlaylists(false);
    }
  };

  const handleToggleSongInPlaylist = async (playlistId: string) => {
    try {
      await toggleSongInPlaylist(playlistId, song.id);

      // Update playlists state to reflect the change
      setUserPlaylists(prevPlaylists =>
        prevPlaylists.map(playlist =>
          playlist.id === playlistId
            ? { ...playlist, hasSong: !playlist.hasSong }
            : playlist
        )
      );
    } catch (error) {
      console.error('Error toggling song in playlist:', error);
      alert('Failed to update playlist');
    }
  };

  const handleCreatePlaylistSuccess = () => {
    setShowCreatePlaylistModal(false);
    if (showPlaylistsDropdown) {
      handleAddToPlaylist();
    }
  };

  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const handleClose = () => {
    // Remove ad banner when closing player
    removeBanner();
    onClose();
  };

  const songIsDownloaded = isDownloaded(song.id);
  const downloadProgress = getDownloadProgress(song.id);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-[#1a1a1a] via-[#0d0d0d] to-[#000000] animate-in fade-in duration-300 touch-manipulation overflow-y-auto pb-[140px]">
      {/* Header */}
      <header className="sticky top-0 z-20 bg-gradient-to-b from-black/80 via-black/50 to-transparent backdrop-blur-md">
        <div className="flex items-center justify-between px-5 py-4">
          <button
            onClick={handleClose}
            className="p-2 hover:bg-white/10 rounded-full transition-all active:scale-95"
            aria-label="Close player"
          >
            <X className="w-6 h-6 text-white" />
          </button>

          <div
            className="flex items-center gap-3 flex-1 min-w-0 mx-4 cursor-pointer active:scale-95 transition-transform"
            onClick={() => {
              if (artistUserId) {
                handleClose();
                navigate(`/user/${artistUserId}`);
              }
            }}
          >
            <Avatar className="w-10 h-10 border-2 border-white/20 ring-2 ring-white/10">
              <AvatarImage src={artistProfile?.avatar_url || artistProfile?.profile_photo_url || undefined} />
              <AvatarFallback className="bg-gradient-to-br from-[#309605] to-[#3ba208] text-white font-semibold">
                {(song.artist || 'A').charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-white text-sm truncate">
                {song.artist || 'Unknown Artist'}
              </h3>
              <p className="text-white/60 text-xs">
                {formatNumber(artistFollowerCount)} followers
              </p>
            </div>
          </div>

          {artistUserId && currentUserId !== artistUserId && (
            <button
              onClick={handleToggleFollow}
              disabled={isLoadingFollow}
              aria-label={isAuthenticated && isFollowingArtist ? "Unfollow artist" : "Follow artist"}
              className={`inline-flex items-center px-4 py-2 rounded-full font-medium text-xs transition-all active:scale-95 focus-visible:ring-2 focus-visible:ring-[#309605] focus-visible:ring-offset-2 focus-visible:ring-offset-black ${
                isAuthenticated && isFollowingArtist
                  ? 'bg-white/100 text-grey border border-white/30 hover:bg-white/30'
                  : 'bg-white text-black hover:bg-white/90'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isLoadingFollow ? (
                <Spinner size={14} className="text-white" />
              ) : isAuthenticated && isFollowingArtist ? (
                <>
                  <UserMinus className="w-3.5 h-3.5 mr-1" />
                  Following
                </>
              ) : (
                <>
                  <UserPlus className="w-3.5 h-3.5 mr-1" />
                  Follow
                </>
              )}
            </button>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex flex-col px-5 py-6">
        {/* Album Artwork */}
        <div className="w-full max-w-[280px] mx-auto mb-6">
          <div className="relative aspect-square rounded-3xl overflow-hidden shadow-2xl">
            {song.coverImageUrl ? (
              <img
                src={song.coverImageUrl}
                alt={song.title}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-[#309605] to-[#3ba208] flex items-center justify-center">
                <span className="text-white text-6xl font-bold">♪</span>
              </div>
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
          </div>
        </div>

        {/* Static Ad Banner */}
        {staticAd && (
          <div className="w-full max-w-sm mx-auto mb-4">
            <PlayerStaticAdBanner ad={staticAd} />
          </div>
        )}

        {/* Song Information */}
        <div className="text-center mb-3 w-full max-w-sm mx-auto">
          <h1 className="font-bold text-white text-2xl mb-1 truncate px-2">
            {song.title}
          </h1>
          {song.featuredArtists && song.featuredArtists.length > 0 && (
            <p className="text-white/60 text-sm px-2">
              Ft {song.featuredArtists.join(', ')}
            </p>
          )}
                 </div>

        {/* Progress Section */}
        <div className="w-full max-w-sm mx-auto mb-3">
          <div className="relative mb-2">
            <input
              type="range"
              min="0"
              max={duration || 0}
              value={currentTime}
              onChange={handleSeek}
              aria-label="Seek track position"
              aria-valuemin={0}
              aria-valuemax={duration || 0}
              aria-valuenow={currentTime}
              className="w-full h-1 bg-white/20 rounded-full appearance-none cursor-pointer slider focus-visible:ring-2 focus-visible:ring-[#309605] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            />
          </div>
          <div className="flex justify-between text-white/70 text-xs px-1">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center justify-center gap-4 w-full max-w-sm mx-auto mb-8">
          <button
            onClick={handleToggleFavorite}
            className="p-3 rounded-full transition-all active:scale-95 focus-visible:ring-2 focus-visible:ring-[#309605] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            aria-label={isFavorited ? "Unlike song" : "Like song"}
          >
            <Heart className={`w-6 h-6 transition-all ${isFavorited ? 'text-red-500 fill-red-500' : 'text-white/70 hover:text-white'}`} />
          </button>

          <button
            onClick={handlePreviousSong}
            className="p-3 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all active:scale-95 focus-visible:ring-2 focus-visible:ring-[#309605] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            aria-label="Previous track"
          >
            <SkipBack className="w-6 h-6" fill="currentColor" />
          </button>

          <button
            onClick={togglePlayPause}
            disabled={isLoading || !!error}
            className="w-16 h-16 bg-white rounded-full flex items-center justify-center active:scale-95 transition-all duration-200 shadow-2xl hover:shadow-3xl disabled:opacity-50 disabled:cursor-not-allowed focus-visible:ring-2 focus-visible:ring-[#309605] focus-visible:ring-offset-2 focus-visible:ring-offset-white"
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isLoading ? (
              <Spinner size={20} />
            ) : isPlaying ? (
              <Pause className="w-7 h-7 text-black" fill="black" />
            ) : (
              <Play className="w-7 h-7 ml-1 text-black" fill="black" />
            )}
          </button>

          <button
            onClick={handleNextSong}
            className="p-3 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all active:scale-95 focus-visible:ring-2 focus-visible:ring-[#309605] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            aria-label="Next track"
          >
            <SkipForward className="w-6 h-6" fill="currentColor" />
          </button>

          <button
            onClick={handleShare}
            className="p-3 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all active:scale-95 focus-visible:ring-2 focus-visible:ring-[#309605] focus-visible:ring-offset-2 focus-visible:ring-offset-black"
            aria-label="Share song"
          >
            <Share2 className="w-6 h-6" />
          </button>
        </div>

        {/* Social Actions Grid */}
        <div className="w-full max-w-sm mx-auto mb-6 space-y-4">
          {/* Action Buttons Grid */}
          <div className="grid grid-cols-4 gap-3">
            <div className="relative" ref={playlistDropdownRef}>
              <button
                onClick={handleAddToPlaylist}
                disabled={isLoadingPlaylists}
                className="w-full flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center">
                  {isLoadingPlaylists ? (
                    <Spinner size={20} className="text-white" />
                  ) : (
                    <Plus className="w-5 h-5 text-white" />
                  )}
                </div>
                <span className="text-white/70 text-[10px] font-medium">Playlist</span>
              </button>

              {showPlaylistsDropdown && (
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-56 bg-[#1a1a1a] border border-white/10 rounded-2xl shadow-2xl z-30 overflow-hidden">
                  {isLoadingPlaylists ? (
                    <div className="px-4 py-3 flex items-center justify-center">
                      <Spinner size={24} className="text-white" />
                    </div>
                  ) : userPlaylists.length === 0 ? (
                    <div className="px-4 py-3 text-white/50 text-sm text-center">
                      No playlists yet
                    </div>
                  ) : (
                    <>
                      <div className="px-4 py-2 text-white text-xs font-semibold border-b border-white/10">
                        Add to Playlist
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        {userPlaylists.map(playlist => (
                          <button
                            key={playlist.id}
                            onClick={() => handleToggleSongInPlaylist(playlist.id)}
                            className="w-full px-4 py-2.5 text-left text-white/80 text-sm hover:bg-white/5 flex items-center justify-between transition-colors"
                          >
                            <span className="truncate">{playlist.title}</span>
                            {playlist.hasSong && <Check className="w-4 h-4 text-[#309605] flex-shrink-0 ml-2" />}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                  <div className="border-t border-white/10">
                    <button
                      onClick={() => {
                        setShowPlaylistsDropdown(false);
                        setShowCreatePlaylistModal(true);
                      }}
                      className="w-full px-4 py-2.5 text-left text-[#309605] text-sm hover:bg-white/5 flex items-center transition-colors"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Create New
                    </button>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                if (!isAuthenticated) {
                  onShowAuthModal?.();
                } else {
                  setShowTippingModal(true);
                }
              }}
              className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 transition-all"
            >
              <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center">
                <Gift className="w-5 h-5 text-white" />
              </div>
              <span className="text-white/70 text-[10px] font-medium">Treat</span>
            </button>

            <button
              onClick={() => setShowCommentsModal(true)}
              className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 transition-all"
            >
              <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center relative">
                <MessageCircle className="w-5 h-5 text-white" />
                {commentCount > 0 && (
                  <span className="absolute -top-1 -right-1 bg-[#309605] text-white text-[9px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                    {commentCount > 99 ? '99+' : commentCount}
                  </span>
                )}
              </div>
              <span className="text-white/70 text-[10px] font-medium">Comment</span>
            </button>

            <button
              onClick={handleToggleDownload}
              disabled={isDownloadInProgress || !song.audioUrl}
              className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 transition-all disabled:opacity-50"
            >
              <div className={`w-11 h-11 rounded-full flex items-center justify-center ${
                songIsDownloaded ? 'bg-[#309605]/20' : 'bg-white/10'
              }`}>
                {isDownloadInProgress || downloadProgress ? (
                  <Spinner size={20} className="text-white" />
                ) : (
                  <Download className={`w-5 h-5 ${songIsDownloaded ? 'text-[#309605]' : 'text-white'}`} />
                )}
              </div>
              <span className="text-white/70 text-[10px] font-medium">
                {songIsDownloaded ? 'Saved' : 'Download'}
              </span>
            </button>
          </div>

          {/* Stats & Report Bar */}
          <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-white/5">
            <button
              onClick={() => setShowReportModal(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white transition-all active:scale-95"
            >
              <Flag className="w-4 h-4" />
              <span className="text-xs font-medium">Report</span>
            </button>

            {song.playCount && song.playCount > 0 && (
              <div className="flex items-center gap-2 px-4 py-2.5">
                <Play className="w-3.5 h-3.5 text-white/50" fill="currentColor" />
                <span className="text-white text-sm font-semibold">
                  {formatNumber(song.playCount)}
                </span>
                <span className="text-white/50 text-xs">plays</span>
              </div>
            )}
          </div>
        </div>

        {/* Artist Top Tracks Section */}
        {song.artistId && (
          <ArtistTopTracksSection
            artistId={song.artistId}
            artistName={song.artist}
            currentSongId={song.id}
            onSongSelect={(selectedSong) => {
              onSongChange?.(selectedSong);
            }}
          />
        )}

        {/* Similar Songs Section */}
        <SimilarSongsSection
          currentSong={song}
          onSongSelect={(selectedSong) => {
            onSongChange?.(selectedSong);
          }}
        />

        {/* Ad Space */}
        {adContent && (
          <div
            className="w-full max-w-sm mx-auto h-20 rounded-2xl overflow-hidden cursor-pointer border border-white/10 shadow-lg"
            onClick={handleAdClick}
          >
            {adContent.type === 'image' && (
              <img
                src={adContent.content}
                alt="Advertisement"
                className="w-full h-full object-cover"
              />
            )}
            {adContent.type === 'html' && (
              <div
                className="w-full h-full"
                dangerouslySetInnerHTML={createSafeHtml(adContent.content)}
              />
            )}
            {adContent.type === 'video' && (
              <video
                src={adContent.content}
                className="w-full h-full object-cover"
                muted
                loop
              />
            )}
          </div>
        )}

        {/* Error Message */}
        {(playerError || error) && (
          <div className="w-full max-w-sm mx-auto mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl backdrop-blur-sm">
            <p className="text-red-400 text-sm text-center font-medium">
              {playerError || error}
            </p>
          </div>
        )}
      </div>

      {/* Video element for video content only */}
      {song.videoUrl && (
        <video ref={videoRef} preload="none" className="hidden" />
      )}

      {/* Comments Modal */}
      {showCommentsModal && (
        <CommentsModal
          contentId={song.id}
          contentType="song"
          contentTitle={song.title}
          onClose={() => {
            setShowCommentsModal(false);
            loadCommentCount();
          }}
        />
      )}

      {/* Tipping Modal */}
      {showTippingModal && (
        <TippingModal
          onClose={() => setShowTippingModal(false)}
          onSuccess={() => setShowTippingModal(false)}
          recipientId={song.artistId}
          contentId={song.id}
          contentType="song"
          recipientName={artistProfile?.display_name || song.artist}
          recipientAvatar={artistProfile?.avatar_url || null}
        />
      )}

      {/* Create Playlist Modal */}
      {showCreatePlaylistModal && (
        <CreatePlaylistModal
          onClose={() => setShowCreatePlaylistModal(false)}
          onSuccess={handleCreatePlaylistSuccess}
          initialSongId={song.id}
        />
      )}

      {/* Report Modal */}
      {showReportModal && (
        <ReportModal
          contentType="song"
          contentId={song.id}
          contentTitle={song.title}
          reportedUserId={song.artistId}
          onClose={() => setShowReportModal(false)}
          onSuccess={() => {
            setShowReportModal(false);
          }}
        />
      )}

      {/* Download Confirmation */}
      <CustomConfirmDialog
        isOpen={showDownloadConfirm}
        title="Download for Offline?"
        message={`Download "${song.title}" by ${song.artist} for offline listening? This will use storage space on your device.`}
        confirmText="Download"
        cancelText="Cancel"
        variant="info"
        onConfirm={handleConfirmDownload}
        onCancel={() => setShowDownloadConfirm(false)}
        isLoading={isDownloadInProgress}
      />

      <style>{`
        .slider::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #ffffff;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
        }

        .slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #ffffff;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
        }

        .slider::-webkit-slider-track {
          background: linear-gradient(to right, #ffffff 0%, #ffffff ${(currentTime / duration) * 100}%, rgba(255, 255, 255, 0.3) ${(currentTime / duration) * 100}%, rgba(255, 255, 255, 0.3) 100%);
          border-radius: 10px;
        }

        * {
          -webkit-tap-highlight-color: transparent;
          -webkit-touch-callout: none;
          -webkit-user-select: none;
          -khtml-user-select: none;
          -moz-user-select: none;
          -ms-user-select: none;
          user-select: none;
        }

        .touch-manipulation {
          touch-action: manipulation;
        }
      `}</style>
    </div>
  );
};
