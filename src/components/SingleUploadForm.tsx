import React, { useState } from 'react';
import { Music, Image, X, Calendar, FileText, Tag, Plus } from 'lucide-react';
import { supabase, getArtistProfile } from '../lib/supabase';
import { useLocation } from '../hooks/useLocation';
import { directUploadToBunny } from '../lib/directBunnyUpload';
import {
  validateAudioFile,
  validateImageFile,
  createSafeFilePath,
  ALLOWED_AUDIO_EXTENSIONS,
  ALLOWED_IMAGE_EXTENSIONS,
} from '../lib/fileSecurity';
import { compressAlbumCover } from '../lib/imageOptimization';
import { cache } from '../lib/cache';
import { smartCache } from '../lib/smartCache';
import { useUpload } from '../contexts/UploadContext';

interface SingleUploadFormProps {
  onClose: () => void;
  onSuccess?: () => void;
  initialData?: any; // For editing existing content, though not fully implemented for single songs here
}

export default function SingleUploadForm({ onClose, onSuccess, initialData }: SingleUploadFormProps) {
  const { location } = useLocation(true);
  const { addUpload, updateUploadProgress, updateUploadStatus } = useUpload();
  const isEditing = !!initialData;
  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    description: initialData?.description || '',
    releaseDate: initialData?.metadata?.release_date || '',
    genre: initialData?.metadata?.genre || ''
  });
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(initialData?.metadata?.cover_url || null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [compressionStatus, setCompressionStatus] = useState<string | null>(null);
  const [uploadTaskId, setUploadTaskId] = useState<string | null>(null);
  const [featuredArtists, setFeaturedArtists] = useState<string[]>(initialData?.metadata?.featured_artists || []);
  const [newFeaturedArtist, setNewFeaturedArtist] = useState<string>('');

  // Genre, Subgenre, and Mood state
  const [genres, setGenres] = useState<Array<{ id: string; name: string }>>([]);
  const [subgenres, setSubgenres] = useState<Array<{ id: string; name: string; parent_genre_id: string }>>([]);
  const [moods, setMoods] = useState<Array<{ id: string; name: string; description: string }>>([]);
  const [selectedGenreId, setSelectedGenreId] = useState<string>('');
  const [selectedSubgenreId, setSelectedSubgenreId] = useState<string>('');
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);

  // Fetch genres, subgenres, and moods from database
  React.useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch genres
        const { data: genresData } = await supabase
          .from('genres')
          .select('id, name')
          .order('name');
        if (genresData) setGenres(genresData);

        // Fetch all subgenres
        const { data: subgenresData } = await supabase
          .from('subgenres')
          .select('id, name, parent_genre_id')
          .eq('is_active', true)
          .order('display_order');
        if (subgenresData) setSubgenres(subgenresData);

        // Fetch mood categories
        const { data: moodsData } = await supabase
          .from('mood_categories')
          .select('id, name, description')
          .eq('is_active', true)
          .order('name');
        if (moodsData) setMoods(moodsData);
      } catch (error) {
        console.error('Error fetching genres/subgenres/moods:', error);
      }
    };

    fetchData();
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleGenreChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const genreId = e.target.value;
    setSelectedGenreId(genreId);
    // Clear subgenre when genre changes
    setSelectedSubgenreId('');

    // Update formData.genre for backward compatibility
    const selectedGenre = genres.find(g => g.id === genreId);
    if (selectedGenre) {
      setFormData(prev => ({
        ...prev,
        genre: selectedGenre.name,
      }));
    }
  };

  // Filter subgenres by selected genre
  const filteredSubgenres = subgenres.filter(
    sub => sub.parent_genre_id === selectedGenreId
  );

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Validate audio file using security utility
      const validation = validateAudioFile(file);
      if (!validation.valid) {
        setError(validation.error || 'Please upload a valid audio file.');
        setAudioFile(null);
        return;
      }
      setAudioFile(file);
      setError(null);
    }
  };

  const handleCoverImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      // Validate image file using security utility
      const validation = validateImageFile(file);
      if (!validation.valid) {
        setError(validation.error || 'Please upload a valid image file for the cover.');
        setCoverImage(null);
        return;
      }

      setError(null);
      setCompressionStatus('Compressing cover image to 467x467px...');

      try {
        // Compress the image to 467x467px with high quality
        const result = await compressAlbumCover(file, 467, 200, (status) => {
          setCompressionStatus(status);
        });

        setCoverImage(result.file);
        setCompressionStatus(null);

        // Create preview URL with compressed image
        if (imagePreviewUrl) {
          URL.revokeObjectURL(imagePreviewUrl);
        }
        const url = URL.createObjectURL(result.file);
        setImagePreviewUrl(url);
      } catch (compressionError) {
        console.error('Image compression failed:', compressionError);
        setError('Failed to compress image. Please try a different image.');
        setCompressionStatus(null);
        setCoverImage(null);
      }
    }
  };

  const validateMediaUrl = (url: string, expectedType: 'audio' | 'image'): { valid: boolean; error?: string } => {
    if (!url) {
      return { valid: false, error: 'URL is empty' };
    }

    // Must start with https://
    if (!url.startsWith('https://')) {
      return { valid: false, error: 'URL must start with https://' };
    }

    // Must contain .b-cdn.net (Bunny CDN domain) or supabase storage domain
    if (!url.includes('.b-cdn.net') && !url.includes('supabase.co/storage')) {
      return { valid: false, error: 'URL must be from Bunny CDN (.b-cdn.net) or Supabase storage' };
    }

    // Check content type path
    if (expectedType === 'audio' && !url.includes('/audio/')) {
      return { valid: false, error: 'Audio URL must contain /audio/ path' };
    }

    if (expectedType === 'image' && !url.includes('/covers/') && !url.includes('/storage/v1/object/public/covers/')) {
      return { valid: false, error: 'Image URL must contain /covers/ path' };
    }

    return { valid: true };
  };

  const addFeaturedArtist = () => {
    const artistName = newFeaturedArtist.trim();
    if (!artistName) return;

    if (featuredArtists.includes(artistName)) {
      setError('This artist has already been added');
      return;
    }

    setFeaturedArtists(prev => [...prev, artistName]);
    setNewFeaturedArtist('');
    setError(null);
  };

  const removeFeaturedArtist = (index: number) => {
    setFeaturedArtists(prev => prev.filter((_, i) => i !== index));
  };

  const handleFeaturedArtistKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addFeaturedArtist();
    }
  };

  const uploadFile = async (file: File, path: string, taskId?: string): Promise<string> => {
    try {
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !session) {
        throw new Error('Authentication required');
      }

      let contentType: 'audio' | 'image' | 'video' = 'audio';
      let customPath = 'audio';

      if (file.type.startsWith('image/')) {
        contentType = 'image';
        customPath = 'covers';
      } else if (path.includes('covers')) {
        contentType = 'image';
        customPath = 'covers';
      } else if (file.type.startsWith('audio/')) {
        contentType = 'audio';
        customPath = 'audio';
      }

      console.log(`🎵 Uploading ${contentType}: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

      // Use direct upload (same simple approach as video uploads)
      const result = await directUploadToBunny(file, {
        userId: session.user.id,
        contentType,
        customPath,
        onProgress: (percent) => {
          setCompressionStatus(`Uploading: ${percent.toFixed(0)}%`);
          const currentTaskId = taskId || uploadTaskId;
          if (currentTaskId) {
            updateUploadProgress(currentTaskId, percent);
          }
        },
      });

      if (!result.success || !result.publicUrl) {
        throw new Error(result.error || 'Upload failed - no URL returned');
      }

      // Validate the returned URL format
      const expectedType = contentType === 'image' ? 'image' : 'audio';
      const urlValidation = validateMediaUrl(result.publicUrl, expectedType);
      if (!urlValidation.valid) {
        console.error('❌ Invalid URL returned from upload:', result.publicUrl);
        throw new Error(`Upload returned invalid URL: ${urlValidation.error}. Please check your Bunny CDN configuration.`);
      }

      console.log('✅ Upload successful:', result.publicUrl);
      setCompressionStatus(null);
      return result.publicUrl;
    } catch (error) {
      console.error('Error uploading file to Bunny.net:', error);
      setCompressionStatus(null);
      throw new Error(`Upload failed for ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!formData.title.trim()) {
      setError('Song title is required.');
      return;
    }

    const isEditing = !!initialData;

    if (!isEditing && !audioFile) {
      setError('Audio file is required.');
      return;
    }
    if (!isEditing && !coverImage) {
      setError('Cover image is required.');
      return;
    }
    if (!formData.genre) {
      setError('Please select a genre for your song.');
      return;
    }

    setIsSubmitting(true);

    const taskId = `song-${Date.now()}`;
    setUploadTaskId(taskId);

    addUpload({
      id: taskId,
      type: 'single',
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

      // Ensure artist record exists and is properly linked
      let finalArtistId = artistProfile.artist_id;
      
      if (!finalArtistId) {
        // Try to find existing artist by stage name
        const { data: existingArtist, error: findError } = await supabase
          .from('artists')
          .select('id')
          .ilike('name', artistProfile.stage_name)
          .maybeSingle();
        
        if (findError) {
          throw new Error(`Error finding artist: ${findError.message}`);
        }
        
        if (!existingArtist) {
          // Artist doesn't exist, create it using Edge Function
          const createArtistResponse = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/create-artist`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: artistProfile.stage_name,
              bio: artistProfile.bio,
              image_url: artistProfile.profile_photo_url,
              verified: artistProfile.is_verified || false
            }),
          });

          if (!createArtistResponse.ok) {
            const errorData = await createArtistResponse.json();
            throw new Error(`Failed to create artist record: ${errorData.error || 'Unknown error'}`);
          }

          const createResult = await createArtistResponse.json();
          if (!createResult.success) {
            throw new Error(`Failed to create artist record: ${createResult.error}`);
          }
          
          finalArtistId = createResult.artist.id;
          
          // Update the artist profile with the new artist_id
          await supabase
            .from('artist_profiles')
            .update({ artist_id: finalArtistId })
            .eq('id', artistProfile.id);
        } else {
          finalArtistId = existingArtist.id;
          
          // Update the artist profile with the found artist_id
          await supabase
            .from('artist_profiles')
            .update({ artist_id: finalArtistId })
            .eq('id', artistProfile.id);
        }
      }

      let audioUrl = initialData?.metadata?.audio_url || null;
      let coverImageUrl = initialData?.metadata?.cover_url || null;

      // Upload audio file only if new file provided
      if (audioFile) {
        const audioPath = createSafeFilePath(user.id, 'songs', audioFile.name, ALLOWED_AUDIO_EXTENSIONS);
        if (!audioPath) {
          throw new Error('Invalid audio file. Please upload a valid audio file.');
        }
        audioUrl = await uploadFile(audioFile, audioPath, taskId);
      }

      // Upload cover image only if new file provided
      if (coverImage) {
        const coverPath = createSafeFilePath(user.id, 'covers', coverImage.name, ALLOWED_IMAGE_EXTENSIONS);
        if (!coverPath) {
          throw new Error('Invalid image file. Please upload a valid image file.');
        }
        coverImageUrl = await uploadFile(coverImage, coverPath, taskId);
      }

      // Safety check: ensure we have valid URLs when editing
      if (isEditing) {
        if (!audioUrl) {
          throw new Error('Audio URL is missing. Cannot update song without audio file.');
        }
        if (!coverImageUrl) {
          throw new Error('Cover image URL is missing. Cannot update song without cover image.');
        }
      }

      // Get audio duration (only if new audio file uploaded or not editing)
      let duration = initialData?.metadata?.duration_seconds || 0;
      if (audioFile && audioUrl) {
        const audio = new Audio(audioUrl);
        duration = await new Promise<number>((resolve) => {
          audio.onloadedmetadata = () => {
            resolve(audio.duration);
          };
          audio.onerror = () => {
            console.warn('Could not load audio metadata for duration, defaulting to existing or 0.');
            resolve(initialData?.metadata?.duration_seconds || 0);
          };
          audio.load();
        });
      }

      // Use the selected genre ID
      const genreId = selectedGenreId || null;

      // Insert or Update song record
      let songData;
      const songId = initialData?.metadata?.song_id;

      if (isEditing && songId) {
        // Update existing song (genre is handled separately via song_genres table)
        const { data, error: songError } = await supabase
          .from('songs')
          .update({
            title: formData.title.trim(),
            duration_seconds: Math.round(duration),
            audio_url: audioUrl,
            cover_image_url: coverImageUrl,
            release_date: formData.releaseDate || null,
            featured_artists: featuredArtists.length > 0 ? featuredArtists : null,
          })
          .eq('id', songId)
          .select()
          .maybeSingle();

        if (songError) {
          console.error('Song update error details:', songError);
          throw new Error(`Failed to update song data: ${songError.message}`);
        }

        if (!data) {
          throw new Error('Failed to update song: Song not found or you do not have permission to update it.');
        }

        songData = data;
      } else {
        console.log('📀 Creating new song with audio_url:', audioUrl);

        // Insert new song
        const { data, error: songError } = await supabase
          .from('songs')
          .insert({
            title: formData.title.trim(),
            artist_id: finalArtistId,
            duration_seconds: Math.round(duration),
            audio_url: audioUrl,
            cover_image_url: coverImageUrl,
            release_date: formData.releaseDate || null,
            country: location?.location?.countryCode || null,
            featured_artists: featuredArtists.length > 0 ? featuredArtists : null,
          })
          .select()
          .single();

        if (data) {
          console.log('✅ Song created successfully:', {
            id: data.id,
            title: data.title,
            audio_url: data.audio_url
          });
        }

        if (songError) {
          console.error('Song creation error details:', songError);
          throw new Error(`Failed to save song data: ${songError.message}`);
        }
        songData = data;
      }

      // Link song to genre, subgenres, and moods
      if (songData) {
        try {
          if (isEditing && songId) {
            // Clear existing links for editing
            await supabase.from('song_genres').delete().eq('song_id', songData.id);
            await supabase.from('song_subgenres').delete().eq('song_id', songData.id);
            await supabase.from('song_moods').delete().eq('song_id', songData.id);
          }

          // Link song to genre
          if (genreId) {
            await supabase
              .from('song_genres')
              .insert({
                song_id: songData.id,
                genre_id: genreId
              });
          }

          // Link song to subgenre
          if (selectedSubgenreId) {
            await supabase
              .from('song_subgenres')
              .insert({
                song_id: songData.id,
                subgenre_id: selectedSubgenreId
              });
          }

          // Link song to moods (up to 2)
          if (selectedMoods.length > 0) {
            const moodInserts = selectedMoods.map(moodId => ({
              song_id: songData.id,
              mood_id: moodId,
              confidence_score: 1.0
            }));
            await supabase
              .from('song_moods')
              .insert(moodInserts);
          }
        } catch (linkError) {
          console.error('Error linking song to genre/subgenres/moods:', linkError);
          // Don't fail the upload if linking fails
        }
      }

      // Create or update content_upload entry
      if (isEditing && initialData?.id) {
        // Update existing content_upload
        const { error: contentUploadError } = await supabase
          .from('content_uploads')
          .update({
            title: formData.title.trim(),
            description: formData.description.trim() || null,
            metadata: {
              song_id: songData.id,
              audio_url: audioUrl,
              cover_url: coverImageUrl,
              duration_seconds: Math.round(duration),
              release_date: formData.releaseDate || null,
              genre: formData.genre || null,
              genre_id: genreId,
              file_name: audioFile?.name || initialData?.metadata?.file_name,
              file_size: audioFile?.size || initialData?.metadata?.file_size,
              file_type: audioFile?.type || initialData?.metadata?.file_type,
            },
          })
          .eq('id', initialData.id);

        if (contentUploadError) {
          console.error('Error updating content_upload entry:', contentUploadError);
        }
      } else {
        // Create new content_upload
        const { error: contentUploadError } = await supabase
          .from('content_uploads')
          .insert({
            user_id: user.id,
            artist_profile_id: artistProfile.id,
            content_type: 'single',
            title: formData.title.trim(),
            description: formData.description.trim() || null,
            status: 'approved',
            metadata: {
              song_id: songData.id,
              audio_url: audioUrl,
              cover_url: coverImageUrl,
              duration_seconds: Math.round(duration),
              release_date: formData.releaseDate || null,
              genre: formData.genre || null,
              genre_id: genreId,
              file_name: audioFile?.name || 'unknown',
              file_size: audioFile?.size || 0,
              file_type: audioFile?.type || 'audio/mpeg',
            },
          });

        if (contentUploadError) {
          console.error('Error creating content_upload entry:', contentUploadError);
        }
      }

      setSuccess(isEditing ? 'Song updated successfully!' : 'Song uploaded and saved successfully!');

      // Update upload status to trigger notification
      updateUploadStatus(taskId, 'completed');

      // Clear caches to ensure new content appears immediately
      if (songData?.id) {
        cache.deletePattern(`song.*${songData.id}`);
        cache.deletePattern('trending.*');
        cache.deletePattern('home.*');
        cache.deletePattern('new.*release.*');
        cache.deletePattern('explore.*'); // Clear explore screen cache including genres
        await smartCache.invalidate(`song.*${songData.id}`);
        await smartCache.invalidate('trending.*');
        await smartCache.invalidate('home.*');
        await smartCache.invalidate('new.*release.*');
        await smartCache.invalidate('explore.*'); // Clear explore genres cache
      }

      resetForm();

      // Close modal after a short delay to show success message
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
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      description: '',
      releaseDate: '',
      genre: '',
    });
    setAudioFile(null);
    setCoverImage(null);
    if (imagePreviewUrl) {
      URL.revokeObjectURL(imagePreviewUrl);
      setImagePreviewUrl(null);
    }
    
    // Reset file inputs
    const audioInput = document.getElementById('audio-upload') as HTMLInputElement;
    const coverInput = document.getElementById('cover-upload') as HTMLInputElement;
    if (audioInput) audioInput.value = '';
    if (coverInput) coverInput.value = '';
  };

  const removeAudioFile = () => {
    setAudioFile(null);
    const fileInput = document.getElementById('audio-upload') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const removeCoverImage = () => {
    setCoverImage(null);
    if (imagePreviewUrl && !initialData?.metadata?.cover_url) {
      URL.revokeObjectURL(imagePreviewUrl);
    }
    // If editing, show upload prompt. If creating, clear preview
    if (isEditing) {
      setImagePreviewUrl(null);
    } else {
      setImagePreviewUrl(null);
    }
    const fileInput = document.getElementById('cover-upload') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  // Cleanup effect for blob URLs
  React.useEffect(() => {
    return () => {
      if (imagePreviewUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header - Fixed */}
        <div className="sticky top-0 z-10 bg-gradient-to-b from-white to-transparent backdrop-blur-sm px-6 py-5 border-b border-gray-100 rounded-t-2xl">
          <div className="flex items-start justify-between">
            <h2 className="font-['Inter',sans-serif] text-3xl font-black tracking-tight text-gray-900 leading-none">
              {isEditing ? 'Editing' : 'Release your'}<br />
              <span className="font-light italic text-gray-400">{isEditing ? 'track.' : 'single.'}</span>
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
          <div className="p-6 space-y-6">
            {/* Song Title */}
            <div>
              <label className="flex items-center gap-2 font-['Inter',sans-serif] font-medium text-gray-700 text-sm mb-3">
                <Music className="w-4 h-4 text-[#309605]" />
                Song Title *
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                className="w-full h-12 px-4 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#309605] focus:border-[#309605] transition-all duration-200"
                placeholder="Enter song title"
                required
              />
            </div>

            {/* Description */}
            <div>
              <label className="flex items-center gap-2 font-['Inter',sans-serif] font-medium text-gray-700 text-sm mb-3">
                <FileText className="w-4 h-4 text-[#309605]" />
                Description
              </label>
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                rows={4}
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#309605] focus:border-[#309605] transition-all duration-200 resize-none"
                placeholder="Tell us about your song..."
              />
            </div>

            {/* Release Date */}
            <div>
              <label className="flex items-center gap-2 font-['Inter',sans-serif] font-medium text-gray-700 text-sm mb-3">
                <Calendar className="w-4 h-4 text-[#309605]" />
                Release Date
              </label>
              <input
                type="date"
                name="releaseDate"
                value={formData.releaseDate}
                onChange={handleInputChange}
                className="w-full h-12 px-4 bg-white border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#309605] focus:border-[#309605] transition-all duration-200"
              />
            </div>

            {/* Genre Selection */}
            <div>
              <label className="flex items-center gap-2 font-['Inter',sans-serif] font-medium text-gray-700 text-sm mb-3">
                <Tag className="w-4 h-4 text-[#309605]" />
                Genre *
              </label>
              <select
                value={selectedGenreId}
                onChange={handleGenreChange}
                required
                className="w-full h-12 px-4 bg-white border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#309605] focus:border-[#309605] transition-all duration-200"
              >
                <option value="">Select a genre</option>
                {genres.map((genre) => (
                  <option key={genre.id} value={genre.id}>
                    {genre.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Subgenre Selection */}
            <div>
              <label className="flex items-center gap-2 font-['Inter',sans-serif] font-medium text-gray-700 text-sm mb-3">
                <Tag className="w-4 h-4 text-[#309605]" />
                Subgenre (Optional)
              </label>
              {!selectedGenreId ? (
                <p className="font-['Inter',sans-serif] text-gray-500 text-sm py-2">
                  Please select a genre first
                </p>
              ) : filteredSubgenres.length === 0 ? (
                <p className="font-['Inter',sans-serif] text-gray-500 text-sm py-2">
                  No subgenres available for this genre
                </p>
              ) : (
                <select
                  value={selectedSubgenreId}
                  onChange={(e) => setSelectedSubgenreId(e.target.value)}
                  className="w-full h-12 px-4 bg-white border border-gray-300 rounded-xl text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#309605] focus:border-[#309605] transition-all duration-200"
                >
                  <option value="">Select a subgenre</option>
                  {filteredSubgenres.map((subgenre) => (
                    <option key={subgenre.id} value={subgenre.id}>
                      {subgenre.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Moods Selection - Chip-based UI */}
            <div>
              <label className="flex items-center gap-2 font-['Inter',sans-serif] font-medium text-gray-700 text-sm mb-3">
                <Tag className="w-4 h-4 text-[#309605]" />
                Moods (Select up to 2)
              </label>
              <div className="flex flex-wrap gap-2">
                {moods.map((mood) => {
                  const isSelected = selectedMoods.includes(mood.id);
                  const isDisabled = !isSelected && selectedMoods.length >= 2;

                  return (
                    <button
                      key={mood.id}
                      type="button"
                      disabled={isDisabled}
                      onClick={() => {
                        if (isSelected) {
                          setSelectedMoods(prev => prev.filter(id => id !== mood.id));
                        } else if (selectedMoods.length < 2) {
                          setSelectedMoods(prev => [...prev, mood.id]);
                        }
                      }}
                      className={`
                        px-4 py-2 rounded-full text-sm font-medium transition-all duration-200
                        ${isSelected
                          ? 'bg-[#309605] text-white shadow-md hover:bg-[#3ba208]'
                          : isDisabled
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-sm'
                        }
                      `}
                    >
                      {mood.name}
                    </button>
                  );
                })}
              </div>
              {selectedMoods.length === 0 && (
                <p className="font-['Inter',sans-serif] text-gray-500 text-xs mt-2">
                  Select moods that match your track's vibe
                </p>
              )}
            </div>

            {/* Featured Artists */}
            <div>
              <label className="flex items-center gap-2 font-['Inter',sans-serif] font-medium text-gray-700 text-sm mb-3">
                <Music className="w-4 h-4 text-[#309605]" />
                Featured Artist(s) (Optional)
              </label>

              {/* Featured Artists List */}
              {featuredArtists.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-3">
                  {featuredArtists.map((artist, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-full text-sm"
                    >
                      <span className="font-medium">{artist}</span>
                      <button
                        type="button"
                        onClick={() => removeFeaturedArtist(index)}
                        className="w-4 h-4 rounded-full flex items-center justify-center hover:bg-blue-200 transition-colors duration-200"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Featured Artist Input */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newFeaturedArtist}
                  onChange={(e) => setNewFeaturedArtist(e.target.value)}
                  onKeyDown={handleFeaturedArtistKeyDown}
                  className="flex-1 h-11 px-4 text-sm text-gray-900 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#309605] focus:border-[#309605] transition-all duration-200"
                  placeholder="Enter featured artist name"
                />
                <button
                  type="button"
                  onClick={addFeaturedArtist}
                  disabled={!newFeaturedArtist.trim()}
                  className="px-4 h-11 bg-[#309605] hover:bg-[#3ba208] disabled:opacity-50 disabled:cursor-not-allowed rounded-xl text-white text-sm font-medium transition-all duration-200 flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>
            </div>

            {/* Audio File Upload */}
            <div>
              <label className="flex items-center gap-2 font-['Inter',sans-serif] font-medium text-gray-700 text-sm mb-3">
                <Music className="w-4 h-4 text-[#309605]" />
                Audio File {!isEditing && '*'}
                {isEditing && <span className="text-gray-500 text-xs">(optional - leave blank to keep existing)</span>}
              </label>

              {audioFile ? (
                <div className="flex items-center justify-between p-4 bg-gray-50 border border-gray-200 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                      <Music className="w-5 h-5 text-[#309605]" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-['Inter',sans-serif] text-gray-900 text-sm font-medium truncate">
                        {audioFile.name}
                      </p>
                      <p className="font-['Inter',sans-serif] text-gray-500 text-xs">
                        {(audioFile.size / (1024 * 1024)).toFixed(1)} MB
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={removeAudioFile}
                    className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full transition-colors duration-200"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : isEditing && initialData?.metadata?.audio_url ? (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                      <Music className="w-5 h-5 text-blue-600" />
                    </div>
                    <div className="flex-1">
                      <p className="font-['Inter',sans-serif] text-gray-900 text-sm font-medium">
                        Current Audio File
                      </p>
                      <p className="font-['Inter',sans-serif] text-gray-600 text-xs">
                        {initialData?.metadata?.file_name || 'Existing audio'}
                      </p>
                    </div>
                  </div>
                  <div className="border-2 border-dashed border-blue-300 rounded-xl p-4 text-center hover:border-[#309605] hover:bg-blue-100 transition-all duration-200">
                    <input
                      type="file"
                      accept="audio/mpeg, audio/mp3, .mp3"
                      onChange={handleAudioUpload}
                      className="hidden"
                      id="audio-upload"
                    />
                    <label htmlFor="audio-upload" className="cursor-pointer">
                      <Music className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                      <p className="font-['Inter',sans-serif] font-medium text-gray-700 text-xs mb-1">
                        Click to replace audio file
                      </p>
                      <p className="font-['Inter',sans-serif] text-gray-500 text-xs">
                        MP3 format only (128-320 kbps recommended)
                      </p>
                    </label>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-[#309605] hover:bg-gray-50 transition-all duration-200">
                  <input
                    type="file"
                    accept="audio/mpeg, audio/mp3, .mp3"
                    onChange={handleAudioUpload}
                    className="hidden"
                    id="audio-upload"
                  />
                  <label htmlFor="audio-upload" className="cursor-pointer">
                    <Music className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="font-['Inter',sans-serif] font-medium text-gray-700 text-sm mb-1">
                      Click to upload audio file
                    </p>
                    <p className="font-['Inter',sans-serif] text-gray-500 text-xs">
                      MP3 format only (128-320 kbps recommended)
                    </p>
                  </label>
                </div>
              )}
            </div>

            {/* Cover Image Upload */}
            <div>
              <label className="flex items-center gap-2 font-['Inter',sans-serif] font-medium text-gray-700 text-sm mb-2">
                <Image className="w-4 h-4 text-[#309605]" />
                Cover Image {!isEditing && '*'}
                {isEditing && <span className="text-gray-500 text-xs">(optional - leave blank to keep existing)</span>}
              </label>
              <p className="font-['Inter',sans-serif] text-gray-500 text-xs mb-3">
                Images will be automatically optimized to 467x467px
              </p>
              
              {imagePreviewUrl ? (
                <div className="relative">
                  <div className="w-full h-48 rounded-xl overflow-hidden bg-gray-100 mb-3">
                    <img
                      src={imagePreviewUrl}
                      alt="Cover preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  {(coverImage || isEditing) && (
                    <button
                      type="button"
                      onClick={removeCoverImage}
                      className="absolute top-3 right-3 w-8 h-8 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-colors duration-200 shadow-lg"
                    >
                      <X className="w-4 h-4 text-white" />
                    </button>
                  )}
                  <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <Image className="w-4 h-4 text-green-600" />
                    <div className="flex-1 min-w-0">
                      <p className="font-['Inter',sans-serif] text-gray-900 text-sm font-medium truncate">
                        {coverImage?.name || (isEditing ? 'Current cover image' : 'Cover image')}
                      </p>
                      {coverImage && (
                        <p className="font-['Inter',sans-serif] text-gray-500 text-xs">
                          {(coverImage.size / (1024 * 1024)).toFixed(1)} MB
                        </p>
                      )}
                      {!coverImage && isEditing && (
                        <p className="font-['Inter',sans-serif] text-blue-600 text-xs">
                          Click &apos;Replace Image&apos; below to upload a new cover
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-[#309605] hover:bg-gray-50 transition-all duration-200">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleCoverImageUpload}
                    className="hidden"
                    id="cover-upload"
                  />
                  <label htmlFor="cover-upload" className="cursor-pointer">
                    <Image className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="font-['Inter',sans-serif] font-medium text-gray-700 text-sm mb-1">
                      {isEditing ? 'Click to replace cover image' : 'Click to upload cover image *'}
                    </p>
                    <p className="font-['Inter',sans-serif] text-gray-500 text-xs">
                      JPEG, PNG, WebP (max 5MB)
                    </p>
                  </label>
                </div>
              )}
            </div>

            {/* Compression Status */}
            {compressionStatus && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="font-['Inter',sans-serif] text-blue-700 text-sm">{compressionStatus}</p>
                </div>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 bg-red-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <X className="w-3 h-3 text-white" />
                  </div>
                  <p className="font-['Inter',sans-serif] text-red-700 text-sm">{error}</p>
                </div>
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
                <div className="flex items-start gap-3">
                  <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Music className="w-3 h-3 text-white" />
                  </div>
                  <p className="font-['Inter',sans-serif] text-green-700 text-sm">{success}</p>
                </div>
              </div>
            )}

            {/* Bottom spacing to ensure content doesn't get hidden behind sticky footer */}
            <div className="h-4"></div>
          </div>
        </div>

        {/* Sticky Footer with Submit Buttons */}
        <div className="p-6 border-t border-gray-100 bg-white rounded-b-2xl">
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1 h-12 px-4 bg-white border-2 border-gray-300 text-gray-700 rounded-xl font-['Inter',sans-serif] font-medium hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || !formData.title.trim() || (!initialData && (!audioFile || !coverImage)) || !formData.genre}
              className="flex-1 h-12 px-4 bg-gradient-to-r from-[#309605] to-[#3ba208] hover:from-[#3ba208] hover:to-[#3ba208] text-white rounded-xl font-['Inter',sans-serif] font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#309605]/25"
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>{initialData ? 'Updating...' : 'Uploading...'}</span>
                </div>
              ) : (
                initialData ? 'Update Song' : 'Upload Song'
              )}
            </button>
          </div>
          
          {/* Form validation hint */}
          <div className="mt-3 text-center">
            <p className="font-['Inter',sans-serif] text-gray-500 text-xs">
              {!formData.title.trim() ? 'Song title required' :
               !initialData && !audioFile ? 'Audio file required' :
               !initialData && !coverImage ? 'Cover image required' :
               !formData.genre ? 'Genre selection required' :
               initialData ? 'Ready to update' : 'Ready to upload'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}