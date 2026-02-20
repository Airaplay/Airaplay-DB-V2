/*
  # Add Missing Promotion Sections

  1. Changes
    - Add missing promotion sections: mix_for_you, trending_near_you
    - Add pricing for these new sections

  2. Sections Added
    - Mix for You: Boost curated mixes in the Mix for You section
    - Trending Near You: Boost songs in the location-based trending section

  3. Security
    - Follows existing RLS policies for promotion_sections and promotion_section_pricing tables
*/

-- Insert new promotion sections if they don't exist
INSERT INTO promotion_sections (section_name, section_key, description, sort_order, is_active) VALUES
  ('Mix for You', 'mix_for_you', 'Feature curated mixes in the Mix for You section', 9, true),
  ('Trending Near You', 'trending_near_you', 'Feature songs in the location-based Trending Near You section', 10, true)
ON CONFLICT (section_key) DO NOTHING;

-- Insert pricing for the new sections
INSERT INTO promotion_section_pricing (section_id, content_type, treats_cost, duration_hours, is_active)
SELECT
  ps.id,
  ct.content_type,
  ct.treats_cost,
  24,
  true
FROM promotion_sections ps
CROSS JOIN (
  VALUES
    ('album', 1200),
    ('song', 800)
) AS ct(content_type, treats_cost)
WHERE
  (ps.section_key = 'mix_for_you' AND ct.content_type = 'album')
  OR (ps.section_key = 'trending_near_you' AND ct.content_type = 'song')
ON CONFLICT (section_id, content_type) DO NOTHING;
