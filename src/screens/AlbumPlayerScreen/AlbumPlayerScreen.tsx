import React, { useState, useEffect, useRef } from 'react';
import { Spinner } from '../../components/Spinner';
import {
  Heart,
  Download,
  Play,
  Pause,
  Share2,
  MessageCircle,
  X,
  SkipForward,
  SkipBack,
  UserPlus,
  UserMinus,
  Gift,
  Plus,
  Check,
  Flag,
  Shuffle,
  Repeat
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../../components/ui/avatar';
import {
  supabase,
  isSongFavorited,
  toggleSongFavorite,
  isAlbumFavorited,
  toggleAlbumFavorite,
  isFollowing,
  followUser,
  unfollowUser,
  recordShareEvent,
  getFollowerCount,
  getUserPlaylistsForSong,
  toggleSongInPlaylist,
  getContentCommentsCount
} from '../../lib/supabase';
import { shareSong, shareAlbum } from '../../lib/shareService';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import { useDownloadManager } from '../../hooks/useDownloadManager';
import { useAdPlacement } from '../../hooks/useAdPlacement';
import { CommentsModal } from '../../components/CommentsModal';
import { TippingModal } from '../../components/TippingModal';
import { CreatePlaylistModal } from '../../components/CreatePlaylistModal';
import { ReportModal } from '../../components/ReportModal';
import { AuthModal } from '../../components/AuthModal';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useMusicPlayer } from '../../contexts/MusicPlayerContext';
import { albumCache } from '../../lib/albumCache';
import { artistCache } from '../../lib/artistCache';
import { recordContribution } from '../../lib/contributionService';
import { PlayerStaticAdBanner } from '../../components/PlayerStaticAdBanner';
import { getNativeAdsForPlacement, NativeAdCard } from '../../lib/nativeAdService';
import { LoadingScreen } from '../../components/LoadingLogo';

interface AlbumTrack {
  id: string;
  title: string;
  artist: string;
  artistId?: string | null;
  duration: number;
  audioUrl: string | null;
  coverImageUrl?: string | null;
  featuredArtists?: string[];
  trackNumber: number;
  isFavorited?: boolean;
  playCount?: number;
}

interface AlbumData {
  id: string;
  title: string;
  artist: string;
  artistId?: string | null;
  coverImageUrl: string | null;
  releaseDate?: string;
  description?: string;
  tracks: AlbumTrack[];
  totalDuration: number;
  playCount: number;
  followerCount?: number;
}

interface AlbumPlayerScreenProps {
  onPlayerVisibilityChange?: (isVisible: boolean) => void;
  onOpenMusicPlayer?: (song: any, playlist?: any[], context?: string) => void;
}

const AlbumPlayer: React.FC<AlbumPlayerScreenProps & {
  albumData: AlbumData;
  autoPlay?: boolean;
  startTrackIndex?: number;
  onShowAuthModal?: () => void;
}> = ({
  albumData,
  onPlayerVisibilityChange,
  autoPlay = true,
  startTrackIndex = 0,
  onShowAuthModal
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, isAuthenticated, isInitialized } = useAuth();
  const { showAlert } = useAlert();
  const playlistDropdownRef = useRef<HTMLDivElement>(null);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(startTrackIndex);
  const [isFollowingArtist, setIsFollowingArtist] = useState(false);
  const [isLoadingFollow, setIsLoadingFollow] = useState(false);
  const [isAlbumFavorited, setIsAlbumFavorited] = useState(false);
  const [showTrackList, setShowTrackList] = useState(true);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [artistFollowerCount, setArtistFollowerCount] = useState(0);
  const [artistProfile, setArtistProfile] = useState<any>(null);
  const [artistUserId, setArtistUserId] = useState<string | null>(null);
  const [showTippingModal, setShowTippingModal] = useState(false);
  const [showCreatePlaylistModal, setShowCreatePlaylistModal] = useState(false);
  const [showPlaylistsDropdown, setShowPlaylistsDropdown] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [userPlaylists, setUserPlaylists] = useState<any[]>([]);
  const [isLoadingPlaylists, setIsLoadingPlaylists] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [shuffledPlaylist, setShuffledPlaylist] = useState<AlbumTrack[]>([]);
  const [originalPlaylist, setOriginalPlaylist] = useState<AlbumTrack[]>([]);
  const [tracks, setTracks] = useState<AlbumTrack[]>(albumData.tracks);
  const [userCountry, setUserCountry] = useState<string | undefined>();
  const [staticAd, setStaticAd] = useState<NativeAdCard | null>(null);

  const { isDownloaded, downloadSong, deleteSong, getDownloadProgress } = useDownloadManager();
  const [isDownloadInProgress, setIsDownloadInProgress] = useState(false);

  // Ad placement for during song playback
  const { showBanner, hideBanner, removeBanner } = useAdPlacement('AlbumPlayerScreen');

  const {
    currentSong,
    isPlaying,
    audioElement,
    playSong,
    togglePlayPause,
    hideFullPlayer,
    hideAllPlayers,
    playNext: globalPlayNext,
    playPrevious: globalPlayPrevious,
    isShuffleEnabled,
    repeatMode,
    toggleShuffle,
    toggleRepeat,
  } = useMusicPlayer();

  const currentTrack = tracks?.[currentTrackIndex] || null;
  const initialPathnameRef = useRef(location.pathname);

  // Close player when navigating to different routes (not within album routes)
  useEffect(() => {
    const mainRoutes = ['/', '/explore', '/library', '/create', '/profile'];
    // Only close if we're navigating away from the initial route
    if (location.pathname !== initialPathnameRef.current && mainRoutes.includes(location.pathname)) {
      handleClose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    if (!isInitialized) return;

    const initializePlayer = async () => {
      await loadTrackFavoriteStatus();
      await loadAlbumFavoriteStatus();
    };

    initializePlayer();

    // Initialize playlists
    if (albumData?.tracks) {
      setOriginalPlaylist(tracks);
      setShuffledPlaylist(tracks);
    }

    onPlayerVisibilityChange?.(true);
    window.dispatchEvent(new CustomEvent('albumPlayerVisibilityChange', {
      detail: { isVisible: true }
    }));

    if (autoPlay && albumData?.tracks && albumData.tracks.length > 0 && currentTrack?.audioUrl) {
      const albumPlaylist = tracks
        .filter(track => track.audioUrl)
        .map(track => ({
          id: track.id,
          title: track.title,
          artist: track.artist,
          artistId: track.artistId,
          coverImageUrl: track.coverImageUrl || albumData.coverImageUrl,
          audioUrl: track.audioUrl,
          duration: track.duration,
          playCount: 0
        }));

      if (albumPlaylist.length > 0) {
        const targetSong = albumPlaylist[currentTrackIndex];
        const isSameSongPlaying = currentSong?.id === targetSong.id;
        const isPlayingFromThisAlbum = currentSong?.id && albumPlaylist.some(song => song.id === currentSong.id);

        if (!isSameSongPlaying && !isPlayingFromThisAlbum) {
          playSong(albumPlaylist[currentTrackIndex], false, albumPlaylist, currentTrackIndex, `album-${albumData.id}`, albumData.id);
        }

        setTimeout(() => {
          hideFullPlayer();
        }, 100);
      }
    }

    return () => {
      onPlayerVisibilityChange?.(false);
      window.dispatchEvent(new CustomEvent('albumPlayerVisibilityChange', {
        detail: { isVisible: false }
      }));
    };
  }, [onPlayerVisibilityChange, autoPlay, albumData]);

  // Update local shuffled playlist when global shuffle state changes
  useEffect(() => {
    if (tracks) {
      if (isShuffleEnabled && tracks.length > 1) {
        const shuffled = [...tracks].sort(() => Math.random() - 0.5);
        setShuffledPlaylist(shuffled);
      } else {
        setShuffledPlaylist(tracks);
      }
    }
  }, [isShuffleEnabled, tracks]);

  useEffect(() => {
    console.log('[AlbumPlayerScreen] Album data changed:', {
      albumId: albumData?.id,
      title: albumData?.title,
      artist: albumData?.artist,
      artistId: albumData?.artistId
    });

    // Reset follow status when switching to a different artist
    setIsFollowingArtist(false);
    setArtistUserId(null);

    if (albumData?.artistId) {
      console.log('[AlbumPlayerScreen] Album has artistId, checking cache...');
      // Check artistCache first for instant display
      const cachedData = artistCache.getImmediate(albumData.artistId);
      console.log('[AlbumPlayerScreen] Immediate cache data:', cachedData);

      if (cachedData) {
        // Display cached data instantly (even if stale)
        console.log('[AlbumPlayerScreen] Using cached data for instant display');
        setArtistProfile(cachedData.profile);
        setArtistUserId(cachedData.userId);
        setArtistFollowerCount(cachedData.followerCount);
      } else {
        // Fallback to album cache data
        console.log('[AlbumPlayerScreen] Checking album cache for profile data...');
        const cachedProfile = (albumData as any)._cachedProfile;
        const cachedFollowerCount = (albumData as any)._cachedFollowerCount;
        console.log('[AlbumPlayerScreen] Album cached profile:', cachedProfile);
        console.log('[AlbumPlayerScreen] Album cached follower count:', cachedFollowerCount);

        if (cachedProfile) {
          setArtistProfile(cachedProfile);
          if (cachedProfile.id) {
            setArtistUserId(cachedProfile.id);
          }
        }

        if (cachedFollowerCount !== undefined) {
          setArtistFollowerCount(cachedFollowerCount);
        }
      }

      // Always refresh in background to ensure data is fresh
      console.log('[AlbumPlayerScreen] Calling loadArtistData in background...');
      loadArtistData();
    } else {
      console.log('[AlbumPlayerScreen] No artistId in album data');
    }
  }, [albumData]);

  // Check following status when artistUserId is available
  useEffect(() => {
    if (isAuthenticated && artistUserId) {
      checkFollowingStatus();
    }
  }, [isAuthenticated, artistUserId]);

  useEffect(() => {
    loadCommentCount();
  }, [currentTrackIndex]);

  useEffect(() => {
    if (currentSong && tracks) {
      const trackIndex = tracks.findIndex(track => track.id === currentSong.id);
      if (trackIndex >= 0 && trackIndex !== currentTrackIndex) {
        setCurrentTrackIndex(trackIndex);
      }
    }
  }, [currentSong, albumData?.tracks, currentTrackIndex]);

  useEffect(() => {
    if (currentSong?.id === currentTrack?.id && !isPlaying && audioElement) {
      if (audioElement.readyState < 3) {
        setIsBuffering(true);
      } else {
        setIsBuffering(false);
      }
    } else {
      setIsBuffering(false);
    }
  }, [isPlaying, currentSong, currentTrack, audioElement]);

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

  // Show banner ad during song playback
  useEffect(() => {
    if (isPlaying && currentTrack) {
      // Show banner ad with placement key for during song playback
      showBanner('during_song_playback_banner', undefined, {
        contentId: currentTrack.id,
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
  }, [isPlaying, currentTrack, showBanner, hideBanner, removeBanner]);

  // Load user country and static ad
  useEffect(() => {
    const loadUserData = async () => {
      if (isAuthenticated && user) {
        try {
          const { data, error } = await supabase
            .from('users')
            .select('country')
            .eq('id', user.id)
            .maybeSingle();

          if (!error && data) {
            setUserCountry(data.country);
          }
        } catch (error) {
          console.error('Error loading user country:', error);
        }
      }
    };

    loadUserData();
  }, [isAuthenticated, user]);

  // Load static ad for album player screen
  useEffect(() => {
    const loadStaticAd = async () => {
      try {
        const ads = await getNativeAdsForPlacement(
          'album_player',
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

  const checkFollowingStatus = async () => {
    if (!artistUserId || !isAuthenticated) return;

    try {
      const following = await isFollowing(artistUserId);
      setIsFollowingArtist(following);
    } catch (error) {
      console.error('Error checking following status:', error);
    }
  };

  const loadArtistData = async () => {
    console.log('[AlbumPlayerScreen] loadArtistData called for artistId:', albumData.artistId);
    console.log('[AlbumPlayerScreen] Album:', { id: albumData.id, title: albumData.title, artist: albumData.artist });

    if (!albumData.artistId) {
      console.log('[AlbumPlayerScreen] No artistId provided');
      return;
    }

    try {
      // Use artistCache for persistent data across component unmounts
      console.log('[AlbumPlayerScreen] Fetching from artistCache...');
      const cachedData = await artistCache.get(albumData.artistId);
      console.log('[AlbumPlayerScreen] Cached data received:', cachedData);

      if (cachedData) {
        console.log('[AlbumPlayerScreen] Updating state with cached data:', {
          profile: cachedData.profile,
          userId: cachedData.userId,
          followerCount: cachedData.followerCount
        });
        setArtistProfile(cachedData.profile);
        setArtistUserId(cachedData.userId);
        setArtistFollowerCount(cachedData.followerCount);
      } else {
        console.log('[AlbumPlayerScreen] No cached data available');
      }
    } catch (error) {
      console.error('[AlbumPlayerScreen] Error loading artist data:', error);
    }
  };

  const loadTrackFavoriteStatus = async () => {
    if (!isAuthenticated || !albumData?.tracks || albumData.tracks.length === 0) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const songIds = albumData.tracks.map(track => track.id);

      const { data: favorites, error } = await supabase
        .from('user_favorites')
        .select('song_id')
        .eq('user_id', user.id)
        .in('song_id', songIds);

      if (error) {
        console.error('Error loading favorites:', error);
        return;
      }

      const favoritedSongIds = new Set(favorites?.map(fav => fav.song_id) || []);

      const tracksWithFavorites = albumData.tracks.map(track => ({
        ...track,
        isFavorited: favoritedSongIds.has(track.id)
      }));

      setTracks(tracksWithFavorites);
    } catch (error) {
      console.error('Error loading track favorite status:', error);
    }
  };

  const loadAlbumFavoriteStatus = async () => {
    if (!isAuthenticated || !albumData?.id) return;

    try {
      const isFavorited = await isAlbumFavorited(albumData.id);
      setIsAlbumFavorited(isFavorited);
    } catch (error) {
      console.error('Error loading album favorite status:', error);
    }
  };

  const loadCommentCount = async () => {
    if (!albumData?.id) return;
    try {
      const count = await getContentCommentsCount(albumData.id, 'album');
      setCommentCount(count);
    } catch (error) {
      console.error('Error loading comment count:', error);
    }
  };

  const playTrack = (trackIndex: number) => {
    const track = tracks?.[trackIndex];
    if (!track || !track.audioUrl) {
      alert('Track not available');
      return;
    }

    if (currentSong?.id === track.id) {
      togglePlayPause();
      setCurrentTrackIndex(trackIndex);
      return;
    }

    setCurrentTrackIndex(trackIndex);
    setIsBuffering(true);

    const albumPlaylist = tracks
      .filter(t => t.audioUrl)
      .map(t => ({
        id: t.id,
        title: t.title,
        artist: t.artist,
        artistId: t.artistId,
        coverImageUrl: t.coverImageUrl || albumData.coverImageUrl,
        audioUrl: t.audioUrl,
        duration: t.duration,
        playCount: 0
      }));

    const playlistIndex = albumPlaylist.findIndex(song => song.id === track.id);

    if (playlistIndex >= 0) {
      playSong(albumPlaylist[playlistIndex], false, albumPlaylist, playlistIndex, `album-${albumData.id}`, albumData.id);

      setTimeout(() => {
        hideFullPlayer();
        setIsBuffering(false);
      }, 200);
    }
  };

  const getCurrentPlaylist = () => {
    return isShuffleEnabled ? shuffledPlaylist : originalPlaylist;
  };

  const playNextTrack = () => {
    const currentPlaylist = getCurrentPlaylist();
    if (currentPlaylist.length === 0) return;

    const currentIdx = currentPlaylist.findIndex(t => t.id === currentTrack?.id);

    // Handle repeat one mode
    if (repeatMode === 'one') {
      if (audioElement) {
        audioElement.currentTime = 0;
        audioElement.play().catch(err => console.error('Error replaying:', err));
      }
      return;
    }

    let nextIndex: number;
    if (currentIdx === currentPlaylist.length - 1) {
      if (repeatMode === 'all') {
        nextIndex = 0;
      } else {
        return; // End of album
      }
    } else {
      nextIndex = currentIdx + 1;
    }

    const nextTrack = currentPlaylist[nextIndex];
    if (nextTrack) {
      const originalIndex = tracks.findIndex(t => t.id === nextTrack.id);
      playTrack(originalIndex >= 0 ? originalIndex : nextIndex);
    }
  };

  const playPreviousTrack = () => {
    const currentPlaylist = getCurrentPlaylist();
    if (currentPlaylist.length === 0) return;

    const currentIdx = currentPlaylist.findIndex(t => t.id === currentTrack?.id);

    let prevIndex: number;
    if (currentIdx <= 0) {
      prevIndex = currentPlaylist.length - 1;
    } else {
      prevIndex = currentIdx - 1;
    }

    const prevTrack = currentPlaylist[prevIndex];
    if (prevTrack) {
      const originalIndex = tracks.findIndex(t => t.id === prevTrack.id);
      playTrack(originalIndex >= 0 ? originalIndex : prevIndex);
    }
  };

  const handleToggleShuffle = () => {
    toggleShuffle();
  };

  const handleToggleRepeat = () => {
    toggleRepeat();
  };

  const handleToggleFollow = async () => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }
    if (!artistUserId) return;

    setIsLoadingFollow(true);
    try {
      if (isFollowingArtist) {
        await unfollowUser(artistUserId);
        setIsFollowingArtist(false);
        setArtistFollowerCount(prev => Math.max(0, prev - 1));
        // Update cache
        if (albumData.artistId) {
          artistCache.updateFollowerCount(albumData.artistId, -1);
        }
      } else {
        await followUser(artistUserId);
        setIsFollowingArtist(true);
        setArtistFollowerCount(prev => prev + 1);
        // Update cache
        if (albumData.artistId) {
          artistCache.updateFollowerCount(albumData.artistId, 1);
        }
        // Track artist follow for contribution rewards
        recordContribution('artist_follow', artistUserId, 'artist').catch(console.error);
      }
    } catch (error) {
      console.error('Error toggling follow status:', error);
      if (error instanceof Error && error.message.includes('not authenticated')) {
        setShowAuthModal(true);
      } else {
        alert('Failed to update follow status. Please try again.');
      }
    } finally {
      setIsLoadingFollow(false);
    }
  };

  const handleToggleAlbumFavorite = async () => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }

    if (albumData?.id) {
      const previousState = isAlbumFavorited;
      setIsAlbumFavorited(!isAlbumFavorited);

      try {
        const isFavorited = await toggleAlbumFavorite(albumData.id);
        setIsAlbumFavorited(isFavorited);

        // Track engagement contribution when user likes album
        if (isFavorited && !previousState) {
          recordContribution('song_like', albumData.id, 'album').catch(console.error);
        }
      } catch (error) {
        setIsAlbumFavorited(previousState);
        console.error('Error toggling album favorite:', error);
        alert('Failed to update favorite status');
      }
    }
  };

  const handleToggleTrackFavorite = async (trackId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }

    const trackIndex = tracks.findIndex(t => t.id === trackId);
    if (trackIndex < 0) return;

    const previousFavoritedState = tracks[trackIndex].isFavorited;

    const updatedTracks = [...tracks];
    updatedTracks[trackIndex] = {
      ...updatedTracks[trackIndex],
      isFavorited: !previousFavoritedState
    };
    setTracks(updatedTracks);

    try {
      const newFavoriteStatus = await toggleSongFavorite(trackId);

      const finalTracks = [...tracks];
      finalTracks[trackIndex] = {
        ...finalTracks[trackIndex],
        isFavorited: newFavoriteStatus
      };
      setTracks(finalTracks);

      // Track engagement contribution when user likes track
      if (newFavoriteStatus && !previousFavoritedState) {
        recordContribution('song_like', trackId, 'song').catch(console.error);
      }
    } catch (error) {
      const revertedTracks = [...tracks];
      revertedTracks[trackIndex] = {
        ...revertedTracks[trackIndex],
        isFavorited: previousFavoritedState
      };
      setTracks(revertedTracks);

      console.error('Error toggling track favorite:', error);
      alert('Failed to update favorite status');
    }
  };

  const handleDownloadAlbum = async () => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }

    if (!currentTrack?.audioUrl) {
      showAlert({
        title: 'Cannot Download',
        message: 'This track cannot be downloaded',
        type: 'error'
      });
      return;
    }

    const trackIsDownloaded = isDownloaded(currentTrack.id);

    if (trackIsDownloaded) {
      const downloadedSongs = JSON.parse(localStorage.getItem('downloaded_songs') || '[]');
      const downloadedSong = downloadedSongs.find((ds: any) => ds.songId === currentTrack.id);
      if (downloadedSong) {
        deleteSong(downloadedSong.id);
        showAlert({
          title: 'Download Removed',
          message: 'Track removed from offline downloads',
          type: 'success'
        });
      }
    } else {
      setIsDownloadInProgress(true);
      try {
        await downloadSong({
          id: currentTrack.id,
          title: currentTrack.title,
          artist: currentTrack.artist,
          album: albumData.title,
          duration: formatTime(currentTrack.duration),
          audioUrl: currentTrack.audioUrl,
          coverImageUrl: currentTrack.coverImageUrl || albumData.coverImageUrl || undefined,
        });
        showAlert({
          title: 'Download Complete',
          message: 'Track downloaded for offline listening!',
          type: 'success'
        });
      } catch (error) {
        console.error('Error downloading track:', error);
        showAlert({
          title: 'Download Failed',
          message: 'Failed to download track. Please try again.',
          type: 'error'
        });
      } finally {
        setIsDownloadInProgress(false);
      }
    }
  };

  const handleShareAlbum = async () => {
    try {
      await recordShareEvent(albumData.id, 'album');
    } catch (error) {
      console.error('Error recording share event:', error);
    }

    try {
      await shareAlbum(albumData.id, albumData.title, albumData.artist);
    } catch (error) {
      console.error('Error sharing album:', error);
      // Error is already handled in shareService, but we can add additional handling here if needed
    }
  };

  const handleShareTrack = async (track: AlbumTrack, e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent triggering track play

    try {
      await recordShareEvent(track.id, 'song');
    } catch (error) {
      console.error('Error recording share event:', error);
    }

    try {
      await shareSong(track.id, track.title, track.artist);
    } catch (error) {
      console.error('Error sharing track:', error);
    }
  };

  const handleClose = () => {
    // Remove ad banner when closing player
    removeBanner();
    hideFullPlayer();

    onPlayerVisibilityChange?.(false);
    window.dispatchEvent(new CustomEvent('albumPlayerVisibilityChange', {
      detail: { isVisible: false }
    }));

    navigate(-1);
  };

  const handleAddToPlaylist = async () => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }

    if (!currentSong) return;

    setIsLoadingPlaylists(true);
    try {
      const playlists = await getUserPlaylistsForSong(currentSong.id);
      setUserPlaylists(playlists);
      setShowPlaylistsDropdown(true);
    } catch (error) {
      console.error('Error loading playlists:', error);
    } finally {
      setIsLoadingPlaylists(false);
    }
  };

  const handleToggleSongInPlaylist = async (playlistId: string) => {
    if (!currentSong) return;

    try {
      await toggleSongInPlaylist(playlistId, currentSong.id);

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
    if (showPlaylistsDropdown && currentSong) {
      handleAddToPlaylist();
    }
  };

  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatDuration = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours} hr ${minutes} min`;
    }
    return `${minutes} min`;
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
  };

  const downloadProgress = currentTrack ? getDownloadProgress(currentTrack.id) : null;
  const trackIsDownloaded = currentTrack ? isDownloaded(currentTrack.id) : false;

  // Removed redundant loading state - handled by parent component

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
                {(albumData.artist || 'A').charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-white text-sm truncate">
                {albumData.artist || 'Unknown Artist'}
              </h3>
              <p className="text-white/70 text-xs">
                {formatNumber(artistFollowerCount)} followers
              </p>
            </div>
          </div>

          {albumData.artistId && user?.id !== artistUserId && (
            <button
              onClick={handleToggleFollow}
              disabled={isLoadingFollow}
              className={`inline-flex items-center px-4 py-2 rounded-full font-medium text-xs transition-all active:scale-95 ${
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
        <div className="w-full max-w-[280px] mx-auto mb-4">
          <div className="relative aspect-square rounded-3xl overflow-hidden shadow-2xl">
            {albumData.coverImageUrl ? (
              <img
                src={albumData.coverImageUrl}
                alt={albumData.title}
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

        {/* Album Information */}
        <div className="text-center mb-6 w-full max-w-sm mx-auto">
          <h1 className="font-bold text-white text-2xl mb-1 truncate px-2">
            {albumData.title}
          </h1>
          <p className="text-white/40 text-sm">
            {tracks?.length} tracks • {formatDuration(albumData.totalDuration)}
          </p>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center justify-center gap-4 w-full max-w-sm mx-auto mb-8">
          <button
            onClick={handleToggleShuffle}
            className={`p-2.5 rounded-full transition-all active:scale-95 ${
              isShuffleEnabled
                ? 'text-white bg-white/20'
                : 'text-white/50 hover:text-white/70 hover:bg-white/10'
            }`}
            aria-label="Shuffle"
          >
            <Shuffle className="w-5 h-5" />
          </button>

          <button
            onClick={playPreviousTrack}
            className="p-3 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all active:scale-95"
            aria-label="Previous"
          >
            <SkipBack className="w-6 h-6" fill="currentColor" />
          </button>

          <button
            onClick={() => playTrack(currentTrackIndex)}
            className="w-16 h-16 bg-white rounded-full flex items-center justify-center active:scale-95 transition-all duration-200 shadow-2xl hover:shadow-3xl"
            aria-label={isPlaying && currentSong?.id === currentTrack?.id ? "Pause" : "Play"}
          >
            {isPlaying && currentSong?.id === currentTrack?.id ? (
              <Pause className="w-7 h-7 text-black" fill="black" />
            ) : (
              <Play className="w-7 h-7 ml-1 text-black" fill="black" />
            )}
          </button>

          <button
            onClick={playNextTrack}
            className="p-3 text-white/70 hover:text-white hover:bg-white/10 rounded-full transition-all active:scale-95"
            aria-label="Next"
          >
            <SkipForward className="w-6 h-6" fill="currentColor" />
          </button>

          <button
            onClick={handleToggleRepeat}
            className={`p-2.5 rounded-full transition-all active:scale-95 relative ${
              repeatMode !== 'off'
                ? 'text-white bg-white/20'
                : 'text-white/50 hover:text-white/70 hover:bg-white/10'
            }`}
            aria-label={`Repeat ${repeatMode}`}
          >
            <Repeat className="w-5 h-5" />
            {repeatMode === 'one' && (
              <span className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-white rounded-full flex items-center justify-center">
                <span className="text-black text-[9px] font-bold">1</span>
              </span>
            )}
          </button>
        </div>

        {/* Social Actions Grid */}
        <div className="w-full max-w-sm mx-auto mb-6">
          <div className="grid grid-cols-4 gap-3">
            <button
              onClick={handleToggleAlbumFavorite}
              disabled={!isAuthenticated}
              className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className={`w-11 h-11 rounded-full flex items-center justify-center transition-all duration-[50ms] ${
                isAlbumFavorited ? 'bg-red-500/20' : 'bg-white/10'
              }`}>
                <Heart className={`w-5 h-5 transition-all duration-[50ms] ${isAlbumFavorited ? 'text-red-500 fill-red-500' : 'text-white'}`} />
              </div>
              <span className="text-white/70 text-[10px] font-medium">Like</span>
            </button>

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
                  setShowAuthModal(true);
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
              onClick={handleDownloadAlbum}
              disabled={isDownloadInProgress || !currentTrack?.audioUrl}
              className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 transition-all disabled:opacity-50"
            >
              <div className={`w-11 h-11 rounded-full flex items-center justify-center ${
                trackIsDownloaded ? 'bg-[#309605]/20' : 'bg-white/10'
              }`}>
                {isDownloadInProgress || downloadProgress ? (
                  <Spinner size={20} className="text-white" />
                ) : (
                  <Download className={`w-5 h-5 ${trackIsDownloaded ? 'text-[#309605]' : 'text-white'}`} />
                )}
              </div>
              <span className="text-white/70 text-[10px] font-medium">
                {trackIsDownloaded ? 'Saved' : 'Download'}
              </span>
            </button>

            <button
              onClick={handleShareAlbum}
              className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 transition-all"
            >
              <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center">
                <Share2 className="w-5 h-5 text-white" />
              </div>
              <span className="text-white/70 text-[10px] font-medium">Share</span>
            </button>

            <button
              onClick={() => setShowReportModal(true)}
              className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 transition-all"
            >
              <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center">
                <Flag className="w-5 h-5 text-white" />
              </div>
              <span className="text-white/70 text-[10px] font-medium">Report</span>
            </button>

            {albumData.playCount > 0 && (
              <div className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-white/5">
                <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center">
                  <Play className="w-4 h-4 text-white" />
                </div>
                <span className="text-white/70 text-[10px] font-medium">
                  {formatNumber(albumData.playCount)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Track List */}
        <div className="w-full max-w-sm mx-auto">
          <div className="flex items-center justify-between mb-4 px-2">
            <h2 className="font-bold text-white text-lg">Tracks</h2>
            <button
              onClick={() => setShowTrackList(!showTrackList)}
              className="text-white/60 hover:text-white text-sm transition-colors"
            >
              {showTrackList ? 'Hide' : 'Show'}
            </button>
          </div>

          {showTrackList && (
            <div className="space-y-2">
              {tracks && tracks.length > 0 ? tracks.map((track, index) => (
                <div
                  key={track.id}
                  className={`flex items-center gap-3 p-3 rounded-2xl transition-all cursor-pointer group ${
                    currentSong?.id === track.id
                      ? 'bg-white/10'
                      : 'bg-white/5 hover:bg-white/10'
                  }`}
                  onClick={() => playTrack(index)}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-sm font-bold ${
                    currentSong?.id === track.id ? 'bg-[#309605] text-white' : 'bg-white/10 text-white/60'
                  }`}>
                    {currentSong?.id === track.id && isPlaying ? (
                      <Pause className="w-4 h-4" fill="currentColor" />
                    ) : (
                      <span>{track.trackNumber || (index + 1)}</span>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className={`font-medium text-sm truncate ${
                      currentSong?.id === track.id ? 'text-white' : 'text-white/90'
                    }`}>
                      {track.title || 'Untitled Track'}
                    </p>
                    <p className="text-white/50 text-xs truncate">
                      {track.featuredArtists && track.featuredArtists.length > 0
                        ? `${track.artist} ft. ${track.featuredArtists.join(', ')}`
                        : track.artist
                      }
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    {isAuthenticated && (
                      <button
                        onClick={(e) => handleToggleTrackFavorite(track.id, e)}
                        className="p-1.5 rounded-full transition-all hover:bg-white/10"
                        aria-label={track.isFavorited ? 'Remove from favorites' : 'Add to favorites'}
                      >
                        <Heart className={`w-4 h-4 transition-all duration-[50ms] ${track.isFavorited ? 'text-red-500 fill-red-500' : 'text-white'}`} />
                      </button>
                    )}

                    <button
                      onClick={(e) => handleShareTrack(track, e)}
                      className="p-1.5 rounded-full transition-all hover:bg-white/10 active:scale-95"
                      aria-label="Share song"
                    >
                      <Share2 className="w-4 h-4 text-white/70 hover:text-white" />
                    </button>

                    <span className="text-white/50 text-xs w-12 text-right">
                      {formatTime(track.duration)}
                    </span>
                  </div>
                </div>
              )) : (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Play className="w-8 h-8 text-white/30" />
                  </div>
                  <p className="text-white/50">No tracks available</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showCommentsModal && (
        <CommentsModal
          contentId={albumData.id}
          contentType="album"
          contentTitle={albumData.title}
          onClose={() => {
            setShowCommentsModal(false);
            loadCommentCount();
          }}
        />
      )}

      {showTippingModal && (
        <TippingModal
          onClose={() => setShowTippingModal(false)}
          onSuccess={() => setShowTippingModal(false)}
          recipientId={albumData.artistId || currentTrack?.artistId || undefined}
          recipientName={artistProfile?.display_name || albumData.artist}
          recipientAvatar={artistProfile?.avatar_url || albumData.coverImageUrl}
          contentId={currentTrack?.id || albumData.id}
          contentType="album"
        />
      )}

      {showCreatePlaylistModal && (
        <CreatePlaylistModal
          onClose={() => setShowCreatePlaylistModal(false)}
          onSuccess={handleCreatePlaylistSuccess}
          initialSongId={currentSong?.id}
        />
      )}

      {showReportModal && (
        <ReportModal
          contentType="album"
          contentId={albumData.id}
          contentTitle={albumData.title}
          reportedUserId={albumData.artistId}
          onClose={() => setShowReportModal(false)}
          onSuccess={() => {
            setShowReportModal(false);
          }}
        />
      )}

      {/* Auth Modal */}
      {showAuthModal && (
        <AuthModal
          onClose={() => setShowAuthModal(false)}
          onSuccess={() => {
            setShowAuthModal(false);
          }}
        />
      )}

      <style>{`
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

export const AlbumPlayerScreen: React.FC<AlbumPlayerScreenProps> = ({ onPlayerVisibilityChange, onOpenMusicPlayer }) => {
  const { albumId } = useParams<{ albumId: string }>();
  const navigate = useNavigate();
  const [albumData, setAlbumData] = useState<AlbumData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!albumId) {
      setError('Album ID is required');
      return;
    }

    onPlayerVisibilityChange?.(true);

    // Try to load from cache first for instant display
    const cached = albumCache.get(albumId);
    if (cached) {
      setAlbumData(cached);
      // Refresh in background
      loadAlbumData();
    } else {
      // Load immediately if not cached
      loadAlbumData();
    }

    return () => {
      onPlayerVisibilityChange?.(false);
    };
  }, [albumId]);

  const loadAlbumData = async () => {
    if (!albumId) return;

    try {
      setError(null);

      // Fetch album, songs, and artist profile in parallel for instant display
      const [albumResult, songsResult] = await Promise.all([
        supabase
          .from('albums')
          .select(`
            id,
            title,
            artist_id,
            cover_image_url,
            release_date,
            description,
            artists:artist_id (
              id,
              name,
              artist_profiles!artist_profiles_artist_id_fkey (
                stage_name,
                user_id,
                users:user_id (
                  id,
                  display_name,
                  avatar_url
                )
              )
            )
          `)
          .eq('id', albumId)
          .single(),
        supabase
          .from('songs')
          .select(`
            id,
            title,
            artist_id,
            cover_image_url,
            audio_url,
            duration_seconds,
            play_count,
            created_at,
            featured_artists,
            artists:artist_id (
              id,
              name,
              artist_profiles!artist_profiles_artist_id_fkey (
                stage_name,
                user_id,
                users:user_id (
                  display_name
                )
              )
            )
          `)
          .eq('album_id', albumId)
          .order('created_at', { ascending: true })
      ]);

      if (albumResult.error) throw albumResult.error;
      if (!albumResult.data) throw new Error('Album not found');
      if (songsResult.error) throw songsResult.error;

      const albumInfo = albumResult.data;
      const songsData = songsResult.data;

      console.log('Album Info:', albumInfo);
      console.log('Album Artists:', albumInfo.artists);

      const albumArtists = albumInfo.artists as any;
      let artistName = 'Unknown Artist';
      let extractedArtistProfile: any = null;

      if (albumArtists) {
        // Handle both array and single object responses
        const artist = Array.isArray(albumArtists) ? albumArtists[0] : albumArtists;

        // Try to get artist name from multiple sources
        if (artist) {
          // Check if artist_profiles exists and has data
          const artistProfiles = artist.artist_profiles;
          if (artistProfiles && Array.isArray(artistProfiles) && artistProfiles.length > 0) {
            const profile = artistProfiles[0];
            artistName = profile?.stage_name ||
                        profile?.users?.display_name ||
                        artist?.name ||
                        'Unknown Artist';

            // Extract profile data for instant header display
            if (profile?.users) {
              extractedArtistProfile = {
                id: profile.users.id,
                display_name: profile.users.display_name,
                avatar_url: profile.users.avatar_url
              };
            }
          } else {
            // Fallback to artist name directly
            artistName = artist?.name || 'Unknown Artist';
          }
        }
      }

      console.log('Resolved Artist Name:', artistName);

      const tracks: AlbumTrack[] = (songsData || []).map((song: any, index) => {
        // Get artist name from song, fallback to album artist
        let songArtistName = artistName;
        if (song.artists) {
          const songArtist = Array.isArray(song.artists) ? song.artists[0] : song.artists;

          if (songArtist) {
            const songArtistProfiles = songArtist.artist_profiles;
            if (songArtistProfiles && Array.isArray(songArtistProfiles) && songArtistProfiles.length > 0) {
              songArtistName = songArtistProfiles[0]?.stage_name ||
                              songArtistProfiles[0]?.users?.display_name ||
                              songArtist?.name ||
                              artistName;
            } else {
              songArtistName = songArtist?.name || artistName;
            }
          }
        }

        return {
          id: song.id,
          title: song.title,
          artist: songArtistName,
          artistId: song.artist_id,
          duration: song.duration_seconds || 0,
          audioUrl: song.audio_url,
          coverImageUrl: song.cover_image_url || albumInfo.cover_image_url,
          trackNumber: index + 1,
          featuredArtists: song.featured_artists || [],
          playCount: song.play_count || 0
        };
      });

      const totalDuration = tracks.reduce((sum, track) => sum + track.duration, 0);

      const album: AlbumData = {
        id: albumInfo.id,
        title: albumInfo.title,
        artist: artistName,
        artistId: albumInfo.artist_id,
        coverImageUrl: albumInfo.cover_image_url,
        releaseDate: albumInfo.release_date,
        description: albumInfo.description,
        tracks,
        totalDuration,
        playCount: tracks.reduce((sum, track) => sum + (track.playCount || 0), 0)
      };

      setAlbumData(album);

      // Cache the loaded data for instant future access
      // Include extracted profile data for faster subsequent loads
      albumCache.set(albumId, {
        ...album,
        _cachedProfile: extractedArtistProfile
      });
    } catch (err) {
      console.error('Failed to load album:', err);
      setError(err instanceof Error ? err.message : 'Album not found');
    }
  };

  // Only show error state - no loading skeleton for instant feel
  if (error) {
    return (
      <div className="fixed inset-0 bg-gradient-to-b from-[#1a1a1a] via-[#0d0d0d] to-[#000000] z-50 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-sm border border-white/20 rounded-3xl p-8 text-center max-w-md">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <Flag className="w-8 h-8 text-red-400" />
          </div>
          <h3 className="font-bold text-white text-xl mb-4">Album Not Found</h3>
          <p className="text-white/70 text-sm mb-6">
            {error || 'The album you\'re looking for doesn\'t exist or has been removed.'}
          </p>
        </div>
      </div>
    );
  }

  const handleShowAuthModal = () => {
    window.dispatchEvent(new CustomEvent('openAuthModal'));
  };

  // Show loading screen while fetching album data
  if (!albumData) {
    return <LoadingScreen variant="premium" />;
  }

  return (
    <AlbumPlayer
      albumData={albumData}
      autoPlay={false}
      startTrackIndex={0}
      onPlayerVisibilityChange={onPlayerVisibilityChange}
      onShowAuthModal={handleShowAuthModal}
      onOpenMusicPlayer={onOpenMusicPlayer}
    />
  );
};
