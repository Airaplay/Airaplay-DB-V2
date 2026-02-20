interface ShareOptions {
  title: string;
  text: string;
  url: string;
  dialogTitle?: string;
}

/**
 * Share service that works on both web and mobile platforms
 * Uses Web Share API when available, falls back to clipboard
 */
export const shareContent = async (options: ShareOptions): Promise<void> => {
  const { title, text, url } = options;

  try {
    // Try Web Share API (works in modern browsers, PWAs, and mobile web)
    if (typeof navigator !== 'undefined' && navigator.share) {
      const shareData: ShareData = {
        title: title,
        text: text,
        url: url
      };

      // Check if Web Share API can share this data
      if (navigator.canShare && navigator.canShare(shareData)) {
        try {
          await navigator.share(shareData);
          return; // Successfully shared via Web Share API
        } catch (error: any) {
          // If user cancels, don't show error
          if (error?.name === 'AbortError') {
            return;
          }
          console.warn('[ShareService] Web Share API failed, trying clipboard:', error);
          // Fall through to clipboard fallback
        }
      }
    }

    // Fallback: Copy to clipboard
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(url);
        // Show a toast or alert (you can customize this)
        if (typeof window !== 'undefined' && window.alert) {
          window.alert('Link copied to clipboard!');
        }
        return;
      } catch (error) {
        console.error('[ShareService] Clipboard write failed:', error);
        throw new Error('Unable to share content. Please try again.');
      }
    }

    // Last resort: throw error
    throw new Error('Sharing is not supported on this device');
  } catch (error) {
    console.error('[ShareService] Share error:', error);
    throw error;
  }
};

/**
 * Share a song
 */
export const shareSong = async (
  songId: string,
  songTitle: string,
  artistName: string
): Promise<void> => {
  const shareUrl = `${window.location.origin}/song/${songId}`;
  const shareText = `Check out "${songTitle}" by ${artistName} on Airaplay!`;

  await shareContent({
    title: songTitle,
    text: shareText,
    url: shareUrl,
    dialogTitle: 'Share Song'
  });
};

/**
 * Share an album
 */
export const shareAlbum = async (
  albumId: string,
  albumTitle: string,
  artistName: string
): Promise<void> => {
  const shareUrl = `${window.location.origin}/album/${albumId}`;
  const shareText = `Check out the album "${albumTitle}" by ${artistName} on Airaplay!`;

  await shareContent({
    title: `${albumTitle} by ${artistName}`,
    text: shareText,
    url: shareUrl,
    dialogTitle: 'Share Album'
  });
};

/**
 * Share a playlist
 */
export const sharePlaylist = async (
  playlistId: string,
  playlistTitle: string
): Promise<void> => {
  const shareUrl = `${window.location.origin}/playlist/${playlistId}`;
  const shareText = `Check out the playlist "${playlistTitle}" on Airaplay!`;

  await shareContent({
    title: playlistTitle,
    text: shareText,
    url: shareUrl,
    dialogTitle: 'Share Playlist'
  });
};

/**
 * Share a video
 */
export const shareVideo = async (
  videoId: string,
  videoTitle: string
): Promise<void> => {
  const shareUrl = `${window.location.origin}/video/${videoId}`;
  const shareText = `Watch "${videoTitle}" on Airaplay!`;

  await shareContent({
    title: videoTitle,
    text: shareText,
    url: shareUrl,
    dialogTitle: 'Share Video'
  });
};

/**
 * Share a user profile
 */
export const shareProfile = async (
  userId: string,
  userName: string
): Promise<void> => {
  const shareUrl = `${window.location.origin}/user/${userId}`;
  const shareText = `Check out ${userName}'s music profile on Airaplay!`;

  await shareContent({
    title: `${userName}'s Profile`,
    text: shareText,
    url: shareUrl,
    dialogTitle: 'Share Profile'
  });
};
