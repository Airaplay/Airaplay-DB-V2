import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../../../lib/supabase';
import { useAuth } from '../../../../contexts/AuthContext';
import { ScrollArea, ScrollBar } from '../../../../components/ui/scroll-area';

interface DailyMix {
  id: string;
  mix_number: number;
  title: string;
  description: string;
  genre_focus: string | null;
  mood_focus: string | null;
  cover_image_url: string | null;
  track_count: number;
  generated_at: string;
  artist_images?: string[];
  display_title?: string;
}

export const DailyMixSection: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [mixes, setMixes] = useState<DailyMix[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const refreshIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadDailyMixes = useCallback(async (autoGenerate = true) => {
    if (!user) return;

    try {
      setIsLoading(true);
      const { data: mixesData, error } = await supabase
        .from('daily_mix_playlists')
        .select('id, mix_number, title, description, genre_focus, mood_focus, cover_image_url, track_count, generated_at')
        .eq('user_id', user.id)
        .gt('expires_at', new Date().toISOString())
        .order('mix_number');

      if (error) throw error;

      if (!mixesData || mixesData.length === 0) {
        setMixes([]);
        // Automatically generate mixes in the background if none exist
        if (autoGenerate && !isGenerating) {
          setIsGenerating(true);
          try {
            const { generateDailyMixesForUser } = await import('../../../../lib/dailyMixGenerator');
            await generateDailyMixesForUser(user.id, true);
            // Reload without auto-generation to prevent infinite loop
            await loadDailyMixes(false);
          } catch (genError) {
            console.error('Error generating mixes:', genError);
          } finally {
            setIsGenerating(false);
          }
        }
        return;
      }

      // Fetch artist images and names for each mix
      const enrichedMixes = await Promise.all(
        mixesData.map(async (mix) => {
          try {
            // Get songs in this mix with artist info, genres, and moods
            const { data: mixTracks, error: tracksError } = await supabase
              .from('daily_mix_tracks')
              .select(`
                song_id,
                songs!inner(
                  id,
                  title,
                  artist_id,
                  cover_image_url,
                  artists:artist_id(
                    id,
                    display_name,
                    avatar_url,
                    artist_profiles(
                      stage_name,
                      profile_image_url
                    )
                  )
                )
              `)
              .eq('mix_id', mix.id)
              .limit(10);

            const artistImages: string[] = [];
            const artistNames: string[] = [];
            const songImages: string[] = [];

            if (mixTracks && mixTracks.length > 0) {
              mixTracks.forEach((track: any) => {
                const song = track.songs;
                if (song) {
                  // Collect artist images and names
                  if (song.artists) {
                    const artist = song.artists;
                    const profile = artist.artist_profiles?.[0];
                    const imageUrl = profile?.profile_image_url || artist.avatar_url;
                    const artistName = profile?.stage_name || artist.display_name;

                    if (imageUrl && !artistImages.includes(imageUrl)) {
                      artistImages.push(imageUrl);
                    }
                    if (artistName && !artistNames.includes(artistName)) {
                      artistNames.push(artistName);
                    }
                  }

                  // Also collect song cover images as fallback
                  if (song.cover_image_url && !songImages.includes(song.cover_image_url)) {
                    songImages.push(song.cover_image_url);
                  }
                }
              });
            }

            // Use artist images if available, otherwise fall back to song cover images
            const displayImages = artistImages.length > 0 ? artistImages : songImages;

            let displayTitle = '';

            if (mix.genre_focus && mix.genre_focus !== 'Discovery') {
              displayTitle = `Your ${mix.genre_focus} Mix`;
            } else if (mix.mood_focus) {
              displayTitle = `${mix.mood_focus} Vibes`;
            } else if (artistNames.length > 0) {
              if (artistNames.length === 1) {
                displayTitle = `${artistNames[0]} Radio`;
              } else if (artistNames.length === 2) {
                displayTitle = `${artistNames[0]} & ${artistNames[1]}`;
              } else {
                displayTitle = `${artistNames[0]} & Friends`;
              }
            } else {
              const hour = new Date().getHours();
              if (hour >= 5 && hour < 12) {
                displayTitle = 'Morning Mix';
              } else if (hour >= 12 && hour < 17) {
                displayTitle = 'Afternoon Mix';
              } else if (hour >= 17 && hour < 21) {
                displayTitle = 'Evening Mix';
              } else {
                displayTitle = 'Night Mix';
              }
            }

            return {
              ...mix,
              artist_images: displayImages.slice(0, 4),
              display_title: displayTitle
            };
          } catch (err) {
            console.error('Error enriching mix:', err);
            return {
              ...mix,
              artist_images: [],
              display_title: mix.genre_focus || mix.mood_focus || 'Your Mix'
            };
          }
        })
      );

      setMixes(enrichedMixes);
    } catch (error) {
      console.error('Error loading daily mixes:', error);
    } finally {
      setIsLoading(false);
    }
  }, [user, isGenerating]);

  useEffect(() => {
    if (user) {
      loadDailyMixes();
    }

    refreshIntervalRef.current = setInterval(() => {
      if (user) loadDailyMixes(false); // Don't auto-generate on interval refreshes
    }, 5 * 60 * 1000);

    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, [user, loadDailyMixes]);

  const handleMixClick = (mix: DailyMix) => {
    navigate(`/daily-mix/${mix.id}`);
  };

  const getGradientColors = (mixNumber: number): string => {
    const gradients = [
      'from-[#00ad74] to-[#008a5d]', // Brand green
      'from-blue-500 to-cyan-500',     // Ocean blue
      'from-emerald-500 to-teal-500',  // Fresh green
      'from-orange-500 to-amber-500',  // Warm sunset
      'from-cyan-500 to-blue-600'      // Deep ocean
    ];

    return gradients[(mixNumber - 1) % gradients.length];
  };

  // Hide section entirely if user is not logged in, still loading, or no mixes available
  if (!user || isLoading || mixes.length === 0) {
    return null;
  }

  return (
    <section className="w-full py-6 px-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-['Inter',sans-serif] font-bold text-white text-xl tracking-tight">
            Daily Mix
          </h2>
          <p className="font-['Inter',sans-serif] text-white/60 text-xs mt-0.5">
            Personalized playlists just for you
          </p>
        </div>
      </div>

      <ScrollArea className="w-full">
        <div className="flex gap-4 pb-4">
          {mixes.map((mix) => (
            <button
              key={mix.id}
              onClick={() => handleMixClick(mix)}
              className={`group relative overflow-hidden rounded-xl bg-gradient-to-br ${getGradientColors(mix.mix_number)} w-[200px] h-[140px] flex-shrink-0 text-left transition-all duration-200 active:scale-95 shadow-lg hover:shadow-2xl`}
            >
              {/* Artist Images Collage */}
              {mix.artist_images && mix.artist_images.length > 0 && (
                <div className="absolute inset-0 z-0">
                  {mix.artist_images.length === 1 ? (
                    <img
                      src={mix.artist_images[0]}
                      alt="Artist"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : mix.artist_images.length === 2 ? (
                    <div className="grid grid-cols-2 h-full gap-[0.5px]">
                      {mix.artist_images.map((img, idx) => (
                        <img
                          key={idx}
                          src={img}
                          alt="Artist"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 grid-rows-2 h-full gap-[0.5px]">
                      {mix.artist_images.slice(0, 4).map((img, idx) => (
                        <img
                          key={idx}
                          src={img}
                          alt="Artist"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                          }}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="relative z-10 p-4 h-full flex flex-col justify-between">
                <div className="flex items-start justify-between">
                  <div className="flex-1 pr-2">
                    <h3 className="font-['Inter',sans-serif] text-base font-bold text-white line-clamp-2 leading-tight">
                      {mix.display_title || mix.genre_focus || mix.mood_focus || 'Your Mix'}
                    </h3>
                  </div>
                  <div className="w-9 h-9 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center group-hover:bg-white/30 group-active:bg-white/40 transition-colors flex-shrink-0">
                    <Play className="w-4 h-4 text-white fill-white" />
                  </div>
                </div>

                <div>
                  <p className="font-['Inter',sans-serif] text-white/80 text-xs line-clamp-2 leading-relaxed">
                    {mix.description}
                  </p>
                </div>
              </div>

              {/* Gradient overlay between images and content */}
              <div className="absolute inset-0 z-[1] bg-gradient-to-b from-black/30 via-black/50 to-black/70" />

              {/* Blur decorations - subtle highlights */}
              <div className="absolute top-0 right-0 w-20 h-20 bg-white/5 rounded-full blur-2xl z-[2]" />
              <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/5 rounded-full blur-2xl z-[2]" />

              {/* Active state overlay */}
              <div className="absolute inset-0 z-[15] bg-black/20 opacity-0 group-active:opacity-100 transition-opacity pointer-events-none" />
            </button>
          ))}
        </div>
        <ScrollBar orientation="horizontal" className="opacity-0" />
      </ScrollArea>
    </section>
  );
};
