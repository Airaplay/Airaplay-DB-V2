import React, { useState, useEffect, useCallback } from 'react';
import { Music, Image, X, Calendar, FileText, Trash2, Plus, Tag } from 'lucide-react';
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
import { ParallelUploadManager } from '../lib/parallelUploadManager';

interface AlbumUploadFormProps {
  onClose: () => void;
  onSuccess?: () => void;
  initialData?: any;
}

interface AudioFile {
  file: File;
  id: string;
  title: string;
  featuredArtists: string[];
}

export default function AlbumUploadForm({ onClose, onSuccess, initialData }: AlbumUploadFormProps) {
  const { location } = useLocation(true);
  const { addUpload, updateUploadProgress, updateUploadStatus } = useUpload();
  const isEditMode = !!initialData;
  const [formData, setFormData] = useState({
    title: initialData?.title || '',
    description: initialData?.description || '',
    releaseDate: initialData?.metadata?.release_date || '',
    genre: initialData?.metadata?.genre || '',
  });
  const [selectedCoverFile, setSelectedCoverFile] = useState<File | null>(null);
  const [coverPreviewUrl, setCoverPreviewUrl] = useState<string | null>(null);
  const [audioFiles, setAudioFiles] = useState<AudioFile[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [compressionStatus, setCompressionStatus] = useState<string | null>(null);
  const [newFeaturedArtist, setNewFeaturedArtist] = useState<Record<string, string>>({});
  const [existingSongs, setExistingSongs] = useState<any[]>([]);
  const [isLoadingAlbumData, setIsLoadingAlbumData] = useState(false);
  const [uploadTaskId, setUploadTaskId] = useState<string | null>(null);

  // Genre, Subgenre, and Mood state
  const [genres, setGenres] = useState<Array<{ id: string; name: string }>>([]);
  const [subgenres, setSubgenres] = useState<Array<{ id: string; name: string; parent_genre_id: string }>>([]);
  const [moods, setMoods] = useState<Array<{ id: string; name: string; description: string }>>([]);
  const [selectedGenreId, setSelectedGenreId] = useState<string>('');
  const [selectedSubgenreId, setSelectedSubgenreId] = useState<string>('');
  const [selectedMoods, setSelectedMoods] = useState<string[]>([]);

  // Fetch genres, subgenres, and moods from database
  useEffect(() => {
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

  // Cleanup effect for blob URLs
  useEffect(() => {
    return () => {
      if (coverPreviewUrl && coverPreviewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(coverPreviewUrl);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadAlbumData = useCallback(async () => {
    if (!initialData?.metadata?.album_id) {
      console.error('No album_id found in metadata');
      return;
    }

    try {
      setIsLoadingAlbumData(true);

      // Fetch album details
      const { data: albumData, error: albumError } = await supabase
        .from('albums')
        .select('*')
        .eq('id', initialData.metadata.album_id)
        .maybeSingle();

      if (albumError) {
        console.error('Error loading album:', albumError);
        return;
      }

      if (!albumData) {
        console.error('Album not found');
        return;
      }

      // Set cover preview URL
      if (albumData?.cover_image_url) {
        setCoverPreviewUrl(albumData.cover_image_url);
      }

      // Update form data with album details
      setFormData({
        title: albumData?.title || initialData.title || '',
        description: albumData?.description || initialData.description || '',
        releaseDate: albumData?.release_date || initialData.metadata?.release_date || '',
        genre: initialData.metadata?.genre || '',
      });

      // Fetch songs for this album
      const { data: songsData, error: songsError } = await supabase
        .from('songs')
        .select('id, title, duration_seconds, audio_url')
        .eq('album_id', initialData.metadata.album_id)
        .order('created_at', { ascending: true });

      if (songsError) {
        console.error('Error loading songs:', songsError);
      } else {
        setExistingSongs(songsData || []);
      }
    } catch (err) {
      console.error('Error in loadAlbumData:', err);
    } finally {
      setIsLoadingAlbumData(false);
    }
  }, [initialData]);

  // Load album data in edit mode
  useEffect(() => {
    if (isEditMode && initialData) {
      loadAlbumData();
    }
  }, [isEditMode, initialData, loadAlbumData]);

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

  const handleCoverImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];

      // Validate image file using security utility
      const validation = validateImageFile(file);
      if (!validation.valid) {
        setError(validation.error || 'Please upload a valid image file for the cover.');
        setSelectedCoverFile(null);
        return;
      }

      setError(null);
      setCompressionStatus('Compressing cover image to 467x467px...');

      try {
        // Compress the image to 467x467px with high quality
        const result = await compressAlbumCover(file, 467, 200, (status) => {
          setCompressionStatus(status);
        });

        setSelectedCoverFile(result.file);
        setCompressionStatus(null);

        // Create preview URL with compressed image
        if (coverPreviewUrl) {
          URL.revokeObjectURL(coverPreviewUrl);
        }
        const url = URL.createObjectURL(result.file);
        setCoverPreviewUrl(url);
      } catch (compressionError) {
        console.error('Image compression failed:', compressionError);
        setError('Failed to compress image. Please try a different image.');
        setCompressionStatus(null);
        setSelectedCoverFile(null);
      }
    }
  };

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      
      // Validate each file using security utility
      const validFiles: AudioFile[] = [];
      
      for (const file of files) {
        const validation = validateAudioFile(file);
        if (!validation.valid) {
          setError(`${file.name}: ${validation.error || 'Invalid audio file'}`);
          continue;
        }
        
        // Check if file is already added
        if (audioFiles.some(af => af.file.name === file.name && af.file.size === file.size)) {
          continue; // Skip duplicates
        }
        
        validFiles.push({
          file,
          id: `${Date.now()}-${Math.random()}`,
          title: file.name.replace(/\.[^/.]+$/, ''), // Remove file extension for default title
          featuredArtists: []
        });
      }
      
      if (validFiles.length > 0) {
        setAudioFiles(prev => [...prev, ...validFiles]);
        setError(null);
      }
    }
  };

  const addSingleTrack = () => {
    // Trigger file input for single track
    const fileInput = document.getElementById('single-audio-upload') as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  };

  const handleSingleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      
      // Validate audio file using security utility
      const validation = validateAudioFile(file);
      if (!validation.valid) {
        setError(`${file.name}: ${validation.error || 'Invalid audio file'}`);
        return;
      }
      
      // Check if file is already added
      if (audioFiles.some(af => af.file.name === file.name && af.file.size === file.size)) {
        setError('This track has already been added.');
        return;
      }
      
      const newAudioFile: AudioFile = {
        file,
        id: `${Date.now()}-${Math.random()}`,
        title: file.name.replace(/\.[^/.]+$/, ''), // Remove file extension for default title
        featuredArtists: []
      };
      
      setAudioFiles(prev => [...prev, newAudioFile]);
      setError(null);
      
      // Reset file input
      e.target.value = '';
    }
  };

  const removeAudioFile = (audioFileId: string) => {
    setAudioFiles(prev => prev.filter(af => af.id !== audioFileId));
  };

  const removeCoverImage = () => {
    setSelectedCoverFile(null);
    if (coverPreviewUrl) {
      URL.revokeObjectURL(coverPreviewUrl);
      setCoverPreviewUrl(null);
    }
    
    // Reset file input
    const fileInput = document.getElementById('cover-upload') as HTMLInputElement;
    if (fileInput) {
      fileInput.value = '';
    }
  };

  const updateAudioFileTitle = (audioFileId: string, newTitle: string) => {
    setAudioFiles(prev => 
      prev.map(af => 
        af.id === audioFileId ? { ...af, title: newTitle } : af
      )
    );
  };

  const addFeaturedArtist = (audioFileId: string) => {
    const artistName = newFeaturedArtist[audioFileId]?.trim();
    if (!artistName) return;

    setAudioFiles(prev => 
      prev.map(af => 
        af.id === audioFileId 
          ? { ...af, featuredArtists: [...af.featuredArtists, artistName] }
          : af
      )
    );

    // Clear the input for this audio file
    setNewFeaturedArtist(prev => ({
      ...prev,
      [audioFileId]: ''
    }));
  };

  const removeFeaturedArtist = (audioFileId: string, artistIndex: number) => {
    setAudioFiles(prev => 
      prev.map(af => 
        af.id === audioFileId 
          ? { ...af, featuredArtists: af.featuredArtists.filter((_, index) => index !== artistIndex) }
          : af
      )
    );
  };

  const handleFeaturedArtistInputChange = (audioFileId: string, value: string) => {
    setNewFeaturedArtist(prev => ({
      ...prev,
      [audioFileId]: value
    }));
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

      setCompressionStatus(null);
      return result.publicUrl;
    } catch (error) {
      console.error('Error uploading file to Bunny.net:', error);
      setCompressionStatus(null);
      throw new Error(`Upload failed for ${file.name}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  const getAudioDuration = async (audioUrl: string): Promise<number> => {
    return new Promise((resolve) => {
      const audio = new Audio(audioUrl);
      audio.onloadedmetadata = () => {
        resolve(audio.duration);
      };
      audio.onerror = () => {
        console.warn('Could not load audio metadata for duration, defaulting to 0.');
        resolve(0);
      };
      audio.load();
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setUploadProgress('');

    // Validation
    if (!formData.title.trim()) {
      setError('Album title is required.');
      return;
    }

    if (!isEditMode && audioFiles.length === 0) {
      setError('Please add at least one audio file to the album.');
      return;
    }

    if (!isEditMode && !selectedCoverFile && !coverPreviewUrl) {
      setError('Album cover image is required.');
      return;
    }

    if (!formData.genre) {
      setError('Please select a genre for your album.');
      return;
    }

    // Check for empty song titles
    const emptyTitles = audioFiles.filter(af => !af.title.trim());
    if (emptyTitles.length > 0) {
      setError('Please provide titles for all songs.');
      return;
    }

    setIsSubmitting(true);

    const taskId = `album-${Date.now()}`;
    setUploadTaskId(taskId);

    addUpload({
      id: taskId,
      type: 'album',
      title: formData.title.trim()
    });

    try {
      // Verify authentication
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        throw new Error('User not authenticated. Please sign in.');
      }

      // Handle Edit Mode
      if (isEditMode && initialData?.id) {
        setUploadProgress('Updating album...');

        // Upload new cover image if selected
        let coverImageUrl = coverPreviewUrl || initialData.cover_image_url;
        if (selectedCoverFile) {
          setUploadProgress('Uploading new cover image...');
          const coverPath = createSafeFilePath(user.id, 'albums/covers', selectedCoverFile.name, ALLOWED_IMAGE_EXTENSIONS);
          if (!coverPath) {
            throw new Error('Invalid image file. Please upload a valid image file.');
          }
          coverImageUrl = await uploadFile(selectedCoverFile, coverPath, taskId);
        }

        // Update album record
        const { error: albumUpdateError } = await supabase
          .from('albums')
          .update({
            title: formData.title.trim(),
            description: formData.description.trim() || null,
            cover_image_url: coverImageUrl,
            release_date: formData.releaseDate || null,
          })
          .eq('id', initialData.id);

        if (albumUpdateError) {
          throw new Error(`Failed to update album: ${albumUpdateError.message}`);
        }

        // Update content_upload entry if exists
        const { error: contentUpdateError } = await supabase
          .from('content_uploads')
          .update({
            title: formData.title.trim(),
            description: formData.description.trim() || null,
            metadata: {
              ...initialData.metadata,
              cover_url: coverImageUrl,
              release_date: formData.releaseDate || null,
              genre: formData.genre || null,
            },
          })
          .eq('metadata->>album_id', initialData.id);

        if (contentUpdateError) {
          console.error('Error updating content_upload entry:', contentUpdateError);
        }

        setSuccess(`Album "${formData.title}" updated successfully!`);
        setUploadProgress('');

        // Update upload status to trigger notification
        updateUploadStatus(taskId, 'completed');

        // Clear caches when editing to ensure new data is used
        if (initialData?.id) {
          cache.deletePattern(`album.*${initialData.id}`);
          cache.deletePattern('trending.*');
          cache.deletePattern('home.*');
          cache.deletePattern('new.*release.*');
          await smartCache.invalidate(`album.*${initialData.id}`);
          await smartCache.invalidate('trending.*');
          await smartCache.invalidate('home.*');
          await smartCache.invalidate('new.*release.*');
        }

        setTimeout(() => {
          onSuccess?.();
          onClose();
        }, 2000);
        return;
      }

      // Get artist profile (for create mode)
      setUploadProgress('Verifying artist profile...');
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
          // Artist doesn't exist, create it
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

      // Upload cover image (required for create mode)
      if (!selectedCoverFile) {
        throw new Error('Cover image is required for album creation.');
      }
      setUploadProgress('Uploading cover image...');
      const coverPath = createSafeFilePath(user.id, 'albums/covers', selectedCoverFile.name, ALLOWED_IMAGE_EXTENSIONS);
      if (!coverPath) {
        throw new Error('Invalid image file. Please upload a valid image file.');
      }
      const coverImageUrl = await uploadFile(selectedCoverFile, coverPath, taskId);

      // Create album record
      setUploadProgress('Creating album...');
      const { data: albumData, error: albumError } = await supabase
        .from('albums')
        .insert({
          title: formData.title.trim(),
          artist_id: finalArtistId,
          cover_image_url: coverImageUrl,
          release_date: formData.releaseDate || null,
          description: formData.description.trim() || null,
        })
        .select()
        .single();

      if (albumError) {
        throw new Error(`Failed to create album: ${albumError.message}`);
      }

      // Link album to genre, subgenres, and moods
      if (selectedGenreId) {
        try {
          // Link album to primary genre
          await supabase
            .from('album_genres')
            .insert({
              album_id: albumData.id,
              genre_id: selectedGenreId
            });

          // Link album to subgenre
          if (selectedSubgenreId) {
            await supabase
              .from('album_subgenres')
              .insert({
                album_id: albumData.id,
                subgenre_id: selectedSubgenreId
              });
          }

          // Link album to moods (up to 2)
          if (selectedMoods.length > 0) {
            const moodInserts = selectedMoods.map(moodId => ({
              album_id: albumData.id,
              mood_id: moodId
            }));
            await supabase
              .from('album_moods')
              .insert(moodInserts);
          }
        } catch (linkError) {
          console.error('Error linking album to genres/subgenres/moods:', linkError);
          // Don't fail the upload if linking fails
        }
      }

      // Upload audio files in parallel and create song records
      const songIds: string[] = [];
      const totalFiles = audioFiles.length;

      setUploadProgress(`Uploading ${totalFiles} songs in parallel...`);

      // Prepare upload tasks
      const filesToUpload = audioFiles.map((audioFile) => {
        const audioPath = createSafeFilePath(user.id, `albums/${albumData.id}/songs`, audioFile.file.name, ALLOWED_AUDIO_EXTENSIONS);
        if (!audioPath) {
          console.error(`Invalid audio file: ${audioFile.file.name}`);
          return null;
        }
        return {
          file: audioFile.file,
          path: audioPath,
          audioFile, // Keep reference to original audio file data
        };
      }).filter(Boolean) as Array<{ file: File; path: string; audioFile: AudioFile }>;

      // Create parallel upload manager
      const uploadManager = new ParallelUploadManager({
        maxConcurrency: 3, // Upload 3 files at once
        maxRetries: 3, // Retry up to 3 times on failure
        uploadFunction: async (file, path, onProgress) => {
          return await uploadFile(file, path, taskId);
        },
        onProgress: (progress) => {
          setUploadProgress(
            `Uploading songs: ${progress.completedFiles}/${progress.totalFiles} completed (${progress.overallProgress}%)`
          );
          updateUploadProgress(taskId, progress.overallProgress);
        },
        onFileFailed: (task) => {
          console.error(`Failed to upload ${task.file.name}:`, task.error);
        },
      });

      // Add files to upload queue
      uploadManager.addFiles(filesToUpload.map(item => ({ file: item.file, path: item.path })));

      // Start parallel uploads
      const uploadResults = await uploadManager.uploadAll();

      // Get successful uploads
      const successfulUploads = uploadManager.getCompletedUploads();
      const failedUploads = uploadManager.getFailedUploads();

      if (failedUploads.length > 0) {
        console.warn(`${failedUploads.length} file(s) failed to upload:`, failedUploads.map(t => t.file.name));
      }

      // Create song records for successful uploads
      setUploadProgress('Creating song records...');

      // Prepare all song inserts
      const songInserts = await Promise.all(
        successfulUploads.map(async (uploadTask) => {
          const audioFileData = filesToUpload.find(item => item.file === uploadTask.file);
          if (!audioFileData || !uploadTask.result) return null;

          // Get audio duration
          const duration = await getAudioDuration(uploadTask.result);

          return {
            title: audioFileData.audioFile.title.trim(),
            artist_id: finalArtistId,
            album_id: albumData.id,
            duration_seconds: Math.round(duration),
            audio_url: uploadTask.result,
            cover_image_url: coverImageUrl,
            release_date: formData.releaseDate || null,
            country: location?.location?.countryCode || null,
            featured_artists: audioFileData.audioFile.featuredArtists.length > 0
              ? audioFileData.audioFile.featuredArtists
              : null,
          };
        })
      );

      // Filter out nulls and insert all songs at once
      const validSongInserts = songInserts.filter(Boolean);

      if (validSongInserts.length > 0) {
        const { data: songsData, error: songsError } = await supabase
          .from('songs')
          .insert(validSongInserts)
          .select();

        if (songsError) {
          console.error('Error creating songs:', songsError);
          throw new Error(`Failed to create song records: ${songsError.message}`);
        }

        songIds.push(...songsData.map(s => s.id));

        // Batch link songs to genres, subgenres, and moods
        if (selectedGenreId && songsData.length > 0) {
          try {
            // Batch insert genre links
            const genreLinks = songsData.map(song => ({
              song_id: song.id,
              genre_id: selectedGenreId
            }));
            await supabase.from('song_genres').insert(genreLinks);

            // Batch insert subgenre links
            if (selectedSubgenreId) {
              const subgenreLinks = songsData.map(song => ({
                song_id: song.id,
                subgenre_id: selectedSubgenreId
              }));
              await supabase.from('song_subgenres').insert(subgenreLinks);
            }

            // Batch insert mood links
            if (selectedMoods.length > 0) {
              const moodLinks = songsData.flatMap(song =>
                selectedMoods.map(moodId => ({
                  song_id: song.id,
                  mood_id: moodId,
                  confidence_score: 1.0
                }))
              );
              await supabase.from('song_moods').insert(moodLinks);
            }
          } catch (genreError) {
            console.error('Error linking songs to genres/subgenres/moods:', genreError);
            // Don't fail the upload if linking fails
          }
        }
      }

      // Create content_upload entry for the album (CRITICAL for Library visibility)
      setUploadProgress('Finalizing album...');
      const { data: contentUploadData, error: contentUploadError } = await supabase
        .from('content_uploads')
        .insert({
          user_id: user.id,
          artist_profile_id: artistProfile.id,
          content_type: 'album',
          title: formData.title.trim(),
          description: formData.description.trim() || null,
          status: 'approved', // Auto-approve albums for now
          metadata: {
            album_id: albumData.id,
            cover_url: coverImageUrl,
            song_ids: songIds,
            tracks_count: songIds.length,
            release_date: formData.releaseDate || null,
            total_duration: audioFiles.length * 180, // Rough estimate, could be calculated more precisely
            genre: formData.genre || null,
            featured_artists: audioFiles.reduce((acc, af) => {
              if (af.featuredArtists.length > 0) {
                acc[af.title] = af.featuredArtists;
              }
              return acc;
            }, {} as Record<string, string[]>)
          },
        })
        .select()
        .single();

      if (contentUploadError) {
        console.error('ERROR: Failed to create content_upload entry:', contentUploadError);
        console.error('Album was created but will NOT appear in Library!');
        console.error('Error details:', {
          message: contentUploadError.message,
          code: contentUploadError.code,
          details: contentUploadError.details,
          hint: contentUploadError.hint
        });
        throw new Error(`Album created but failed to add to Library: ${contentUploadError.message}. Please contact support with album ID: ${albumData.id}`);
      }

      if (!contentUploadData) {
        console.error('ERROR: No content_upload data returned after insert!');
        throw new Error('Album created but failed to register in Library. Please try refreshing the page.');
      }

      console.log('✅ Album successfully added to content_uploads:', contentUploadData.id);

      setSuccess(`Album "${formData.title}" uploaded successfully with ${songIds.length} songs!`);
      setUploadProgress('');

      // Update upload status to trigger notification
      updateUploadStatus(taskId, 'completed');

      // Clear ALL caches to ensure album appears immediately
      cache.deletePattern('library.*');
      cache.deletePattern('uploads.*');
      cache.deletePattern('home.*');
      cache.deletePattern('trending.*');
      cache.deletePattern('explore.*');
      await smartCache.invalidate('library.*');
      await smartCache.invalidate('uploads.*');
      await smartCache.invalidate('home.*');
      await smartCache.invalidate('explore.*');

      console.log('✅ Caches cleared - album will appear in Library and Explore immediately');

      resetForm();

      // Close modal after a short delay to show success message
      setTimeout(() => {
        onSuccess?.();
        onClose();
      }, 2000);
    } catch (err) {
      console.error('Album upload process failed:', err);
      const errorMessage = err instanceof Error ? err.message : 'An unexpected error occurred during upload.';
      setError(errorMessage);
      setUploadProgress('');

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
    setSelectedCoverFile(null);
    setAudioFiles([]);
    if (coverPreviewUrl) {
      URL.revokeObjectURL(coverPreviewUrl);
      setCoverPreviewUrl(null);
    }
    
    // Reset file inputs
    const coverInput = document.getElementById('cover-upload') as HTMLInputElement;
    const audioInput = document.getElementById('audio-upload') as HTMLInputElement;
    const singleAudioInput = document.getElementById('single-audio-upload') as HTMLInputElement;
    if (coverInput) coverInput.value = '';
    if (audioInput) audioInput.value = '';
    if (singleAudioInput) singleAudioInput.value = '';
  };

  const formatFileSize = (bytes: number): string => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header - Fixed */}
        <div className="sticky top-0 z-10 bg-gradient-to-b from-white to-transparent backdrop-blur-sm px-6 py-5 border-b border-gray-100 rounded-t-2xl">
          <div className="flex items-start justify-between">
            <h2 className="font-['Inter',sans-serif] text-3xl font-black tracking-tight text-gray-900 leading-none">
              {isEditMode ? 'Editing' : 'Curate your'}<br />
              <span className="font-light italic text-gray-400">{isEditMode ? 'album.' : 'collection.'}</span>
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
            {/* Album Title */}
            <div>
              <label className="flex items-center gap-2 font-['Inter',sans-serif] font-medium text-gray-700 text-sm mb-3">
                <Music className="w-4 h-4 text-[#309605]" />
                Album Title *
              </label>
              <input
                type="text"
                name="title"
                value={formData.title}
                onChange={handleInputChange}
                className="w-full h-12 px-4 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#309605] focus:border-[#309605] transition-all duration-200"
                placeholder="Enter album title"
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
                rows={3}
                className="w-full px-4 py-3 bg-white border border-gray-300 rounded-xl text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#309605] focus:border-[#309605] transition-all duration-200 resize-none"
                placeholder="Tell us about your album..."
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
                  Select moods that match your album's vibe
                </p>
              )}
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

            {/* Cover Image Upload */}
            <div>
              <label className="flex items-center gap-2 font-['Inter',sans-serif] font-medium text-gray-700 text-sm mb-2">
                <Image className="w-4 h-4 text-[#309605]" />
                Album Cover {isEditMode ? '(Optional - Replace if needed)' : '*'}
              </label>
              <p className="font-['Inter',sans-serif] text-gray-500 text-xs mb-3">
                Images will be automatically optimized to 467x467px
              </p>

              {coverPreviewUrl ? (
                <div className="relative">
                  <div className="w-full h-48 rounded-xl overflow-hidden bg-gray-100 mb-3">
                    <img
                      src={coverPreviewUrl}
                      alt="Cover preview"
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={removeCoverImage}
                    className="absolute top-3 right-3 w-8 h-8 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center transition-colors duration-200 shadow-lg"
                  >
                    <X className="w-4 h-4 text-white" />
                  </button>
                  {selectedCoverFile ? (
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <Image className="w-4 h-4 text-green-600" />
                      <div className="flex-1 min-w-0">
                        <p className="font-['Inter',sans-serif] text-gray-900 text-sm font-medium truncate">
                          {selectedCoverFile.name}
                        </p>
                        <p className="font-['Inter',sans-serif] text-gray-500 text-xs">
                          {formatFileSize(selectedCoverFile.size)}
                        </p>
                      </div>
                    </div>
                  ) : isEditMode ? (
                    <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                      <Image className="w-4 h-4 text-blue-600" />
                      <div className="flex-1 min-w-0">
                        <p className="font-['Inter',sans-serif] text-blue-700 text-sm font-medium">
                          Current album cover
                        </p>
                        <p className="font-['Inter',sans-serif] text-blue-600 text-xs">
                          Upload a new image to replace
                        </p>
                      </div>
                    </div>
                  ) : null}
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
                      Click to upload album cover {isEditMode ? '' : '*'}
                    </p>
                    <p className="font-['Inter',sans-serif] text-gray-500 text-xs">
                      JPEG, PNG, WebP (max 5MB)
                    </p>
                  </label>
                </div>
              )}
            </div>

            {/* Existing Songs Display (Edit Mode) */}
            {isEditMode && existingSongs.length > 0 && (
              <div>
                <label className="flex items-center gap-2 font-['Inter',sans-serif] font-medium text-gray-700 text-sm mb-3">
                  <Music className="w-4 h-4 text-[#309605]" />
                  Album Tracks ({existingSongs.length})
                </label>
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {existingSongs.map((song, index) => (
                    <div key={song.id} className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                      <div className="w-8 h-8 bg-[#309605] text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                        {index + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-['Inter',sans-serif] text-gray-900 text-sm font-medium truncate">
                          {song.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <Music className="w-3 h-3 text-gray-500" />
                          <p className="font-['Inter',sans-serif] text-gray-500 text-xs">
                            {song.duration_seconds ? `${Math.floor(song.duration_seconds / 60)}:${String(song.duration_seconds % 60).padStart(2, '0')}` : 'Unknown duration'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                        <span className="font-['Inter',sans-serif] text-gray-500 text-xs">Published</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="font-['Inter',sans-serif] text-blue-700 text-xs">
                    Note: You can update album details above. To modify songs, please delete and re-upload the album.
                  </p>
                </div>
              </div>
            )}

            {/* Loading State for Album Data */}
            {isEditMode && isLoadingAlbumData && (
              <div className="p-8 text-center">
                <div className="w-8 h-8 border-2 border-[#309605] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                <p className="font-['Inter',sans-serif] text-gray-600 text-sm">Loading album data...</p>
              </div>
            )}

            {/* Audio Files Upload */}
            {!isEditMode && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="flex items-center gap-2 font-['Inter',sans-serif] font-medium text-gray-700 text-sm">
                  <Music className="w-4 h-4 text-[#309605]" />
                  Album Tracks *
                </label>
                <span className="font-['Inter',sans-serif] text-gray-500 text-xs">
                  {audioFiles.length} track{audioFiles.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Add Tracks Buttons */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <button
                  type="button"
                  onClick={addSingleTrack}
                  className="flex items-center justify-center gap-2 h-12 bg-[#309605] hover:bg-[#3ba208] text-white rounded-xl font-['Inter',sans-serif] font-medium text-sm transition-all duration-200 shadow-lg shadow-[#309605]/25"
                >
                  <Plus className="w-4 h-4" />
                  Add Track
                </button>

                <div className="relative">
                  <input
                    type="file"
                    accept="audio/mpeg, audio/mp3, .mp3"
                    multiple
                    onChange={handleAudioUpload}
                    className="hidden"
                    id="audio-upload"
                  />
                  <label
                    htmlFor="audio-upload"
                    className="flex items-center justify-center gap-2 h-12 bg-white border-2 border-[#309605] text-[#309605] hover:bg-[#309605] hover:text-white rounded-xl font-['Inter',sans-serif] font-medium text-sm transition-all duration-200 cursor-pointer"
                  >
                    <Music className="w-4 h-4" />
                    Add Multiple
                  </label>
                </div>
              </div>

              {/* Hidden single file input */}
              <input
                type="file"
                accept="audio/mpeg, audio/mp3, .mp3"
                onChange={handleSingleAudioUpload}
                className="hidden"
                id="single-audio-upload"
              />

              {/* Selected Audio Files */}
              {audioFiles.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-['Inter',sans-serif] font-medium text-gray-700 text-sm">
                    Album Tracks ({audioFiles.length})
                  </h4>
                  <div className="space-y-3 max-h-64 overflow-y-auto">
                    {audioFiles.map((audioFile, index) => (
                      <div key={audioFile.id} className="flex items-start gap-3 p-4 bg-gray-50 rounded-xl border border-gray-200">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-8 h-8 bg-[#309605] text-white rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0">
                            {index + 1}
                          </div>
                          <div className="flex-1 min-w-0 space-y-2">
                            <input
                              type="text"
                              value={audioFile.title}
                              onChange={(e) => updateAudioFileTitle(audioFile.id, e.target.value)}
                              className="w-full px-3 py-2 text-sm text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#309605] focus:border-[#309605] transition-all duration-200"
                              placeholder="Song title"
                            />

                            {/* Featured Artists Section */}
                            <div className="space-y-2">
                              <label className="block text-gray-600 text-xs font-medium">
                                Featured Artist(s) (Optional)
                              </label>

                              {/* Featured Artists List */}
                              {audioFile.featuredArtists.length > 0 && (
                                <div className="flex flex-wrap gap-1 mb-2">
                                  {audioFile.featuredArtists.map((artist, artistIndex) => (
                                    <div
                                      key={artistIndex}
                                      className="flex items-center gap-1 px-2 py-1 bg-blue-100 text-blue-700 rounded-full text-xs"
                                    >
                                      <span>{artist}</span>
                                      <button
                                        type="button"
                                        onClick={() => removeFeaturedArtist(audioFile.id, artistIndex)}
                                        className="w-3 h-3 rounded-full flex items-center justify-center hover:bg-blue-200 transition-colors duration-200"
                                      >
                                        <X className="w-2 h-2" />
                                      </button>
                                    </div>
                                  ))}
                                </div>
                              )}

                              {/* Add Featured Artist Input */}
                              <div className="flex gap-2">
                                <input
                                  type="text"
                                  value={newFeaturedArtist[audioFile.id] || ''}
                                  onChange={(e) => handleFeaturedArtistInputChange(audioFile.id, e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      addFeaturedArtist(audioFile.id);
                                    }
                                  }}
                                  className="flex-1 px-3 py-1.5 text-xs text-gray-900 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#309605] focus:border-[#309605] transition-all duration-200"
                                  placeholder="Enter featured artist name"
                                />
                                <button
                                  type="button"
                                  onClick={() => addFeaturedArtist(audioFile.id)}
                                  disabled={!newFeaturedArtist[audioFile.id]?.trim()}
                                  className="px-3 py-1.5 bg-[#309605] hover:bg-[#3ba208] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg text-white text-xs font-medium transition-all duration-200"
                                >
                                  Add
                                </button>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <Music className="w-3 h-3 text-gray-500" />
                              <p className="font-['Inter',sans-serif] text-gray-500 text-xs truncate">
                                {audioFile.file.name}
                              </p>
                              <span className="font-['Inter',sans-serif] text-gray-400 text-xs">
                                ({formatFileSize(audioFile.file.size)})
                              </span>
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeAudioFile(audioFile.id)}
                          className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-full transition-colors duration-200 flex-shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty State */}
              {audioFiles.length === 0 && (
                <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
                  <Music className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                  <p className="font-['Inter',sans-serif] font-medium text-gray-700 text-sm mb-2">
                    No tracks added yet
                  </p>
                  <p className="font-['Inter',sans-serif] text-gray-500 text-xs">
                    MP3 format only (128-320 kbps recommended)
                  </p>
                </div>
              )}
            </div>
            )}

            {/* Compression Status */}
            {compressionStatus && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="font-['Inter',sans-serif] text-blue-700 text-sm">{compressionStatus}</p>
                </div>
              </div>
            )}

            {/* Upload Progress */}
            {uploadProgress && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
                  <p className="font-['Inter',sans-serif] text-blue-700 text-sm">{uploadProgress}</p>
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
              disabled={isSubmitting || !formData.title.trim() || (!isEditMode && (audioFiles.length === 0 || !selectedCoverFile)) || !formData.genre}
              className="flex-1 h-12 px-4 bg-gradient-to-r from-[#309605] to-[#3ba208] hover:from-[#3ba208] hover:to-[#3ba208] text-white rounded-xl font-['Inter',sans-serif] font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[#309605]/25"
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>{isEditMode ? 'Updating...' : 'Uploading...'}</span>
                </div>
              ) : (
                isEditMode ? 'Update Album' : 'Upload Album'
              )}
            </button>
          </div>

          {/* Form validation hint */}
          <div className="mt-3 text-center">
            <p className="font-['Inter',sans-serif] text-gray-500 text-xs">
              {!formData.title.trim() ? 'Album title required' :
               !isEditMode && audioFiles.length === 0 ? 'Add at least one track' :
               !isEditMode && !selectedCoverFile ? 'Album cover required' :
               !formData.genre ? 'Genre selection required' :
               !isEditMode && audioFiles.some(af => !af.title.trim()) ? 'All tracks need titles' :
               isEditMode ? 'Ready to update album' :
               `Ready to upload ${audioFiles.length} track${audioFiles.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}