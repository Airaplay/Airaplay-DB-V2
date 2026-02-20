/*
  # App Sections Configuration System

  1. New Tables
    - `app_sections`
      - `id` (uuid, primary key)
      - `section_key` (text, unique) - Internal identifier (e.g., 'trending', 'new_releases')
      - `section_name` (text) - Display name for admin
      - `section_component` (text) - Component identifier
      - `is_enabled` (boolean) - Whether section is active
      - `display_order` (integer) - Order in which sections appear
      - `settings` (jsonb) - Flexible settings for each section
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `app_sections` table
    - Add policy for public read access
    - Add policy for admin-only write access

  3. Initial Data
    - Populate with existing sections configuration
*/

-- Create app_sections table
CREATE TABLE IF NOT EXISTS app_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_key text UNIQUE NOT NULL,
  section_name text NOT NULL,
  section_component text NOT NULL,
  is_enabled boolean DEFAULT true,
  display_order integer NOT NULL,
  settings jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE app_sections ENABLE ROW LEVEL SECURITY;

-- Policy for public read access
CREATE POLICY "Anyone can view enabled app sections"
  ON app_sections
  FOR SELECT
  USING (true);

-- Policy for admin insert
CREATE POLICY "Admins can insert app sections"
  ON app_sections
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  );

-- Policy for admin update
CREATE POLICY "Admins can update app sections"
  ON app_sections
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  );

-- Policy for admin delete
CREATE POLICY "Admins can delete app sections"
  ON app_sections
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role = 'admin'
    )
  );

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_app_sections_enabled ON app_sections(is_enabled);
CREATE INDEX IF NOT EXISTS idx_app_sections_order ON app_sections(display_order);

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_app_sections_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER app_sections_updated_at
  BEFORE UPDATE ON app_sections
  FOR EACH ROW
  EXECUTE FUNCTION update_app_sections_updated_at();

-- Insert default sections
INSERT INTO app_sections (section_key, section_name, section_component, is_enabled, display_order, settings)
VALUES
  ('hero', 'Hero Section', 'HeroSection', true, 1, '{"showNotifications": true, "showSearch": true}'::jsonb),
  ('trending', 'Global Trending', 'TrendingSection', true, 2, '{"limit": 25, "refreshInterval": 600000, "enablePromotions": true}'::jsonb),
  ('trending_near_you', 'Trending Near You', 'TrendingNearYouSection', true, 3, '{"limit": 50, "minPlayCount": 50, "refreshInterval": 3600000}'::jsonb),
  ('loops', 'Short Clips', 'LoopsSection', true, 4, '{"limit": 20}'::jsonb),
  ('inspired_by_you', 'Recommended for You', 'InspiredByYouSection', true, 5, '{"personalizedCount": 12, "newSimilarCount": 6, "surpriseCount": 2, "enablePromotions": true}'::jsonb),
  ('must_watch', 'Must Watch', 'MustWatchSection', true, 6, '{"limit": 20, "sortByPopularity": true, "shuffleInterval": 900000, "enablePromotions": true}'::jsonb),
  ('new_releases', 'New Releases', 'NewReleasesSection', true, 7, '{"limit": 22, "daysRange": 30, "shuffleInterval": 300000, "enablePromotions": true}'::jsonb),
  ('top_artiste', 'Top Artists', 'TopArtisteSection', true, 8, '{"limit": 20}'::jsonb),
  ('trending_albums', 'Trending Albums', 'TrendingAlbumsSection', true, 9, '{"limit": 20, "daysRange": 30, "shuffleInterval": 600000, "enablePromotions": true}'::jsonb),
  ('ai_recommended', 'AI Recommended', 'AIRecommendedSection', true, 10, '{"limit": 20}'::jsonb),
  ('mix_for_you', 'Mix for You', 'MixForYouSection', true, 11, '{"limit": 10}'::jsonb)
ON CONFLICT (section_key) DO NOTHING;
