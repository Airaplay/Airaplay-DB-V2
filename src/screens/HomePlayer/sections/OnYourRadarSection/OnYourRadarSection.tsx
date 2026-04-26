import { useMemo } from "react";
import { useHomeScreenData } from "../../../../contexts/HomeScreenDataContext";

interface Song {
  id: string;
  title: string;
  artist: string;
  artistId?: string | null;
  coverImageUrl?: string | null;
  audioUrl?: string | null;
  duration?: number;
  playCount?: number;
}

interface OnYourRadarSectionProps {
  onOpenMusicPlayer: (song: Song, playlist?: Song[], context?: string) => void;
}

export const OnYourRadarSection = ({ onOpenMusicPlayer }: OnYourRadarSectionProps): JSX.Element | null => {
  const { data } = useHomeScreenData();

  const songs = useMemo(() => {
    const source = data?.newReleases ?? [];
    return source
      .map((song: any) => ({
        id: song.id,
        title: song.title,
        artist:
          song.artist ||
          song.artists?.artist_profiles?.[0]?.stage_name ||
          song.artists?.artist_profiles?.[0]?.users?.display_name ||
          song.artists?.name ||
          "Unknown Artist",
        artistId: song.artist_user_id || song.artists?.artist_profiles?.[0]?.user_id || null,
        coverImageUrl: song.cover_image_url ?? null,
        audioUrl: song.audio_url ?? null,
        duration: song.duration_seconds ?? 0,
        playCount: song.play_count ?? 0,
      }))
      .filter((song: Song) => Boolean(song.audioUrl))
      .slice(0, 4);
  }, [data?.newReleases]);

  if (songs.length === 0) return null;

  return (
    <section className="w-full px-6 py-2">
      <h2 className="font-['Inter',sans-serif] font-bold text-white text-xl tracking-tight mb-4">
        On Your Radar
      </h2>
      <div className="grid grid-cols-2 gap-3">
        {songs.map((song) => (
          <button
            key={song.id}
            type="button"
            onClick={() => onOpenMusicPlayer(song, songs, "On Your Radar")}
            className="rounded-xl overflow-hidden border border-white/10 bg-white/[0.03] text-left"
          >
            <img
              src={song.coverImageUrl || "https://images.pexels.com/photos/1190298/pexels-photo-1190298.jpeg?auto=compress&cs=tinysrgb&w=400"}
              alt={song.title}
              className="w-full h-24 object-cover"
            />
            <div className="p-2.5">
              <p className="text-white text-xs font-semibold line-clamp-1">{song.title}</p>
              <p className="text-white/60 text-[11px] line-clamp-1 mt-0.5">{song.artist}</p>
            </div>
          </button>
        ))}
      </div>
    </section>
  );
};
