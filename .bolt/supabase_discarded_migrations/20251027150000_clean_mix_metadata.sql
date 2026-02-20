/*
  # Clean Mix Metadata

  1. Changes
    - Removes `song_details` from mix metadata to prevent stack depth issues
    - Keeps only essential metadata fields (cover_url, songs array, targeting info)
    - Fixes any existing mixes that have nested song_details

  2. Purpose
    - Prevents PostgreSQL "stack depth limit exceeded" errors
    - Reduces metadata size and complexity
    - Song details can be fetched dynamically using song IDs
*/

-- Clean up existing mix metadata by removing song_details
UPDATE content_uploads
SET metadata = jsonb_build_object(
  'cover_url', metadata->'cover_url',
  'cover_storage_path', metadata->'cover_storage_path',
  'songs', metadata->'songs',
  'target_countries', metadata->'target_countries',
  'target_genres', metadata->'target_genres',
  'scheduled_visibility', metadata->'scheduled_visibility',
  'is_visible', COALESCE(metadata->'is_visible', 'true'::jsonb)
)
WHERE content_type = 'mix'
  AND metadata IS NOT NULL
  AND metadata ? 'song_details';
