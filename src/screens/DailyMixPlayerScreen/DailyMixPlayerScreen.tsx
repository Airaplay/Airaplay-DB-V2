import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Play, Music, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useMusicPlayer } from '../../contexts/MusicPlayerContext';
import { LazyImage } from '../../components/LazyImage';
import { recordMixPlay } from '../../lib/dailyMixGenerator';

interface DailyMix {
  id: string;
  mix_number: number;
  title: string;
  description: string;
  genre_focus: string | null;
  mood_focus: string | null;
  track_count: number;
  tracks: Array<{
    song_id: string;
    position: number;
    explanation: string;
    recommendation_type: string;
    is_familiar: boolean;
    songs: {
      id: string;
      title: string;
      artist_id: string;
      cover_image_url: string | null;
      duration_seconds: number;
      audio_url: string | null;
      play_count: number;
    };
  }>;
}

interface SongWithArtist {
  id: string;
  title: string;
  artist: string;
  artistId: string;
  coverImageUrl: string | null;
  audioUrl: string | null;
  duration: number;
  playCount: number;
  position: number;
  explanation: string;
  isFamiliar: boolean;
}

export const DailyMixPlayerScreen: React.FC = () => {
  const { mixId } = useParams<{ mixId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { playSong, currentSong, isPlaying: contextIsPlaying } = useMusicPlayer();

  const [mix, setMix] = useState<DailyMix | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [songs, setSongs] = useState<SongWithArtist[]>([]);
  const [isMiniPlayerActive, setIsMiniPlayerActive] = useState(false);

  const displayTitle = useMemo(() => {
    if (!mix) return '';
    if (mix.genre_focus && mix.genre_focus !== 'Discovery') {
      return `Your ${mix.genre_focus} Mix`;
    }
    if (mix.mood_focus) {
      return `${mix.mood_focus} Vibes`;
    }
    const uniqueArtists = [...new Set(songs.map(s => s.artist).filter(a => a && a !== 'Unknown Artist'))];
    if (uniqueArtists.length === 1) return `${uniqueArtists[0]} Radio`;
    if (uniqueArtists.length === 2) return `${uniqueArtists[0]} & ${uniqueArtists[1]}`;
    if (uniqueArtists.length > 2) return `${uniqueArtists[0]} & Friends`;
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) return 'Morning Mix';
    if (hour >= 12 && hour < 17) return 'Afternoon Mix';
    if (hour >= 17 && hour < 21) return 'Evening Mix';
    return 'Night Mix';
  }, [mix, songs]);

  useEffect(() => {
    if (mixId && user) {
      loadMix();
    }
  }, [mixId, user]);

  useEffect(() => {
    const checkMiniPlayer = () => {
      setIsMiniPlayerActive(document.body.classList.contains('mini-player-active'));
    };

    checkMiniPlayer();

    const observer = new MutationObserver(checkMiniPlayer);
    observer.observe(document.body, {
      attributes: true,
      attributeFilter: ['class']
    });

    return () => observer.disconnect();
  }, []);

  const loadMix = async () => {
    if (!mixId || !user) return;

    try {
      setIsLoading(true);
      setError(null);

      const { data: mixData, error: mixError } = await supabase
        .from('daily_mix_playlists')
        .select('*')
        .eq('id', mixId)
        .eq('user_id', user.id)
        .single();

      if (mixError) throw mixError;

      // Use raw SQL to get tracks with artist names in one query
      const { data: tracksData, error: tracksError } = await supabase.rpc('get_daily_mix_tracks_with_artists', {
        p_mix_id: mixId
      });

      if (tracksError) {
        // Fallback to original method if function doesn't exist
        console.log('Using fallback query method');
        const { data: fallbackTracks, error: fallbackError } = await supabase
          .from('daily_mix_tracks')
          .select(`
            song_id,
            position,
            explanation,
            recommendation_type,
            is_familiar,
            songs (
              id,
              title,
              artist_id,
              cover_image_url,
              duration_seconds,
              audio_url,
              play_count
            )
          `)
          .eq('mix_id', mixId)
          .order('position');

        if (fallbackError) throw fallbackError;

        setMix({
          ...mixData,
          tracks: fallbackTracks || []
        });

        // Fetch artist names from artists table
        const artistIds = [...new Set(fallbackTracks?.map(t => t.songs.artist_id).filter(Boolean) || [])];
        const artistNames = new Map<string, string>();

        if (artistIds.length > 0) {
          const { data: artists } = await supabase
            .from('artists')
            .select('id, name')
            .in('id', artistIds);

          if (artists) {
            artists.forEach(a => {
              if (a.name) {
                artistNames.set(a.id, a.name);
              }
            });
          }
        }

        const songsWithArtists: SongWithArtist[] = (fallbackTracks || []).map(t => {
          const artistName = t.songs.artist_id
            ? (artistNames.get(t.songs.artist_id) || 'Unknown Artist')
            : 'Unknown Artist';

          return {
            id: t.songs.id,
            title: t.songs.title,
            artist: artistName,
            artistId: t.songs.artist_id,
            coverImageUrl: t.songs.cover_image_url,
            audioUrl: t.songs.audio_url,
            duration: t.songs.duration_seconds,
            playCount: t.songs.play_count || 0,
            position: t.position,
            explanation: t.explanation,
            isFamiliar: t.is_familiar
          };
        });

        setSongs(songsWithArtists);
        return;
      }

      setMix({
        ...mixData,
        tracks: tracksData || []
      });

      const songsWithArtists: SongWithArtist[] = (tracksData || []).map((t: any) => ({
        id: t.song_id,
        title: t.title,
        artist: t.artist_name,
        artistId: t.artist_id,
        coverImageUrl: t.cover_image_url,
        audioUrl: t.audio_url,
        duration: t.duration_seconds,
        playCount: t.play_count || 0,
        position: t.track_position,
        explanation: t.explanation,
        isFamiliar: t.is_familiar
      }));

      setSongs(songsWithArtists);

      recordMixPlay(user.id, mixData.mix_number).catch(console.error);
    } catch (err) {
      console.error('Error loading mix:', err);
      setError('Failed to load daily mix');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePlayMix = () => {
    if (songs.length === 0) return;

    const firstSong = songs[0];
    const playlist = songs.map(s => ({
      id: s.id,
      title: s.title,
      artist: s.artist,
      artistId: s.artistId,
      coverImageUrl: s.coverImageUrl,
      audioUrl: s.audioUrl,
      duration: s.duration,
      playCount: s.playCount
    }));

    playSong(
      playlist[0],
      false,
      playlist,
      0,
      `Daily Mix ${mix?.mix_number || ''}`,
      null
    );
  };

  const handlePlaySong = (song: SongWithArtist, index: number) => {
    const playlist = songs.map(s => ({
      id: s.id,
      title: s.title,
      artist: s.artist,
      artistId: s.artistId,
      coverImageUrl: s.coverImageUrl,
      audioUrl: s.audioUrl,
      duration: s.duration,
      playCount: s.playCount
    }));

    playSong(
      playlist[index],
      false,
      playlist,
      index,
      `Daily Mix ${mix?.mix_number || ''}`,
      null
    );
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatPlayCount = (count: number): string => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-[#0a0a0a] via-[#0d0d0d] to-[#111111]">
      {/* Header - Fixed at top */}
      <div className="sticky top-0 z-10 bg-gradient-to-b from-[#0a0a0a] to-transparent backdrop-blur-md">
        <div className="flex items-center justify-between p-4 pt-[calc(env(safe-area-inset-top,0px)+1rem)]">
          <button
            onClick={() => navigate(-1)}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-white/10 hover:bg-white/20 active:bg-white/30 rounded-full transition-all active:scale-95"
            aria-label="Go back"
          >
            <ArrowLeft className="w-6 h-6 text-white" strokeWidth={2.5} />
          </button>
          <h1 className="font-['Inter',sans-serif] font-bold text-white text-xl">
            Daily Mix
          </h1>
          <div className="w-[44px]" />
        </div>
      </div>

      {/* Scrollable Content Container */}
      <div
        className="flex-1 overflow-y-auto px-4 pb-4"
        style={{
          paddingBottom: isMiniPlayerActive
            ? 'calc(8.5rem + env(safe-area-inset-bottom, 0px))'
            : 'calc(4rem + env(safe-area-inset-bottom, 0px))'
        }}
      >
        {isLoading ? (
          <div className="flex flex-col gap-6 py-4">
            {/* Loading Mix Header */}
            <div className="flex flex-col gap-4 bg-gradient-to-br from-[#00ad74]/10 to-[#009c68]/5 rounded-2xl p-6">
              <div className="h-6 w-32 bg-white/5 rounded animate-pulse" />
              <div className="h-8 w-3/4 bg-white/5 rounded animate-pulse" />
              <div className="h-4 w-full bg-white/5 rounded animate-pulse" />
              <div className="h-10 w-32 bg-white/5 rounded-lg animate-pulse mt-2" />
            </div>

            {/* Loading Track List */}
            <div className="flex flex-col gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="h-16 bg-white/5 rounded-xl animate-pulse" />
              ))}
            </div>
          </div>
        ) : error || !mix ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Sparkles className="w-16 h-16 text-white/40 mb-4" />
            <p className="font-['Inter',sans-serif] text-white/60 text-base mb-6">
              {error || 'Mix not found'}
            </p>
            <button
              onClick={() => navigate('/')}
              className="px-6 py-3 bg-[#00ad74] hover:bg-[#009c68] active:bg-[#008a5d] text-white rounded-xl font-medium transition-all active:scale-95"
            >
              Go Home
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-6 py-4">
            {/* Mix Header Card */}
            <div className="relative overflow-hidden rounded-2xl">
              {/* Background: Artist image collage */}
              <div className="absolute inset-0 z-0">
                {songs.length > 0 && songs.some(s => s.coverImageUrl) ? (
                  <div className="grid grid-cols-2 grid-rows-2 w-full h-full">
                    {songs
                      .filter(s => s.coverImageUrl)
                      .slice(0, 4)
                      .map((s, idx) => (
                        <img
                          key={idx}
                          src={s.coverImageUrl!}
                          alt=""
                          className="w-full h-full object-cover"
                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                        />
                      ))}
                  </div>
                ) : null}
                <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/70 to-black/90" />
              </div>

              <div className="relative z-10 p-6 pb-7 min-h-[200px] flex flex-col justify-end">
                <button
                  onClick={handlePlayMix}
                  className="absolute top-5 right-5 w-12 h-12 rounded-full bg-[#00ad74] hover:bg-[#009c68] active:bg-[#008a5d] flex items-center justify-center shadow-lg shadow-[#00ad74]/30 transition-all active:scale-90"
                  aria-label="Play all"
                >
                  <Play className="w-5 h-5 text-white ml-0.5" fill="white" />
                </button>

                <h2 className="font-['Inter',sans-serif] font-bold text-white text-2xl leading-tight mb-2">
                  {displayTitle}
                </h2>

                <p className="font-['Inter',sans-serif] text-white/70 text-sm leading-relaxed mb-3 max-w-[85%]">
                  {mix.description}
                </p>

                <div className="flex items-center gap-2 text-white/50 text-xs font-['Inter',sans-serif]">
                  <Music className="w-3.5 h-3.5" />
                  <span>{songs.length} tracks</span>
                  <span className="mx-1">·</span>
                  <span>Personalized for you</span>
                </div>
              </div>
            </div>

            {/* Track List */}
            <div className="flex flex-col gap-2">
              <h4 className="font-['Inter',sans-serif] font-semibold text-white text-sm px-1 mb-1">
                Tracks
              </h4>

              {songs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <Music className="w-12 h-12 text-white/40 mb-3" />
                  <p className="font-['Inter',sans-serif] text-white/60 text-sm">
                    No songs in this mix
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {songs.map((song, index) => {
                    const isCurrentTrack = currentSong?.id === song.id;
                    const isPlayingTrack = isCurrentTrack && contextIsPlaying;

                    return (
                      <div
                        key={song.id}
                        className={`group rounded-xl p-4 transition-all cursor-pointer ${
                          isCurrentTrack
                            ? 'bg-white/15'
                            : 'bg-white/5 hover:bg-white/10 active:bg-white/15'
                        }`}
                        onClick={() => handlePlaySong(song, index)}
                      >
                        <div className="flex items-center gap-3">
                          {/* Track Number / Play Icon */}
                          <div className="w-8 h-8 flex items-center justify-center flex-shrink-0">
                            <span className={`font-['Inter',sans-serif] text-sm group-hover:hidden ${
                              isCurrentTrack ? 'text-white font-semibold' : 'text-white/60'
                            }`}>
                              {song.position}
                            </span>
                            <Play
                              className="w-4 h-4 hidden group-hover:block text-white"
                              fill="white"
                            />
                          </div>

                          {/* Cover Image */}
                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-white/5 flex-shrink-0 shadow">
                            {song.coverImageUrl ? (
                              <LazyImage
                                src={song.coverImageUrl}
                                alt={song.title}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Music className="w-5 h-5 text-white/40" />
                              </div>
                            )}
                          </div>

                          {/* Song Info */}
                          <div className="flex-1 flex flex-col gap-0.5 min-w-0">
                            <p className={`font-['Inter',sans-serif] font-medium text-sm truncate leading-tight ${
                              isCurrentTrack ? 'text-white' : 'text-white'
                            }`}>
                              {song.title}
                            </p>
                            <span className="font-['Inter',sans-serif] text-white/60 text-xs truncate">
                              {song.artist}
                            </span>
                          </div>

                          {/* Duration */}
                          <span className="font-['Inter',sans-serif] text-white/60 text-xs flex-shrink-0">
                            {formatDuration(song.duration)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
