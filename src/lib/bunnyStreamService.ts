import { supabase } from './supabase';

export interface BunnyUploadResponse {
  success: boolean;
  videoId?: string;
  videoGuid?: string;
  publicUrl?: string;
  thumbnailUrl?: string;
  error?: string;
}

export interface UploadProgressCallback {
  (progress: number): void;
}

export interface BunnyUploadOptions {
  title?: string;
  collectionId?: string;
  onProgress?: UploadProgressCallback;
}

export class BunnyStreamService {
  private static instance: BunnyStreamService;

  private constructor() {}

  static getInstance(): BunnyStreamService {
    if (!BunnyStreamService.instance) {
      BunnyStreamService.instance = new BunnyStreamService();
    }
    return BunnyStreamService.instance;
  }

  async uploadVideo(
    file: File,
    options: BunnyUploadOptions = {}
  ): Promise<BunnyUploadResponse> {
    try {
      const formData = new FormData();
      formData.append('file', file);

      if (options.title) {
        formData.append('title', options.title);
      }

      if (options.collectionId) {
        formData.append('collectionId', options.collectionId);
      }

      const uploadUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bunny-stream-upload`;

      const xhr = new XMLHttpRequest();

      return new Promise<BunnyUploadResponse>((resolve, reject) => {
        if (options.onProgress) {
          xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable && options.onProgress) {
              const percentComplete = (event.loaded / event.total) * 100;
              options.onProgress(percentComplete);
            }
          });
        }

        xhr.addEventListener('load', async () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            try {
              const response = JSON.parse(xhr.responseText) as BunnyUploadResponse;

              if (response.success) {
                resolve(response);
              } else {
                reject(new Error(response.error || 'Upload failed'));
              }
            } catch (error) {
              reject(new Error('Failed to parse upload response'));
            }
          } else {
            try {
              const errorResponse = JSON.parse(xhr.responseText) as BunnyUploadResponse;
              reject(new Error(errorResponse.error || `Upload failed with status: ${xhr.status}`));
            } catch {
              reject(new Error(`Upload failed with status: ${xhr.status}`));
            }
          }
        });

        xhr.addEventListener('error', () => {
          reject(new Error('Network error during upload'));
        });

        xhr.addEventListener('abort', () => {
          reject(new Error('Upload was aborted'));
        });

        xhr.open('POST', uploadUrl);
        xhr.setRequestHeader('Authorization', `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`);
        xhr.send(formData);
      });
    } catch (error) {
      console.error('Error in uploadVideo:', error);
      throw error;
    }
  }

  async getVideoMetadata(videoGuid: string): Promise<any> {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();

      if (sessionError || !session) {
        throw new Error('Authentication required');
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bunny-stream-metadata`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ videoGuid }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to get video metadata');
      }

      return await response.json();
    } catch (error) {
      console.error('Error getting video metadata:', error);
      throw error;
    }
  }

  getPlaybackUrl(videoGuid: string, hostname?: string, quality?: string): string {
    const bunnyHostname = hostname || import.meta.env.VITE_BUNNY_STREAM_HOSTNAME;

    if (!bunnyHostname) {
      throw new Error('Bunny Stream hostname not configured');
    }

    if (quality && quality !== 'auto') {
      return `https://${bunnyHostname}/${videoGuid}/play_${quality}.mp4`;
    }

    // Default to HLS playlist for immediate playback and adaptive streaming
    return `https://${bunnyHostname}/${videoGuid}/playlist.m3u8`;
  }

  /**
   * Get optimized playback URL with quality defaults
   * Prioritizes lower quality for bandwidth savings
   */
  getOptimizedPlaybackUrl(
    videoGuid: string,
    hostname?: string,
    userNetwork?: 'slow' | 'medium' | 'fast'
  ): string {
    const bunnyHostname = hostname || import.meta.env.VITE_BUNNY_STREAM_HOSTNAME;

    if (!bunnyHostname) {
      throw new Error('Bunny Stream hostname not configured');
    }

    // Default to 360p/480p for bandwidth savings
    // HLS will still adapt, but starts lower
    const defaultQuality = userNetwork === 'slow' ? '360p' :
                          userNetwork === 'medium' ? '480p' : '480p';

    return `https://${bunnyHostname}/${videoGuid}/play_${defaultQuality}.mp4`;
  }

  getQualityUrl(videoGuid: string, quality: '360p' | '480p' | '720p' | '1080p', hostname?: string): string {
    const bunnyHostname = hostname || import.meta.env.VITE_BUNNY_STREAM_HOSTNAME;

    if (!bunnyHostname) {
      throw new Error('Bunny Stream hostname not configured');
    }

    return `https://${bunnyHostname}/${videoGuid}/play_${quality}.mp4`;
  }

  getThumbnailUrl(videoGuid: string, hostname?: string, size: 'small' | 'medium' | 'large' = 'medium'): string {
    const bunnyHostname = hostname || import.meta.env.VITE_BUNNY_STREAM_HOSTNAME;

    if (!bunnyHostname) {
      throw new Error('Bunny Stream hostname not configured');
    }

    // Base thumbnail URL
    const baseUrl = `https://${bunnyHostname}/${videoGuid}/thumbnail.jpg`;

    // Add optimization parameters for bandwidth savings
    const sizes = {
      small: { width: 180, height: 101, quality: 60 },
      medium: { width: 360, height: 202, quality: 70 },
      large: { width: 720, height: 404, quality: 75 },
    };

    const params = sizes[size];
    return `${baseUrl}?width=${params.width}&height=${params.height}&quality=${params.quality}&format=webp`;
  }

  async getVideoDuration(videoUrl: string): Promise<number> {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.onloadedmetadata = () => {
        resolve(video.duration);
      };
      video.onerror = () => {
        console.warn('Could not load video metadata for duration, defaulting to 0.');
        resolve(0);
      };
      video.src = videoUrl;
    });
  }
}

export const bunnyStreamService = BunnyStreamService.getInstance();
