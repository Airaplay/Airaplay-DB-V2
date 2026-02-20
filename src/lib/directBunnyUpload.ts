import { supabase } from './supabase';

export interface DirectUploadOptions {
  userId: string;
  contentType: 'audio' | 'image' | 'video';
  customPath?: string;
  onProgress?: (percent: number) => void;
}

export interface DirectUploadResult {
  success: boolean;
  publicUrl?: string;
  error?: string;
}

/**
 * Smart upload routing:
 * - Audio files → Bunny Storage (via Edge Function)
 * - Image files → Supabase Storage (direct upload)
 * - Video files → Bunny Storage (via Edge Function)
 */
export async function directUploadToBunny(
  file: File,
  options: DirectUploadOptions
): Promise<DirectUploadResult> {
  if (options.contentType === 'image') {
    return uploadToSupabaseStorage(file, options);
  } else {
    return uploadToBunnyStorage(file, options);
  }
}

/**
 * Upload images to Supabase Storage
 */
async function uploadToSupabaseStorage(
  file: File,
  options: DirectUploadOptions
): Promise<DirectUploadResult> {
  try {
    console.log('🚀 Uploading image to Supabase Storage:', {
      fileName: file.name,
      fileSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
      contentType: options.contentType
    });

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      throw new Error('Authentication required');
    }

    const bucket = getBucketForContentType(options.contentType, options.customPath);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}.${fileExt}`;
    const filePath = `${options.userId}/${fileName}`;

    console.log('📤 Uploading to Supabase Storage:', { bucket, filePath });

    if (options.onProgress) {
      options.onProgress(50);
    }

    const { error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, {
        cacheControl: '2592000', // 30 days cache for images (covers, avatars)
        upsert: true
      });

    if (uploadError) {
      console.error('Upload error:', uploadError);
      throw new Error(uploadError.message || 'Upload failed');
    }

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(filePath);

    console.log('✅ Upload successful to Supabase Storage:', publicUrl);

    if (options.onProgress) {
      options.onProgress(100);
    }

    return {
      success: true,
      publicUrl
    };
  } catch (error) {
    console.error('❌ Supabase Storage upload failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * Upload audio/video to Bunny Storage via Edge Function
 */
async function uploadToBunnyStorage(
  file: File,
  options: DirectUploadOptions
): Promise<DirectUploadResult> {
  try {
    console.log('🚀 Uploading to Bunny Storage:', {
      fileName: file.name,
      fileSize: `${(file.size / 1024 / 1024).toFixed(2)} MB`,
      contentType: options.contentType
    });

    const { data: { session }, error: sessionError } = await supabase.auth.getSession();
    if (sessionError || !session) {
      throw new Error('Authentication required');
    }

    const customPath = getPathForBunnyContentType(options.contentType);

    console.log('📤 Uploading to Bunny Storage via Edge Function:', { customPath });

    const formData = new FormData();
    formData.append('file', file);
    formData.append('contentType', options.contentType);
    formData.append('userId', options.userId);
    if (customPath) {
      formData.append('customPath', customPath);
    }
    formData.append('skipHash', 'true');

    const uploadUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/upload-to-bunny`;

    const xhr = new XMLHttpRequest();

    return new Promise<DirectUploadResult>((resolve, reject) => {
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
            const response = JSON.parse(xhr.responseText);

            if (response.success) {
              console.log('✅ Upload successful to Bunny Storage:', response.publicUrl);

              if (options.onProgress) {
                options.onProgress(100);
              }

              resolve({
                success: true,
                publicUrl: response.publicUrl
              });
            } else {
              reject(new Error(response.error || 'Upload failed'));
            }
          } catch (error) {
            reject(new Error('Failed to parse upload response'));
          }
        } else {
          try {
            const errorResponse = JSON.parse(xhr.responseText);
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
      xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);

      xhr.send(formData);
    });
  } catch (error) {
    console.error('❌ Bunny Storage upload failed:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

function getBucketForContentType(contentType: string, customPath?: string): string {
  if (customPath === 'profile-photos') {
    return 'profile-photos';
  }

  if (customPath === 'covers') {
    return 'covers';
  }

  if (customPath === 'thumbnails') {
    return 'thumbnails';
  }

  if (customPath === 'banners') {
    return 'banners';
  }

  switch (contentType) {
    case 'image':
      return 'covers';
    case 'audio':
    case 'video':
      return 'content-media';
    default:
      return 'content-media';
  }
}

function getPathForBunnyContentType(contentType: string): string {
  switch (contentType) {
    case 'audio':
      return 'audio';
    case 'video':
      return 'video';
    default:
      return 'audio';
  }
}
