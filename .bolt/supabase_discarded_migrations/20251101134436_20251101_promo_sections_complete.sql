/*
  # Ensure Complete Promotion Sections Configuration

  1. Overview
    - Verify all promotion sections exist for all content types
    - Ensure pricing is set up for all section-content type combinations
    - Verify sections are properly sorted
    - Add any missing sections or pricing configurations

  2. Changes
    - Insert any missing promotion_section_pricing entries
    - Fix sort_order for all sections
    - Ensure all sections are active and accessible

  3. Content Type Availability (for creators)
    - Song: Now Trending, New Release, AI Recommended, Inspired By You, Trending Album
    - Album: Trending Album
    - Video: Must Watch
    - Short Clip: Loops
    - Profile: Top Artist
*/

-- Update sort_order for all sections to ensure proper ordering
UPDATE promotion_sections SET sort_order = 1 WHERE section_key = 'now_trending';
UPDATE promotion_sections SET sort_order = 2 WHERE section_key = 'new_release';
UPDATE promotion_sections SET sort_order = 3 WHERE section_key = 'ai_recommended';
UPDATE promotion_sections SET sort_order = 4 WHERE section_key = 'inspired_by_you';
UPDATE promotion_sections SET sort_order = 5 WHERE section_key = 'trending_album';
UPDATE promotion_sections SET sort_order = 6 WHERE section_key = 'must_watch';
UPDATE promotion_sections SET sort_order = 7 WHERE section_key = 'loops';
UPDATE promotion_sections SET sort_order = 8 WHERE section_key = 'top_artist';
UPDATE promotion_sections SET sort_order = 9 WHERE section_key = 'mix_for_you';
UPDATE promotion_sections SET sort_order = 10 WHERE section_key = 'trending_near_you';

-- Ensure all promotion sections are active
UPDATE promotion_sections SET is_active = true WHERE is_active = false;

-- Delete any orphaned pricing entries (section doesn't exist)
DELETE FROM promotion_section_pricing 
WHERE section_id NOT IN (SELECT id FROM promotion_sections);

-- Delete any inactive pricing entries and recreate them as active
DELETE FROM promotion_section_pricing WHERE is_active = false;

-- Recreate all pricing for song content type across all applicable sections
DELETE FROM promotion_section_pricing 
WHERE content_type = 'song' 
  AND section_id IN (
    SELECT id FROM promotion_sections 
    WHERE section_key IN ('now_trending', 'new_release', 'ai_recommended', 'inspired_by_you', 'trending_album', 'trending_near_you')
  );

INSERT INTO promotion_section_pricing (section_id, content_type, treats_cost, duration_hours, is_active)
SELECT ps.id, 'song', 800, 24, true
FROM promotion_sections ps
WHERE ps.section_key IN ('now_trending', 'new_release', 'ai_recommended', 'inspired_by_you', 'trending_album', 'trending_near_you')
ON CONFLICT (section_id, content_type) DO UPDATE SET is_active = true;

-- Ensure album pricing across applicable sections
DELETE FROM promotion_section_pricing 
WHERE content_type = 'album' 
  AND section_id IN (
    SELECT id FROM promotion_sections 
    WHERE section_key IN ('trending_album')
  );

INSERT INTO promotion_section_pricing (section_id, content_type, treats_cost, duration_hours, is_active)
SELECT ps.id, 'album', 1200, 24, true
FROM promotion_sections ps
WHERE ps.section_key = 'trending_album'
ON CONFLICT (section_id, content_type) DO UPDATE SET is_active = true;

-- Ensure video pricing
DELETE FROM promotion_section_pricing 
WHERE content_type = 'video' 
  AND section_id IN (
    SELECT id FROM promotion_sections 
    WHERE section_key = 'must_watch'
  );

INSERT INTO promotion_section_pricing (section_id, content_type, treats_cost, duration_hours, is_active)
SELECT ps.id, 'video', 1000, 24, true
FROM promotion_sections ps
WHERE ps.section_key = 'must_watch'
ON CONFLICT (section_id, content_type) DO UPDATE SET is_active = true;

-- Ensure short_clip pricing
DELETE FROM promotion_section_pricing 
WHERE content_type = 'short_clip' 
  AND section_id IN (
    SELECT id FROM promotion_sections 
    WHERE section_key = 'loops'
  );

INSERT INTO promotion_section_pricing (section_id, content_type, treats_cost, duration_hours, is_active)
SELECT ps.id, 'short_clip', 600, 24, true
FROM promotion_sections ps
WHERE ps.section_key = 'loops'
ON CONFLICT (section_id, content_type) DO UPDATE SET is_active = true;

-- Ensure profile pricing
DELETE FROM promotion_section_pricing 
WHERE content_type = 'profile' 
  AND section_id IN (
    SELECT id FROM promotion_sections 
    WHERE section_key = 'top_artist'
  );

INSERT INTO promotion_section_pricing (section_id, content_type, treats_cost, duration_hours, is_active)
SELECT ps.id, 'profile', 1500, 24, true
FROM promotion_sections ps
WHERE ps.section_key = 'top_artist'
ON CONFLICT (section_id, content_type) DO UPDATE SET is_active = true;

-- Ensure mix pricing (if mix_for_you section exists)
INSERT INTO promotion_section_pricing (section_id, content_type, treats_cost, duration_hours, is_active)
SELECT ps.id, 'album', 1200, 24, true
FROM promotion_sections ps
WHERE ps.section_key = 'mix_for_you'
ON CONFLICT (section_id, content_type) DO NOTHING;

-- Verify all pricing entries are active
UPDATE promotion_section_pricing SET is_active = true WHERE is_active = false;
