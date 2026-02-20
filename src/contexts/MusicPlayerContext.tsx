import React, { createContext, useContext, ReactNode } from 'react';
import { useMusicPlayer as useLocalMusicPlayer } from '../hooks/useMusicPlayer';

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

interface MusicPlayerContextType {
  currentSong: Song | null;
  playlist: Song[];
  currentIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  audioElement: HTMLAudioElement | null;
  isFullPlayerVisible: boolean;
  isMiniPlayerVisible: boolean;
  error: string | null;
  playlistContext: string;
  albumId: string | null;
  playlistId: string | null;
  isShuffleEnabled: boolean;
  repeatMode: 'off' | 'one' | 'all';
  playSong: (_song: Song, _expandFullPlayer?: boolean, _playlist?: Song[], _index?: number, _context?: string, _albumId?: string | null, _playlistId?: string | null) => void;
  changeSong: (_song: Song, _index?: number) => void;
  togglePlayPause: () => void;
  expandFullPlayer: () => void;
  hideFullPlayer: () => void;
  hideAllPlayers: () => void;
  seekTo: (_time: number) => void;
  showMiniPlayer: (_song: Song, _playlist?: Song[], _context?: string, _playlistId?: string | null) => void;
  hideMiniPlayer: () => void;
  playNext: () => void;
  playPrevious: () => void;
  toggleShuffle: () => void;
  toggleRepeat: () => void;
  savePlaybackState: () => void;
  restorePlaybackState: () => Promise<boolean>;
}

const MusicPlayerContext = createContext<MusicPlayerContextType | undefined>(undefined);

export const MusicPlayerProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const musicPlayer = useLocalMusicPlayer();

  return (
    <MusicPlayerContext.Provider value={musicPlayer}>
      {children}
    </MusicPlayerContext.Provider>
  );
};

export const useMusicPlayer = (): MusicPlayerContextType => {
  const context = useContext(MusicPlayerContext);
  if (context === undefined) {
    throw new Error('useMusicPlayer must be used within a MusicPlayerProvider');
  }
  return context;
};
