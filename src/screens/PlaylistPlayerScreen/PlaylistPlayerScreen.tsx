import React, { useState, useEffect } from 'react';
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
  Flag,
  Shuffle,
  Repeat,
  Edit,
  Trash2
} from 'lucide-react';
import { sharePlaylist } from '../../lib/shareService';
import {
  supabase,
  isSongFavorited,
  toggleSongFavorite,
  recordShareEvent,
  getContentCommentsCount
} from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useAlert } from '../../contexts/AlertContext';
import { useDownloadManager } from '../../hooks/useDownloadManager';
import { CommentsModal } from '../../components/CommentsModal';
import { ReportModal } from '../../components/ReportModal';
import { trackPlaylistPlayed, recordContribution } from '../../lib/contributionService';
import { EditPlaylistModal } from '../../components/EditPlaylistModal';
import { AuthModal } from '../../components/AuthModal';
import { useParams, useNavigate } from 'react-router-dom';
import { useMusicPlayer } from '../../contexts/MusicPlayerContext';
import { playlistCache } from '../../lib/playlistCache';
import { PlayerStaticAdBanner } from '../../components/PlayerStaticAdBanner';
import { getNativeAdsForPlacement, NativeAdCard } from '../../lib/nativeAdService';
import { LoadingLogo } from '../../components/LoadingLogo';

interface PlaylistTrack {
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
  addedAt?: string;
}

interface PlaylistData {
  id: string;
  title: string;
  description?: string;
  coverImageUrl: string | null;
  userId: string;
  userName?: string;
  userAvatar?: string;
  tracks: PlaylistTrack[];
  totalDuration: number;
  createdAt?: string;
  updatedAt?: string;
  isOwner: boolean;
}

interface PlaylistPlayerScreenProps {
  onPlayerVisibilityChange?: (isVisible: boolean) => void;
  onOpenMusicPlayer?: (song: any, playlist?: any[], context?: string) => void;
}

const PlaylistPlayer: React.FC<PlaylistPlayerScreenProps & {
  playlistData: PlaylistData;
  autoPlay?: boolean;
  startTrackIndex?: number;
  onShowAuthModal?: () => void;
}> = ({
  playlistData,
  onPlayerVisibilityChange,
  autoPlay = true,
  startTrackIndex = 0,
  onShowAuthModal
}) => {
  const navigate = useNavigate();
  const { user, isAuthenticated, isInitialized } = useAuth();
  const { showAlert } = useAlert();
  const [currentTrackIndex, setCurrentTrackIndex] = useState(startTrackIndex);
  const [showTrackList, setShowTrackList] = useState(true);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showEditPlaylistModal, setShowEditPlaylistModal] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [commentCount, setCommentCount] = useState(0);
  const [tracks, setTracks] = useState<PlaylistTrack[]>(playlistData.tracks);
  const [userCountry, setUserCountry] = useState<string | undefined>();
  const [staticAd, setStaticAd] = useState<NativeAdCard | null>(null);

  const { isDownloaded, downloadSong, deleteSong, getDownloadProgress } = useDownloadManager();
  const [isDownloadInProgress, setIsDownloadInProgress] = useState(false);

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
    toggleRepeat: globalToggleRepeat,
    repeatMode: globalRepeatMode,
    toggleShuffle: globalToggleShuffle,
    isShuffleEnabled: globalIsShuffleEnabled,
  } = useMusicPlayer();

  const currentTrack = tracks?.[currentTrackIndex] || null;

  useEffect(() => {
    if (!isInitialized) return;

    const initializePlayer = async () => {
      await loadTrackFavoriteStatus();
    };

    initializePlayer();

    onPlayerVisibilityChange?.(true);
    window.dispatchEvent(new CustomEvent('playlistPlayerVisibilityChange', {
      detail: { isVisible: true }
    }));

    if (autoPlay && playlistData?.tracks && playlistData.tracks.length > 0) {
      const playlistTracks = playlistData.tracks
        .filter(track => track.audioUrl)
        .map(track => ({
          id: track.id,
          title: track.title,
          artist: track.artist,
          artistId: track.artistId,
          coverImageUrl: track.coverImageUrl || playlistData.coverImageUrl,
          audioUrl: track.audioUrl,
          duration: track.duration,
          playCount: 0
        }));

      if (playlistTracks.length > 0) {
        // Find first playable track
        const firstPlayableIndex = playlistData.tracks.findIndex(track => track.audioUrl);
        const playableIndexInFiltered = firstPlayableIndex >= 0 ?
          playlistTracks.findIndex(track => track.id === playlistData.tracks[firstPlayableIndex].id) : 0;

        const targetSong = playlistTracks[playableIndexInFiltered];
        const isSameSongPlaying = currentSong?.id === targetSong?.id;
        const isPlayingFromThisPlaylist = currentSong?.id && playlistTracks.some(song => song.id === currentSong.id);

        if (targetSong && !isSameSongPlaying && !isPlayingFromThisPlaylist) {
          playSong(targetSong, false, playlistTracks, playableIndexInFiltered, `playlist-${playlistData.id}`, null);
        }

        setTimeout(() => {
          hideFullPlayer();
        }, 100);
      }
    }

    return () => {
      onPlayerVisibilityChange?.(false);
      window.dispatchEvent(new CustomEvent('playlistPlayerVisibilityChange', {
        detail: { isVisible: false }
      }));
    };
  }, [onPlayerVisibilityChange, autoPlay, playlistData]);

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
  }, [currentSong, tracks, currentTrackIndex]);

  useEffect(() => {
    // Only show buffering state when:
    // 1. The current track matches what's playing in the global player
    // 2. We're trying to play (isPlaying should be true from context)
    // 3. The audio element exists and is in a loading state
    if (currentSong?.id === currentTrack?.id && audioElement) {
      // If we're supposed to be playing but audio isn't ready, show buffering
      if (isPlaying && audioElement.readyState < 3) {
        setIsBuffering(true);
      } else {
        setIsBuffering(false);
      }
    } else {
      setIsBuffering(false);
    }
  }, [isPlaying, currentSong, currentTrack, audioElement]);

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

  // Load static ad for playlist player screen
  useEffect(() => {
    const loadStaticAd = async () => {
      try {
        const ads = await getNativeAdsForPlacement(
          'playlist_player',
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

  const loadTrackFavoriteStatus = async () => {
    if (!isAuthenticated || !playlistData?.tracks || playlistData.tracks.length === 0) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const songIds = playlistData.tracks.map(track => track.id);

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

      const tracksWithFavorites = playlistData.tracks.map(track => ({
        ...track,
        isFavorited: favoritedSongIds.has(track.id)
      }));

      setTracks(tracksWithFavorites);
    } catch (error) {
      console.error('Error loading favorite status:', error);
    }
  };

  const loadCommentCount = async () => {
    if (!playlistData?.id) return;
    try {
      const count = await getContentCommentsCount(playlistData.id, 'playlist');
      setCommentCount(count);
    } catch (error) {
      console.error('Error loading comment count:', error);
    }
  };

  const playTrack = (trackIndex: number) => {
    const track = tracks?.[trackIndex];
    if (!track) {
      alert('Track not found');
      return;
    }

    if (!track.audioUrl) {
      alert('This track does not have a valid audio file. Please contact the creator.');
      return;
    }

    if (currentSong?.id === track.id) {
      togglePlayPause();
      setCurrentTrackIndex(trackIndex);
      return;
    }

    setCurrentTrackIndex(trackIndex);
    setIsBuffering(true);

    const playlistTracks = tracks
      .filter(t => t.audioUrl)
      .map(t => ({
        id: t.id,
        title: t.title,
        artist: t.artist,
        artistId: t.artistId,
        coverImageUrl: t.coverImageUrl || playlistData.coverImageUrl,
        audioUrl: t.audioUrl,
        duration: t.duration,
        playCount: 0
      }));

    const playlistIndex = playlistTracks.findIndex(song => song.id === track.id);

    if (playlistIndex >= 0) {
      playSong(playlistTracks[playlistIndex], false, playlistTracks, playlistIndex, `playlist-${playlistData.id}`, null);

      // Track playlist play for contribution rewards (only if not the owner)
      if (user?.id && playlistData.userId && user.id !== playlistData.userId) {
        trackPlaylistPlayed(playlistData.userId, playlistData.id, user.id).catch(console.error);
      }

      setTimeout(() => {
        hideFullPlayer();
        setIsBuffering(false);
      }, 200);
    }
  };

  const playNextTrack = () => {
    globalPlayNext();
  };

  const playPreviousTrack = () => {
    globalPlayPrevious();
  };

  const handleToggleShuffle = () => {
    globalToggleShuffle();
  };

  const handleToggleRepeat = () => {
    globalToggleRepeat();
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

  const handleDownloadTrack = async () => {
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
          album: playlistData.title,
          duration: formatTime(currentTrack.duration),
          audioUrl: currentTrack.audioUrl,
          coverImageUrl: currentTrack.coverImageUrl || playlistData.coverImageUrl || undefined,
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

  const handleSharePlaylist = async () => {
    try {
      await recordShareEvent(playlistData.id, 'playlist');
    } catch (error) {
      console.error('Error recording share event:', error);
    }

    try {
      await sharePlaylist(playlistData.id, playlistData.title);
    } catch (error) {
      console.error('Error sharing playlist:', error);
    }
  };

  const handleDeletePlaylist = async () => {
    if (!playlistData.isOwner) {
      alert('You can only delete your own playlists');
      return;
    }

    const confirmed = confirm(`Are you sure you want to delete "${playlistData.title}"? This action cannot be undone.`);
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('playlists')
        .delete()
        .eq('id', playlistData.id);

      if (error) throw error;

      alert('Playlist deleted successfully');
      navigate('/library');
    } catch (error) {
      console.error('Error deleting playlist:', error);
      alert('Failed to delete playlist');
    }
  };

  const handleRemoveTrackFromPlaylist = async (trackId: string, e: React.MouseEvent) => {
    e.stopPropagation();

    if (!playlistData.isOwner) {
      alert('You can only remove tracks from your own playlists');
      return;
    }

    const confirmed = confirm('Remove this track from the playlist?');
    if (!confirmed) return;

    try {
      const { error } = await supabase
        .from('playlist_songs')
        .delete()
        .eq('playlist_id', playlistData.id)
        .eq('song_id', trackId);

      if (error) throw error;

      const updatedTracks = tracks.filter(track => track.id !== trackId);
      setTracks(updatedTracks);

      if (updatedTracks.length === 0) {
        alert('Playlist is now empty');
      }

      alert('Track removed from playlist');
    } catch (error) {
      console.error('Error removing track:', error);
      alert('Failed to remove track');
    }
  };

  const handleClose = () => {
    hideFullPlayer();

    onPlayerVisibilityChange?.(false);
    window.dispatchEvent(new CustomEvent('playlistPlayerVisibilityChange', {
      detail: { isVisible: false }
    }));

    navigate(-1);
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

  const downloadProgress = currentTrack ? getDownloadProgress(currentTrack.id) : null;
  const trackIsDownloaded = currentTrack ? isDownloaded(currentTrack.id) : false;

  // Removed redundant loading state - handled by parent component

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-[#1a1a1a] via-[#0d0d0d] to-[#000000] animate-in fade-in duration-300 touch-manipulation overflow-y-auto pb-[140px]">
      {/* Close Button */}
      <div className="absolute top-4 left-4 z-20">
        <button
          onClick={handleClose}
          className="p-2 bg-black/50 hover:bg-white/10 rounded-full transition-all active:scale-95 backdrop-blur-sm"
          aria-label="Close player"
        >
          <X className="w-6 h-6 text-white" />
        </button>
      </div>

      {/* Edit/Delete Buttons for Owner */}
      {playlistData.isOwner && (
        <div className="absolute top-4 right-4 z-20 flex items-center gap-2">
          <button
            onClick={() => setShowEditPlaylistModal(true)}
            className="p-2 bg-black/50 hover:bg-white/10 rounded-full transition-all active:scale-95 backdrop-blur-sm"
            aria-label="Edit playlist"
          >
            <Edit className="w-5 h-5 text-white" />
          </button>
          <button
            onClick={handleDeletePlaylist}
            className="p-2 bg-black/50 hover:bg-red-500/20 rounded-full transition-all active:scale-95 backdrop-blur-sm"
            aria-label="Delete playlist"
          >
            <Trash2 className="w-5 h-5 text-red-400" />
          </button>
        </div>
      )}

      {/* Main Content */}
      <div className="flex-1 flex flex-col px-5 py-6 pt-16">
        {/* Playlist Artwork */}
        <div className="w-full max-w-[280px] mx-auto mb-4">
          <div className="relative aspect-square rounded-3xl overflow-hidden shadow-2xl">
            {playlistData.coverImageUrl ? (
              <img
                src={playlistData.coverImageUrl}
                alt={playlistData.title}
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

        {/* Playlist Information */}
        <div className="text-center mb-6 w-full max-w-sm mx-auto">
          <h1 className="font-bold text-white text-2xl mb-1 truncate px-2">
            {playlistData.title}
          </h1>
          {playlistData.description && (
            <p className="text-white/60 text-sm mb-2 px-2 line-clamp-2">
              {playlistData.description}
            </p>
          )}
          <p className="text-white/40 text-sm">
            {tracks?.length} tracks • {formatDuration(playlistData.totalDuration)}
          </p>
        </div>

        {/* Playback Controls */}
        <div className="flex items-center justify-center gap-4 w-full max-w-sm mx-auto mb-8">
          <button
            onClick={handleToggleShuffle}
            className={`p-2.5 rounded-full transition-all active:scale-95 ${
              globalIsShuffleEnabled
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
              globalRepeatMode !== 'off'
                ? 'text-white bg-white/20'
                : 'text-white/50 hover:text-white/70 hover:bg-white/10'
            }`}
            aria-label={`Repeat ${globalRepeatMode}`}
          >
            <Repeat className="w-5 h-5" />
            {globalRepeatMode === 'one' && (
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
              onClick={handleDownloadTrack}
              disabled={isDownloadInProgress || !currentTrack?.audioUrl}
              className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 transition-all disabled:opacity-50"
            >
              <div className={`w-11 h-11 rounded-full flex items-center justify-center ${
                trackIsDownloaded ? 'bg-[#309605]/20' : 'bg-white/10'
              }`}>
                {isDownloadInProgress || downloadProgress ? (
                  <LoadingLogo variant="pulse" size={20} />
                ) : (
                  <Download className={`w-5 h-5 ${trackIsDownloaded ? 'text-[#309605]' : 'text-white'}`} />
                )}
              </div>
              <span className="text-white/70 text-[10px] font-medium">
                {trackIsDownloaded ? 'Saved' : 'Download'}
              </span>
            </button>

            <button
              onClick={handleSharePlaylist}
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
                        className="p-1.5 rounded-full transition-all"
                      >
                        <Heart className={`w-4 h-4 transition-all duration-[50ms] ${track.isFavorited ? 'text-red-500 fill-red-500' : 'text-white'}`} />
                      </button>
                    )}

                    {playlistData.isOwner && (
                      <button
                        onClick={(e) => handleRemoveTrackFromPlaylist(track.id, e)}
                        className="p-1.5 hover:bg-red-500/20 rounded-full transition-all opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    )}

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
                  <p className="text-white/50">No tracks in this playlist</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {showCommentsModal && (
        <CommentsModal
          contentId={playlistData.id}
          contentType="playlist"
          contentTitle={playlistData.title}
          onClose={() => {
            setShowCommentsModal(false);
            loadCommentCount();
          }}
        />
      )}

      {showReportModal && (
        <ReportModal
          contentType="playlist"
          contentId={playlistData.id}
          contentTitle={playlistData.title}
          reportedUserId={playlistData.userId}
          onClose={() => setShowReportModal(false)}
          onSuccess={() => {
            setShowReportModal(false);
          }}
        />
      )}

      {showEditPlaylistModal && (
        <EditPlaylistModal
          playlistId={playlistData.id}
          onClose={() => setShowEditPlaylistModal(false)}
          onSuccess={() => {
            setShowEditPlaylistModal(false);
            window.location.reload();
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

export const PlaylistPlayerScreen: React.FC<PlaylistPlayerScreenProps> = ({ onPlayerVisibilityChange, onOpenMusicPlayer }) => {
  const { playlistId } = useParams<{ playlistId: string }>();
  const navigate = useNavigate();
  const [playlistData, setPlaylistData] = useState<PlaylistData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!playlistId) {
      setError('Playlist ID is required');
      return;
    }

    onPlayerVisibilityChange?.(true);

    // Try to load from cache first for instant display
    const cached = playlistCache.get(playlistId);
    if (cached) {
      setPlaylistData(cached);
      // Refresh in background
      loadPlaylistData();
    } else {
      // Load immediately if not cached
      loadPlaylistData();
    }

    return () => {
      onPlayerVisibilityChange?.(false);
    };
  }, [playlistId]);

  const loadCuratedMixData = async (mixData: any, currentUserId?: string) => {
    try {
      const { data: mixDetails } = await supabase.rpc('get_mix_with_song_details', {
        mix_id: mixData.id
      });

      if (!mixDetails || !mixDetails.songs || mixDetails.songs.length === 0) {
        throw new Error('This mix does not contain any songs');
      }

      const { data: userData } = await supabase
        .from('users')
        .select('id, display_name, avatar_url')
        .eq('id', mixData.created_by)
        .maybeSingle();

      const tracks: PlaylistTrack[] = mixDetails.songs.map((song: any, index: number) => ({
        id: song.id,
        title: song.title || 'Untitled Track',
        artist: song.artist || 'Unknown Artist',
        artistId: null,
        duration: song.duration || 0,
        audioUrl: song.audio_url || null,
        coverImageUrl: song.cover_url || mixData.cover_image_url,
        trackNumber: index + 1,
        featuredArtists: [],
        playCount: song.play_count || 0,
        addedAt: mixData.created_at
      }));

      const totalDuration = tracks.reduce((sum, track) => sum + track.duration, 0);
      const playableTracks = tracks.filter(track => track.audioUrl);

      if (playableTracks.length === 0) {
        throw new Error('This mix does not contain any playable tracks');
      }

      const playlist: PlaylistData = {
        id: mixData.id,
        title: mixData.title,
        description: mixData.description,
        coverImageUrl: mixData.cover_image_url || null,
        userId: mixData.created_by,
        userName: userData?.display_name || 'Airaplay Admin',
        userAvatar: userData?.avatar_url,
        tracks: playableTracks,
        totalDuration,
        createdAt: mixData.created_at,
        updatedAt: mixData.updated_at,
        isOwner: currentUserId === mixData.created_by
      };

      setPlaylistData(playlist);
    } catch (err) {
      console.error('Failed to load curated mix:', err);
      throw err;
    }
  };

  const loadMixData = async (mixInfo: any, currentUserId?: string) => {
    try {
      const { data: userData } = await supabase
        .from('users')
        .select('id, display_name, avatar_url')
        .eq('id', mixInfo.user_id)
        .single();

      // Extract songs from mix metadata
      const tracks: PlaylistTrack[] = [];
      if (mixInfo.metadata?.song_details && Array.isArray(mixInfo.metadata.song_details)) {
        mixInfo.metadata.song_details.forEach((song: any, index: number) => {
          tracks.push({
            id: song.id,
            title: song.title || 'Untitled Track',
            artist: song.artist || 'Unknown Artist',
            artistId: null,
            duration: song.duration || 0,
            audioUrl: song.audio_url || null,
            coverImageUrl: song.cover_url || mixInfo.metadata?.cover_url,
            trackNumber: index + 1,
            featuredArtists: [],
            playCount: 0,
            addedAt: mixInfo.created_at
          });
        });
      } else if (mixInfo.metadata?.songs && Array.isArray(mixInfo.metadata.songs)) {
        // Fallback: fetch song IDs from metadata
        const songIds = mixInfo.metadata.songs;
        const { data: songsData } = await supabase
          .from('songs')
          .select(`
            id,
            title,
            artist_id,
            cover_image_url,
            audio_url,
            duration_seconds,
            artists:artist_id (
              name
            )
          `)
          .in('id', songIds);

        if (songsData) {
          songsData.forEach((song: any, index: number) => {
            const artistName = Array.isArray(song.artists)
              ? song.artists[0]?.name || 'Unknown Artist'
              : song.artists?.name || 'Unknown Artist';

            tracks.push({
              id: song.id,
              title: song.title,
              artist: artistName,
              artistId: song.artist_id,
              duration: song.duration_seconds || 0,
              audioUrl: song.audio_url,
              coverImageUrl: song.cover_image_url,
              trackNumber: index + 1,
              featuredArtists: [],
              playCount: 0,
              addedAt: mixInfo.created_at
            });
          });
        }
      }

      const totalDuration = tracks.reduce((sum, track) => sum + track.duration, 0);

      // Filter out tracks without audio URLs
      const playableTracks = tracks.filter(track => track.audioUrl);

      if (playableTracks.length === 0 && tracks.length > 0) {
        throw new Error('This mix does not contain any playable tracks. The audio files may be missing or not properly configured.');
      }

      const playlist: PlaylistData = {
        id: mixInfo.id,
        title: mixInfo.title,
        description: mixInfo.description,
        coverImageUrl: mixInfo.metadata?.cover_url || null,
        userId: mixInfo.user_id,
        userName: userData?.display_name || 'Mix Creator',
        userAvatar: userData?.avatar_url,
        tracks: playableTracks.length > 0 ? playableTracks : tracks,
        totalDuration,
        createdAt: mixInfo.created_at,
        updatedAt: mixInfo.updated_at,
        isOwner: currentUserId === mixInfo.user_id
      };

      setPlaylistData(playlist);
    } catch (err) {
      console.error('Failed to load mix:', err);
      throw err;
    }
  };

  const loadPlaylistData = async () => {
    if (!playlistId) return;

    try {
      setError(null);

      const { data: { session } } = await supabase.auth.getSession();
      const currentUserId = session?.user?.id;

      // Try to load from playlists table first
      const { data: playlistInfo, error: playlistError } = await supabase
        .from('playlists')
        .select(`
          id,
          title,
          description,
          cover_image_url,
          user_id,
          created_at,
          updated_at
        `)
        .eq('id', playlistId)
        .maybeSingle();

      // If not found in playlists, try curated_mixes (admin mixes)
      if (!playlistInfo) {
        const { data: curatedMix, error: curatedMixError } = await supabase
          .from('curated_mixes')
          .select('*')
          .eq('id', playlistId)
          .maybeSingle();

        if (!curatedMixError && curatedMix) {
          await loadCuratedMixData(curatedMix, currentUserId);
          return;
        }

        // Fallback to old content_uploads format
        const { data: mixInfo, error: mixError } = await supabase
          .from('content_uploads')
          .select(`
            id,
            title,
            description,
            metadata,
            user_id,
            created_at,
            updated_at
          `)
          .eq('id', playlistId)
          .eq('content_type', 'mix')
          .eq('status', 'approved')
          .maybeSingle();

        if (mixError) throw mixError;
        if (!mixInfo) throw new Error('Playlist or mix not found');

        // Handle admin mix format
        await loadMixData(mixInfo, currentUserId);
        return;
      }

      if (playlistError) throw playlistError;

      // Fetch user data and songs in parallel for instant display
      const [userResult, songsResult] = await Promise.all([
        supabase
          .from('users')
          .select('id, display_name, avatar_url')
          .eq('id', playlistInfo.user_id)
          .maybeSingle(),
        supabase
          .from('playlist_songs')
          .select(`
            song_id,
            added_at,
            songs:song_id (
              id,
              title,
              artist_id,
              cover_image_url,
              audio_url,
              duration_seconds,
              play_count,
              artists:artist_id (
                name
              )
            )
          `)
          .eq('playlist_id', playlistId)
          .order('added_at', { ascending: true })
      ]);

      if (songsResult.error) throw songsResult.error;

      const userData = userResult.data;
      const playlistSongs = songsResult.data;

      const tracks: PlaylistTrack[] = (playlistSongs || [])
        .filter(ps => ps.songs)
        .map((ps: any, index) => {
          const song = ps.songs;
          const artistName = Array.isArray(song.artists)
            ? song.artists[0]?.name || 'Unknown Artist'
            : song.artists?.name || 'Unknown Artist';

          return {
            id: song.id,
            title: song.title,
            artist: artistName,
            artistId: song.artist_id,
            duration: song.duration_seconds || 0,
            audioUrl: song.audio_url,
            coverImageUrl: song.cover_image_url,
            trackNumber: index + 1,
            featuredArtists: [],
            playCount: song.play_count || 0,
            addedAt: ps.added_at
          };
        });

      const totalDuration = tracks.reduce((sum, track) => sum + track.duration, 0);

      // Filter out tracks without audio URLs
      const playableTracks = tracks.filter(track => track.audioUrl);

      if (playableTracks.length === 0 && tracks.length > 0) {
        throw new Error('This playlist does not contain any playable tracks. The audio files may be missing or not properly configured.');
      }

      const playlist: PlaylistData = {
        id: playlistInfo.id,
        title: playlistInfo.title,
        description: playlistInfo.description,
        coverImageUrl: playlistInfo.cover_image_url,
        userId: playlistInfo.user_id,
        userName: userData?.display_name || 'Unknown User',
        userAvatar: userData?.avatar_url,
        tracks: playableTracks.length > 0 ? playableTracks : tracks,
        totalDuration,
        createdAt: playlistInfo.created_at,
        updatedAt: playlistInfo.updated_at,
        isOwner: currentUserId === playlistInfo.user_id
      };

      setPlaylistData(playlist);

      // Cache the loaded data for instant future access
      playlistCache.set(playlistId, playlist);
    } catch (err) {
      console.error('Failed to load playlist:', err);
      setError(err instanceof Error ? err.message : 'Playlist not found');
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
          <h3 className="font-bold text-white text-xl mb-4">Playlist Not Found</h3>
          <p className="text-white/70 text-sm mb-6">
            {error || 'The playlist you\'re looking for doesn\'t exist or has been removed.'}
          </p>
          <button
            onClick={() => navigate(-1)}
            className="w-full bg-[#309605] hover:bg-[#3ba208] text-white font-semibold py-3 px-6 rounded-xl transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  const handleShowAuthModal = () => {
    window.dispatchEvent(new CustomEvent('openAuthModal'));
  };

  // Show loading skeleton while fetching playlist data
  if (!playlistData) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-gradient-to-b from-[#1a1a1a] via-[#0d0d0d] to-[#000000] animate-in fade-in duration-300 touch-manipulation overflow-y-auto pb-[140px]">
        <div className="flex-1 flex flex-col px-5 py-6 pt-16">
          {/* Playlist Artwork Skeleton */}
          <div className="w-full max-w-[280px] mx-auto mb-4">
            <div className="aspect-square rounded-3xl bg-white/5 animate-pulse" />
          </div>

          {/* Playlist Information Skeleton */}
          <div className="text-center mb-6 w-full max-w-sm mx-auto space-y-2">
            <div className="h-8 bg-white/5 rounded-xl animate-pulse mx-auto w-3/4" />
            <div className="h-4 bg-white/5 rounded-xl animate-pulse mx-auto w-1/2" />
            <div className="h-4 bg-white/5 rounded-xl animate-pulse mx-auto w-1/3" />
          </div>

          {/* Playback Controls Skeleton */}
          <div className="flex items-center justify-center gap-4 w-full max-w-sm mx-auto mb-8">
            <div className="w-10 h-10 bg-white/5 rounded-full animate-pulse" />
            <div className="w-12 h-12 bg-white/5 rounded-full animate-pulse" />
            <div className="w-16 h-16 bg-white/5 rounded-full animate-pulse" />
            <div className="w-12 h-12 bg-white/5 rounded-full animate-pulse" />
            <div className="w-10 h-10 bg-white/5 rounded-full animate-pulse" />
          </div>

          {/* Social Actions Grid Skeleton */}
          <div className="w-full max-w-sm mx-auto mb-6">
            <div className="grid grid-cols-4 gap-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-white/5 animate-pulse">
                  <div className="w-11 h-11 rounded-full bg-white/10" />
                  <div className="h-3 w-12 bg-white/10 rounded" />
                </div>
              ))}
            </div>
          </div>

          {/* Track List Skeleton */}
          <div className="w-full max-w-sm mx-auto">
            <div className="flex items-center justify-between mb-4 px-2">
              <div className="h-6 w-20 bg-white/5 rounded animate-pulse" />
              <div className="h-5 w-16 bg-white/5 rounded animate-pulse" />
            </div>
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="h-16 bg-white/5 rounded-2xl animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <PlaylistPlayer
      playlistData={playlistData}
      autoPlay={false}
      startTrackIndex={0}
      onPlayerVisibilityChange={onPlayerVisibilityChange}
      onShowAuthModal={handleShowAuthModal}
      onOpenMusicPlayer={onOpenMusicPlayer}
    />
  );
};
