import React, { useState } from 'react';
import { Video, X, FileText, Calendar, Image } from 'lucide-react';
import { supabase, getArtistProfile } from '../lib/supabase';
import { bunnyStreamService } from '../lib/bunnyStreamService';
import { MediaCompression } from '../lib/mediaCompression';
import {
  validateVideoFile,
  validateImageFile,
  createSafeFilePath,
  ALLOWED_IMAGE_EXTENSIONS,
} from '../lib/fileSecurity';
import { cache } from '../lib/cache';
import { smartCache } from '../lib/smartCache';
import { useUpload } from '../contexts/UploadContext';

interface VideoUploadFormProps {
  onClose: () => void;
  onSuccess?: () => void;
  initialData?: any;
}

export default function VideoUploadForm({ onClose, onSuccess, initialData }: VideoUploadFormProps) {
  const { addUpload, updateUploadProgress, updateUploadStatus } = useUpload();
  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    description: initialData?.description || '',
    releaseDate: initialData?.metadata?.release_date || '',
  });
  const [selectedVideoFile, setSelectedVideoFile] = useState<File | null>(null);
  const [selectedThumbnailFile, setSelectedThumbnailFile] = useState<File | null>(null);
  const [thumbnailPreviewUrl, setThumbnailPreviewUrl] = useState<string | null>(null);
  const [thumbnailOption, setThumbnailOption] = useState<'auto' | 'upload'>('auto');
  const [isGeneratingThumbnail, setIsGeneratingThumbnail] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadTaskId, setUploadTaskId] = useState<string | null>(null);

  // Cleanup effect for blob URLs
  React.useEffect(() => {
    return () => {
      if (thumbnailPreviewUrl && thumbnailPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(thumbnailPreviewUrl);
      }
    };
  }, []);

  // Auto-generate thumbnail when video is selected and auto option is active
  React.useEffect(() => {
    if (selectedVideoFile && thumbnailOption === 'auto' && !isGeneratingThumbnail && !thumbnailPreviewUrl) {
      generateThumbnailFromVideo(selectedVideoFile);
    }
  }, [selectedVideoFile, thumbnailOption]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleVideoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Validate video file using security utility
      const validation = validateVideoFile(file);
      if (!validation.valid) {
        setError(validation.error || 'Please upload a valid video file.');
        setSelectedVideoFile(null);
        return;
      }

      setSelectedVideoFile(file);
      setError(null);
    }
  };

  const generateThumbnailFromVideo = async (videoFile: File): Promise<void> => {
    setIsGeneratingThumbnail(true);
    setError(null);

    try {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;

      const videoUrl = URL.createObjectURL(videoFile);
      video.src = videoUrl;

      await new Promise<void>((resolve, reject) => {
        video.onloadedmetadata = () => {
          const thumbnailTime = Math.min(5, Math.max(2, video.duration / 5));
          video.currentTime = thumbnailTime;
        };

        video.onseeked = () => {
          try {
            const canvas = document.createElement('canvas');
            canvas.width = video.videoWidth;
            canvas.height = video.videoHeight;

            const ctx = canvas.getContext('2d');
            if (!ctx) {
              throw new Error('Could not get canvas context');
            }

            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

            canvas.toBlob((blob) => {
              if (blob) {
                const thumbnailFile = new File([blob], `thumbnail-${Date.now()}.jpg`, {
                  type: 'image/jpeg',
                  lastModified: Date.now()
                });

                if (thumbnailPreviewUrl) {
                  URL.revokeObjectURL(thumbnailPreviewUrl);
                }

                const thumbnailUrl = URL.createObjectURL(thumbnailFile);
                setThumbnailPreviewUrl(thumbnailUrl);
                setSelectedThumbnailFile(thumbnailFile);

                URL.revokeObjectURL(videoUrl);
                setIsGeneratingThumbnail(false);
                resolve();
              } else {
                throw new Error('Failed to generate thumbnail blob');
              }
            }, 'image/jpeg', 0.9);
          } catch (err) {
            console.error('Error generating thumbnail:', err);
            URL.revokeObjectURL(videoUrl);
            setIsGeneratingThumbnail(false);
            reject(err);
          }
        };

        video.onerror = () => {
          URL.revokeObjectURL(videoUrl);
          setIsGeneratingThumbnail(false);
          reject(new Error('Failed to load video for thumbnail generation'));
        };

        video.load();
      });
    } catch (err) {
      console.error('Error in generateThumbnailFromVideo:', err);
      setIsGeneratingThumbnail(false);
      setError('Failed to generate thumbnail from video. You can upload one manually.');
    }
  };

  const handleThumbnailUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      // Validate image file using security utility
      const validation = validateImageFile(file);
      if (!validation.valid) {
        setError(validation.error || 'Please upload a valid image file for the thumbnail.');
        setSelectedThumbnailFile(null);
        return;
      }

      setSelectedThumbnailFile(file);
      setError(null);

      if (thumbnailPreviewUrl) {
        URL.revokeObjectURL(thumbnailPreviewUrl);
      }
      const url = URL.createObjectURL(file);
      setThumbnailPreviewUrl(url);
    }
  };

  const handleThumbnailOptionChange = (option: 'auto' | 'upload') => {
    setThumbnailOption(option);

    // Clear existing thumbnail
    if (thumbnailPreviewUrl) {
      URL.revokeObjectURL(thumbnailPreviewUrl);
      setThumbnailPreviewUrl(null);
    }
    setSelectedThumbnailFile(null);

    // Reset file input
    const thumbnailInput = document.getElementById('thumbnail-upload') as HTMLInputElement;
    if (thumbnailInput) thumbnailInput.value = '';

    // Auto-generate if switching to auto and video is selected
    if (option === 'auto' && selectedVideoFile) {
      generateThumbnailFromVideo(selectedVideoFile);
    }
  };

  const uploadImageToSupabase = async (file: File, path: string): Promise<string> => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error('Authentication required');
      }

      let fileToUpload = file;

      try {
        const compressionResult = await MediaCompression.compressImage(file, {
          quality: 0.85,
          maxWidth: 1920,
          maxHeight: 1920
        });
        fileToUpload = compressionResult.file;
        console.log('Thumbnail compressed:',
          `${(compressionResult.originalSize / 1024 / 1024).toFixed(2)} MB → ${(compressionResult.compressedSize / 1024 / 1024).toFixed(2)} MB`);
      } catch (compressionError) {
        console.warn('Thumbnail compression failed, uploading original:', compressionError);
      }

      const { data, error } = await supabase.storage
        .from('thumbnails')
        .upload(path, fileToUpload, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) {
        throw error;
      }

      const { data: { publicUrl } } = supabase.storage
        .from('thumbnails')
        .getPublicUrl(data.path);

      return publicUrl;
    } catch (error) {
      console.error('Error uploading thumbnail:', error);
      throw new Error(`Thumbnail upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setUploadProgress(0);

    const isEditing = !!initialData;

    if (!formData.title.trim()) {
      setError('Video title is required.');
      return;
    }
    if (!isEditing && !selectedVideoFile) {
      setError('Video file is required.');
      return;
    }

    setIsSubmitting(true);

    const taskId = `video-${Date.now()}`;
    setUploadTaskId(taskId);

    addUpload({
      id: taskId,
      type: 'video',
      title: formData.title.trim()
    });

    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('User not authenticated. Please sign in.');
      }

      const artistProfile = await getArtistProfile();
      if (!artistProfile) {
        throw new Error('Artist profile not found. Please register as an artist first.');
      }

      let finalArtistId = artistProfile.artist_id;

      if (!finalArtistId) {
        const { data: existingArtist, error: findError } = await supabase
          .from('artists')
          .select('id')
          .ilike('name', artistProfile.stage_name)
          .maybeSingle();

        if (!existingArtist && !findError) {
          const { data: newArtist, error: createError } = await supabase
            .from('artists')
            .insert({
              name: artistProfile.stage_name,
              bio: artistProfile.bio,
              image_url: artistProfile.profile_photo_url,
              verified: artistProfile.is_verified || false
            })
            .select()
            .maybeSingle();

          if (createError) {
            throw new Error(`Failed to create artist record: ${createError.message}`);
          }

          if (!newArtist) {
            throw new Error('Failed to create artist record: No data returned');
          }

          finalArtistId = newArtist.id;

          await supabase
            .from('artist_profiles')
            .update({ artist_id: finalArtistId })
            .eq('id', artistProfile.id);
        } else if (existingArtist) {
          finalArtistId = existingArtist.id;

          await supabase
            .from('artist_profiles')
            .update({ artist_id: finalArtistId })
            .eq('id', artistProfile.id);
        } else if (findError) {
          throw new Error(`Error finding artist: ${findError.message}`);
        }
      }

      let videoUrl = initialData?.metadata?.video_url;
      let videoGuid = initialData?.metadata?.video_guid;
      let duration = initialData?.metadata?.duration_seconds || 0;

      // Upload new video if provided
      if (selectedVideoFile) {
        console.log('📤 Starting video upload to Bunny Stream:', {
          fileName: selectedVideoFile.name,
          fileSize: `${(selectedVideoFile.size / 1024 / 1024).toFixed(2)} MB`
        });

        const uploadResult = await bunnyStreamService.uploadVideo(selectedVideoFile, {
          title: formData.title.trim(),
          onProgress: (progress) => {
            setUploadProgress(progress);
            updateUploadProgress(taskId, progress);
          },
        });

        console.log('✅ Upload response received:', {
          success: uploadResult.success,
          hasPublicUrl: !!uploadResult.publicUrl,
          hasVideoGuid: !!uploadResult.videoGuid,
          error: uploadResult.error
        });

        if (!uploadResult.success || !uploadResult.publicUrl || !uploadResult.videoGuid) {
          console.error('❌ Video upload failed:', {
            uploadResult,
            errorMessage: uploadResult.error || 'Video upload failed'
          });
          throw new Error(uploadResult.error || 'Video upload failed - invalid response from server');
        }

        // Validate URL format before storing
        if (!uploadResult.publicUrl.startsWith('https://')) {
          console.error('❌ Invalid URL protocol:', uploadResult.publicUrl);
          throw new Error('Invalid video URL: must use HTTPS');
        }

        if (!uploadResult.publicUrl.includes('.b-cdn.net')) {
          console.error('❌ Invalid CDN hostname:', uploadResult.publicUrl);
          throw new Error('Invalid video URL: not from Bunny CDN');
        }

        if (!uploadResult.publicUrl.includes('/playlist.m3u8')) {
          console.error('❌ Invalid video URL format:', uploadResult.publicUrl);
          throw new Error('Invalid video URL: must be HLS playlist format');
        }

        // Store the HLS playlist URL for immediate playback
        videoUrl = uploadResult.publicUrl;
        videoGuid = uploadResult.videoGuid;

        console.log('✅ Video URL validated and ready for storage:', {
          videoUrl,
          videoGuid
        });

        // Try to get duration from the HLS URL
        try {
          duration = await bunnyStreamService.getVideoDuration(uploadResult.publicUrl);
          console.log('✅ Video duration calculated:', duration);
        } catch (durationError) {
          console.warn('⚠️ Could not calculate video duration:', durationError);
          duration = 0;
        }
      }

      let thumbnailUrl: string | null = initialData?.metadata?.thumbnail_url || null;
      if (selectedThumbnailFile) {
        const thumbnailPath = createSafeFilePath(user.id, 'thumbnails', selectedThumbnailFile.name, ALLOWED_IMAGE_EXTENSIONS);
        if (!thumbnailPath) {
          throw new Error('Invalid thumbnail file. Please upload a valid image file.');
        }
        thumbnailUrl = await uploadImageToSupabase(selectedThumbnailFile, thumbnailPath);
      }

      if (isEditing && initialData?.id) {
        // Update existing content_upload
        const { error: contentUploadError } = await supabase
          .from('content_uploads')
          .update({
            title: formData.title.trim(),
            description: formData.description.trim() || null,
            metadata: {
              ...initialData.metadata,
              video_url: videoUrl,
              video_guid: videoGuid,
              thumbnail_url: thumbnailUrl,
              duration_seconds: Math.round(duration),
              release_date: formData.releaseDate || null,
              file_name: selectedVideoFile?.name || initialData.metadata?.file_name,
              file_size: selectedVideoFile?.size || initialData.metadata?.file_size,
              file_type: selectedVideoFile?.type || initialData.metadata?.file_type,
              artist_id: finalArtistId,
              bunny_stream: true,
            },
          })
          .eq('id', initialData.id);

        if (contentUploadError) {
          throw new Error(`Failed to update video data: ${contentUploadError.message}`);
        }
      } else {
        // Validate that video URL is set for new videos
        if (!videoUrl) {
          console.error('❌ Cannot save video: video_url is missing');
          throw new Error('Video upload failed: no playable URL available');
        }

        if (!videoGuid) {
          console.error('❌ Cannot save video: video_guid is missing');
          throw new Error('Video upload failed: no video GUID available');
        }

        console.log('💾 Saving new video to database:', {
          title: formData.title.trim(),
          videoUrl,
          videoGuid,
          hasDescription: !!formData.description.trim()
        });

        // Insert new content_upload
        const { error: contentUploadError } = await supabase
          .from('content_uploads')
          .insert({
            user_id: user.id,
            artist_profile_id: artistProfile.id,
            content_type: 'video',
            title: formData.title.trim(),
            description: formData.description.trim() || null,
            status: 'approved',
            metadata: {
              video_url: videoUrl,
              video_guid: videoGuid,
              thumbnail_url: thumbnailUrl,
              duration_seconds: Math.round(duration),
              release_date: formData.releaseDate || null,
              file_name: selectedVideoFile?.name || '',
              file_size: selectedVideoFile?.size || 0,
              file_type: selectedVideoFile?.type || 'video/mp4',
              artist_id: finalArtistId,
              bunny_stream: true,
            },
          });

        if (contentUploadError) {
          console.error('❌ Database save failed:', contentUploadError);
          throw new Error(`Failed to save video data: ${contentUploadError.message}`);
        }

        console.log('✅ Video saved successfully to database');
      }

      setSuccess(isEditing ? 'Video updated successfully!' : 'Video uploaded successfully!');

      // Update upload status to trigger notification
      updateUploadStatus(taskId, 'completed');

      // Clear caches when editing to ensure new video URL is used
      if (isEditing && initialData?.id) {
        cache.deletePattern(`video.*${initialData.id}`);
        cache.deletePattern('must.*watch.*');
        cache.deletePattern('home.*');
        cache.deletePattern('new.*release.*');
        cache.deletePattern('explore.*');
        await smartCache.invalidate(`video.*${initialData.id}`);
        await smartCache.invalidate('must.*watch.*');
        await smartCache.invalidate('home.*');
        await smartCache.invalidate('new.*release.*');
        await smartCache.invalidate('explore.*');
      }

      resetForm();

      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Upload process failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred during upload.';
      setError(errorMessage);

      // Update upload status to trigger error notification
      updateUploadStatus(taskId, 'error', errorMessage);
    } finally {
      setIsSubmitting(false);
      setUploadProgress(0);
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      releaseDate: '',
    });
    setSelectedVideoFile(null);
    setSelectedThumbnailFile(null);
    if (thumbnailPreviewUrl) {
      URL.revokeObjectURL(thumbnailPreviewUrl);
      setThumbnailPreviewUrl(null);
    }
    
    // Reset file inputs
    const videoInput = document.getElementById('video-upload') as HTMLInputElement;
    const thumbnailInput = document.getElementById('thumbnail-upload') as HTMLInputElement;
    if (videoInput) videoInput.value = '';
    if (thumbnailInput) thumbnailInput.value = '';
  };

  const removeVideoFile = () => {
    setSelectedVideoFile(null);
    const fileInput = document.getElementById('video-upload') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const removeThumbnailFile = () => {
    setSelectedThumbnailFile(null);
    if (thumbnailPreviewUrl) {
      URL.revokeObjectURL(thumbnailPreviewUrl);
      setThumbnailPreviewUrl(null);
    }
    const fileInput = document.getElementById('thumbnail-upload') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header - Fixed */}
        <div className="sticky top-0 z-10 bg-gradient-to-b from-white to-transparent backdrop-blur-sm px-6 py-5 border-b border-gray-100 rounded-t-2xl">
          <div className="flex items-start justify-between">
            <h2 className="font-['Inter',sans-serif] text-3xl font-black tracking-tight text-gray-900 leading-none">
              {initialData ? 'Editing' : 'Share your'}<br />
              <span className="font-light italic text-gray-400">{initialData ? 'video.' : 'visual.'}</span>
            </h2>
            <button
              onClick={onClose}
              className="mt-1 p-2 hover:bg-gray-100 rounded-full transition-colors duration-200"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
            {/* Title */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <FileText className="w-4 h-4" />
                Video Title *
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#309605]"
                placeholder="Enter video title"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <FileText className="w-4 h-4" />
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#309605] resize-none"
                placeholder="Tell us about your video..."
              />
            </div>

            {/* Release Date */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4" />
                Release Date
              </label>
              <input
                type="date"
                name="releaseDate"
                value={formData.releaseDate}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-[#309605]"
              />
            </div>

            {/* Video File Upload */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Video File *
              </label>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept="video/*"
                  onChange={handleVideoUpload}
                  className="hidden"
                  id="video-upload"
                />
                <label htmlFor="video-upload" className="cursor-pointer">
                  <Video className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                  <p className="text-gray-600">
                    {selectedVideoFile ? selectedVideoFile.name : 'Click to upload video file'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    Max size: 500MB • Supported: MP4, MOV, AVI, WebM
                  </p>
                </label>
              </div>
              {selectedVideoFile && (
                <div className="flex items-center justify-between bg-gray-50 p-3 rounded-md mt-2">
                  <div className="flex items-center gap-2">
                    <Video className="w-4 h-4 text-green-600" />
                    <span className="text-sm text-gray-700">{selectedVideoFile.name}</span>
                  </div>
                  <button
                    type="button"
                    onClick={removeVideoFile}
                    className="text-red-500 hover:text-red-700 p-1 rounded-full hover:bg-red-50"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>

            {/* Thumbnail Options */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-3">
                Thumbnail Image
              </label>

              {/* Thumbnail Option Selector */}
              <div className="flex gap-3 mb-4">
                <button
                  type="button"
                  onClick={() => handleThumbnailOptionChange('auto')}
                  className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all duration-200 ${
                    thumbnailOption === 'auto'
                      ? 'border-[#309605] bg-[#e6f7f1] text-[#309605]'
                      : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Video className="w-4 h-4" />
                    <span className="text-sm font-medium">Auto-Generate</span>
                  </div>
                  <p className="text-xs mt-1 opacity-75">From video frame</p>
                </button>

                <button
                  type="button"
                  onClick={() => handleThumbnailOptionChange('upload')}
                  className={`flex-1 px-4 py-3 rounded-lg border-2 transition-all duration-200 ${
                    thumbnailOption === 'upload'
                      ? 'border-[#309605] bg-[#e6f7f1] text-[#309605]'
                      : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                  }`}
                >
                  <div className="flex items-center justify-center gap-2">
                    <Image className="w-4 h-4" />
                    <span className="text-sm font-medium">Upload Image</span>
                  </div>
                  <p className="text-xs mt-1 opacity-75">Custom thumbnail</p>
                </button>
              </div>

              {/* Thumbnail Preview/Upload Area */}
              {thumbnailOption === 'auto' ? (
                <div>
                  {isGeneratingThumbnail ? (
                    <div className="border-2 border-blue-300 bg-blue-50 rounded-lg p-8 text-center">
                      <div className="flex items-center justify-center gap-3">
                        <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-blue-700 text-sm font-medium">Generating thumbnail from video...</p>
                      </div>
                    </div>
                  ) : thumbnailPreviewUrl ? (
                    <div className="relative">
                      <div className="w-full h-48 rounded-lg overflow-hidden bg-gray-100 mb-2">
                        <img
                          src={thumbnailPreviewUrl}
                          alt="Auto-generated thumbnail"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={removeThumbnailFile}
                        className="absolute top-2 right-2 w-8 h-8 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-colors duration-200 shadow-lg"
                      >
                        <X className="w-4 h-4 text-white" />
                      </button>
                      <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md">
                        <Video className="w-4 h-4 text-green-600" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-green-800">Thumbnail generated successfully</p>
                          <p className="text-xs text-green-600">Extracted from video at 2-5 second mark</p>
                        </div>
                      </div>
                    </div>
                  ) : selectedVideoFile ? (
                    <div className="border-2 border-yellow-300 bg-yellow-50 rounded-lg p-6 text-center">
                      <p className="text-yellow-700 text-sm">Upload a video to auto-generate thumbnail</p>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                      <Video className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-gray-600 text-sm">Upload a video first to generate thumbnail</p>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  {thumbnailPreviewUrl ? (
                    <div className="relative">
                      <div className="w-full h-48 rounded-lg overflow-hidden bg-gray-100 mb-2">
                        <img
                          src={thumbnailPreviewUrl}
                          alt="Uploaded thumbnail"
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={removeThumbnailFile}
                        className="absolute top-2 right-2 w-8 h-8 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-colors duration-200 shadow-lg"
                      >
                        <X className="w-4 h-4 text-white" />
                      </button>
                      <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-md">
                        <Image className="w-4 h-4 text-green-600" />
                        <span className="text-sm text-gray-700">{selectedThumbnailFile?.name}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-[#309605] hover:bg-gray-50 transition-all duration-200">
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleThumbnailUpload}
                        className="hidden"
                        id="thumbnail-upload"
                      />
                      <label htmlFor="thumbnail-upload" className="cursor-pointer">
                        <Image className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                        <p className="text-gray-600 font-medium">
                          Click to upload thumbnail image
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          JPEG, PNG, WebP (max 5MB)
                        </p>
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>

            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="p-3 bg-blue-100 border border-blue-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-blue-700 text-sm font-medium">Uploading video...</p>
                  <p className="text-blue-700 text-sm font-medium">{Math.round(uploadProgress)}%</p>
                </div>
                <div className="w-full bg-blue-200 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{ width: `${uploadProgress}%` }}
                  ></div>
                </div>
              </div>
            )}

            {error && (
              <div className="p-3 bg-red-100 border border-red-200 rounded-lg">
                <p className="text-red-700 text-sm">{error}</p>
              </div>
            )}

            {success && (
              <div className="p-3 bg-green-100 border border-green-200 rounded-lg">
                <p className="text-green-700 text-sm">{success}</p>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !formData.title.trim() || !selectedVideoFile}
                className="flex-1 px-4 py-2 bg-[#309605] text-white rounded-md hover:bg-[#3ba208] transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Uploading...' : 'Upload Video'}
              </button>
            </div>
          </form>
          </div>
        </div>
      </div>
    </div>
  );
}