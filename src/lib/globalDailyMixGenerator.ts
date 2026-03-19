/**
 * Global Daily Mix Generator
 * 
 * Generates daily mixes for non-authenticated users and users without listening history
 * Uses global trending data, top genres, and editorial curation
 */

import { supabase } from './supabase';
import { fetchWithCache, CACHE_KEYS, CACHE_TTL } from './configCache';

interface GlobalDailyMix {
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

interface GlobalMixTrack {
  song_id: string;
  position: number;
  explanation: string;
}

/**
 * Get or generate global daily mixes (cached for all users)
 */
export async function getGlobalDailyMixes(): Promise<GlobalDailyMix[]> {
  return fetchWithCache(
    CACHE_KEYS.GLOBAL_DAILY_MIXES,
    CACHE_TTL.ONE_HOUR * 4, // 4 hours cache
    async () => {
      // Try to get from database first
      const { data: existingMixes, error } = await supabase
        .from('global_daily_mix_playlists')
        .select('id, mix_number, title, description, genre_focus, mood_focus, cover_image_url, track_count, generated_at')
        .gt('expires_at', new Date().toISOString())
        .order('mix_number');

      if (!error && existingMixes && existingMixes.length > 0) {
        return existingMixes;
      }

      // Generate new global mixes if none exist
      return await generateGlobalMixes();
    }
  );
}

/**
 * Get tracks for a global mix
 */
export async function getGlobalMixTracks(mixId: string): Promise<any[]> {
  const { data: tracks, error } = await supabase
    .from('global_daily_mix_tracks')
    .select(`
      song_id,
      position,
      explanation,
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

  if (error) throw error;
  return tracks || [];
}

/**
 * Generate new global mixes based on trending and popular content
 */
export async function generateGlobalMixes(): Promise<GlobalDailyMix[]> {
  const config = await fetchWithCache(
    CACHE_KEYS.DAILY_MIX_CONFIG,
    CACHE_TTL.ONE_DAY,
    async () => {
      const { data } = await supabase
        .from('daily_mix_config')
        .select('*')
        .single();
      return data;
    }
  );

  const tracksPerMix = config?.tracks_per_mix || 25;
  const mixesCount = config?.mixes_per_user || 5;

  // Get top genres from the platform
  const { data: topGenres } = await supabase
    .from('song_genres')
    .select(`
      genre_id,
      genres (
        id,
        name
      )
    `)
    .limit(1000);

  // Count genre occurrences
  const genreCounts = new Map<string, { id: string; name: string; count: number }>();
  topGenres?.forEach((sg: any) => {
    if (sg.genres) {
      const key = sg.genres.id;
      const existing = genreCounts.get(key);
      if (existing) {
        existing.count++;
      } else {
        genreCounts.set(key, { id: sg.genres.id, name: sg.genres.name, count: 1 });
      }
    }
  });

  // Get top 4 genres
  const topGenresList = Array.from(genreCounts.values())
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  // Get trending songs (last 7 days)
  const { data: trendingSongs } = await supabase
    .from('songs')
    .select('id, title, artist_id, cover_image_url, duration_seconds, audio_url, play_count')
    .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    .order('play_count', { ascending: false })
    .limit(tracksPerMix * 2);

  // Get globally popular songs
  const { data: popularSongs } = await supabase
    .from('songs')
    .select('id, title, artist_id, cover_image_url, duration_seconds, audio_url, play_count')
    .order('play_count', { ascending: false })
    .limit(tracksPerMix * mixesCount * 2);

  // Delete old global mixes
  await supabase
    .from('global_daily_mix_playlists')
    .delete()
    .lt('expires_at', new Date().toISOString());

  const mixes: GlobalDailyMix[] = [];

  // Create genre-focused mixes
  for (let i = 0; i < topGenresList.length; i++) {
    const genre = topGenresList[i];
    
    // Get songs for this genre
    const { data: genreSongs } = await supabase
      .from('song_genres')
      .select(`
        song_id,
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
      .eq('genre_id', genre.id)
      .limit(tracksPerMix * 2);

    const songs = genreSongs
      ?.map((gs: any) => gs.songs)
      .filter(Boolean)
      .sort((a, b) => (b.play_count || 0) - (a.play_count || 0))
      .slice(0, tracksPerMix) || [];

    if (songs.length === 0) continue;

    const { data: playlist, error: playlistError } = await supabase
      .from('global_daily_mix_playlists')
      .insert({
        mix_number: i + 1,
        title: `${genre.name} Mix`,
        description: `Top ${genre.name} tracks trending globally`,
        genre_focus: genre.name,
        mood_focus: null,
        cover_image_url: songs[0]?.cover_image_url || null,
        track_count: songs.length,
        generated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      })
      .select()
      .single();

    if (playlistError || !playlist) continue;

    // Insert tracks
    const tracksToInsert = songs.map((song, idx) => ({
      mix_id: playlist.id,
      song_id: song.id,
      position: idx + 1,
      explanation: `Popular ${genre.name} track`
    }));

    await supabase
      .from('global_daily_mix_tracks')
      .insert(tracksToInsert);

    mixes.push(playlist);
  }

  // Create a "Trending Now" discovery mix
  if (trendingSongs && trendingSongs.length > 0) {
    const { data: playlist, error: playlistError } = await supabase
      .from('global_daily_mix_playlists')
      .insert({
        mix_number: topGenresList.length + 1,
        title: 'Trending Now',
        description: 'Fresh tracks trending globally right now',
        genre_focus: 'Discovery',
        mood_focus: null,
        cover_image_url: trendingSongs[0]?.cover_image_url || null,
        track_count: Math.min(tracksPerMix, trendingSongs.length),
        generated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
      })
      .select()
      .single();

    if (!playlistError && playlist) {
      const tracksToInsert = trendingSongs.slice(0, tracksPerMix).map((song, idx) => ({
        mix_id: playlist.id,
        song_id: song.id,
        position: idx + 1,
        explanation: 'Trending globally'
      }));

      await supabase
        .from('global_daily_mix_tracks')
        .insert(tracksToInsert);

      mixes.push(playlist);
    }
  }

  return mixes;
}

/**
 * Check if global mixes need refresh (run from admin or cron)
 */
export async function refreshGlobalMixesIfNeeded(): Promise<boolean> {
  const { data: existing } = await supabase
    .from('global_daily_mix_playlists')
    .select('id')
    .gt('expires_at', new Date().toISOString())
    .limit(1);

  if (!existing || existing.length === 0) {
    await generateGlobalMixes();
    return true;
  }

  return false;
}
