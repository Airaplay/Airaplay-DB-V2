/*
  # Fix Content Uploads Cascade Delete Records

  1. Problem
    - When deleting a content_uploads record, the underlying song/album/video/short_clip records remain in the database
    - This causes deleted content to still appear across the app in sections like Trending, New Releases, etc.
    - Storage files are deleted but database records persist

  2. Solution
    - Enhance the delete_content_upload_storage_files() trigger to also delete related database records
    - Delete from songs table when content_type = 'single'
    - Delete from albums table when content_type = 'album'
    - Delete from videos table when content_type = 'video'
    - Delete from short_clips table when content_type = 'short_clip'

  3. Security
    - Trigger runs with SECURITY DEFINER for proper permissions
    - Only deletes records that match the IDs stored in metadata
    - Safely handles cases where IDs don't exist

  4. Important Notes
    - This ensures complete cleanup when content is deleted from library
    - Related data (likes, comments, plays) will cascade via existing foreign keys
    - Deleted content will no longer appear in any section of the app
*/

-- ============================================
-- FUNCTION: Delete Content Upload Storage Files AND Database Records
-- ============================================

CREATE OR REPLACE FUNCTION delete_content_upload_storage_files()
RETURNS TRIGGER
SECURITY DEFINER
LANGUAGE plpgsql
AS $$
DECLARE
  storage_path text;
  cover_url text;
  audio_url text;
  video_url text;
  thumbnail_url text;
  file_url text;
  song_id_value uuid;
  album_id_value uuid;
  video_id_value uuid;
  clip_id_value uuid;
BEGIN
  -- Extract URLs from metadata JSONB
  cover_url := OLD.metadata->>'cover_url';
  audio_url := OLD.metadata->>'audio_url';
  video_url := OLD.metadata->>'video_url';
  thumbnail_url := OLD.metadata->>'thumbnail_url';
  file_url := OLD.metadata->>'file_url';

  -- Extract content IDs from metadata
  song_id_value := (OLD.metadata->>'song_id')::uuid;
  album_id_value := (OLD.metadata->>'album_id')::uuid;
  video_id_value := (OLD.metadata->>'video_id')::uuid;
  clip_id_value := (OLD.metadata->>'clip_id')::uuid;

  -- Delete cover/thumbnail file
  IF cover_url IS NOT NULL THEN
    BEGIN
      storage_path := substring(cover_url from 'content-covers/(.*)$');
      IF storage_path IS NOT NULL THEN
        PERFORM storage.delete_object('content-covers', storage_path);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to delete cover from content-covers: %', SQLERRM;
    END;
    
    BEGIN
      storage_path := substring(cover_url from 'thumbnails/(.*)$');
      IF storage_path IS NOT NULL THEN
        PERFORM storage.delete_object('thumbnails', storage_path);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to delete cover from thumbnails: %', SQLERRM;
    END;
  END IF;

  -- Delete thumbnail_url if different from cover_url
  IF thumbnail_url IS NOT NULL AND thumbnail_url != cover_url THEN
    BEGIN
      storage_path := substring(thumbnail_url from 'thumbnails/(.*)$');
      IF storage_path IS NOT NULL THEN
        PERFORM storage.delete_object('thumbnails', storage_path);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to delete thumbnail: %', SQLERRM;
    END;
  END IF;

  -- Delete audio file
  IF audio_url IS NOT NULL THEN
    BEGIN
      storage_path := substring(audio_url from 'content-media/(.*)$');
      IF storage_path IS NOT NULL THEN
        PERFORM storage.delete_object('content-media', storage_path);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to delete audio file: %', SQLERRM;
    END;
  END IF;

  -- Delete video file
  IF video_url IS NOT NULL THEN
    BEGIN
      storage_path := substring(video_url from 'content-media/(.*)$');
      IF storage_path IS NOT NULL THEN
        PERFORM storage.delete_object('content-media', storage_path);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to delete video from content-media: %', SQLERRM;
    END;
    
    BEGIN
      storage_path := substring(video_url from 'short-clips/(.*)$');
      IF storage_path IS NOT NULL THEN
        PERFORM storage.delete_object('short-clips', storage_path);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to delete video from short-clips: %', SQLERRM;
    END;
  END IF;

  -- Delete file_url (generic file field for short clips)
  IF file_url IS NOT NULL AND file_url != video_url THEN
    BEGIN
      storage_path := substring(file_url from 'short-clips/(.*)$');
      IF storage_path IS NOT NULL THEN
        PERFORM storage.delete_object('short-clips', storage_path);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to delete file from short-clips: %', SQLERRM;
    END;
    
    BEGIN
      storage_path := substring(file_url from 'content-media/(.*)$');
      IF storage_path IS NOT NULL THEN
        PERFORM storage.delete_object('content-media', storage_path);
      END IF;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to delete file from content-media: %', SQLERRM;
    END;
  END IF;

  -- ============================================
  -- DELETE DATABASE RECORDS BASED ON CONTENT TYPE
  -- ============================================

  -- Delete song record if content_type = 'single'
  IF OLD.content_type = 'single' AND song_id_value IS NOT NULL THEN
    BEGIN
      DELETE FROM songs WHERE id = song_id_value;
      RAISE NOTICE 'Deleted song record: %', song_id_value;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to delete song record: %', SQLERRM;
    END;
  END IF;

  -- Delete album record if content_type = 'album'
  IF OLD.content_type = 'album' AND album_id_value IS NOT NULL THEN
    BEGIN
      DELETE FROM albums WHERE id = album_id_value;
      RAISE NOTICE 'Deleted album record: %', album_id_value;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to delete album record: %', SQLERRM;
    END;
  END IF;

  -- Delete video record if content_type = 'video'
  IF OLD.content_type = 'video' AND video_id_value IS NOT NULL THEN
    BEGIN
      DELETE FROM videos WHERE id = video_id_value;
      RAISE NOTICE 'Deleted video record: %', video_id_value;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to delete video record: %', SQLERRM;
    END;
  END IF;

  -- Delete short_clip record if content_type = 'short_clip'
  IF OLD.content_type = 'short_clip' AND clip_id_value IS NOT NULL THEN
    BEGIN
      DELETE FROM short_clips WHERE id = clip_id_value;
      RAISE NOTICE 'Deleted short_clip record: %', clip_id_value;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Failed to delete short_clip record: %', SQLERRM;
    END;
  END IF;

  RETURN OLD;
END;
$$;