/*
  # Create manual trending songs table
  
  1. New Tables
    - `manual_trending_songs` - Store manually curated songs for trending sections
      - `id` (uuid, primary key)
      - `song_id` (uuid, references songs)
      - `trending_type` (text) - 'global_trending' or 'trending_near_you'
      - `country_code` (text, nullable) - For 'trending_near_you', specifies which country
      - `display_order` (integer) - Order in which songs appear (lower = first)
      - `added_by` (uuid, references users) - Admin who added the song
      - `added_at` (timestamptz) - When the song was added
      - `is_active` (boolean) - Whether the entry is active
      - `notes` (text, nullable) - Optional admin notes
  
  2. Security
    - Enable RLS on manual_trending_songs table
    - Only admins can insert/update/delete
    - Public can view active entries
    - Admins can view all entries
  
  3. Indexes
    - Index on trending_type and is_active for efficient queries
    - Index on country_code for trending_near_you queries
    - Index on display_order for sorting
*/

-- Create manual_trending_songs table
CREATE TABLE IF NOT EXISTS manual_trending_songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id uuid NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  trending_type text NOT NULL CHECK (trending_type IN ('global_trending', 'trending_near_you')),
  country_code text,
  display_order integer NOT NULL DEFAULT 0,
  added_by uuid REFERENCES users(id) ON DELETE SET NULL,
  added_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  -- Ensure country_code is provided for trending_near_you
  CONSTRAINT check_country_code CHECK (
    (trending_type = 'trending_near_you' AND country_code IS NOT NULL) OR
    (trending_type = 'global_trending' AND country_code IS NULL)
  )
);

-- Enable Row Level Security
ALTER TABLE manual_trending_songs ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Allow public to view active entries
CREATE POLICY "Public can view active manual trending songs"
ON manual_trending_songs
FOR SELECT
TO public
USING (is_active = true);

-- Allow authenticated users (admins, managers, editors) to view all entries
CREATE POLICY "Admins can view all manual trending songs"
ON manual_trending_songs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'manager', 'editor')
  )
);

-- Allow admins, managers, and editors to insert
CREATE POLICY "Admins can insert manual trending songs"
ON manual_trending_songs
FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'manager', 'editor')
  )
);

-- Allow admins, managers, and editors to update
CREATE POLICY "Admins can update manual trending songs"
ON manual_trending_songs
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'manager', 'editor')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'manager', 'editor')
  )
);

-- Allow admins, managers, and editors to delete
CREATE POLICY "Admins can delete manual trending songs"
ON manual_trending_songs
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE users.id = auth.uid()
    AND users.role IN ('admin', 'manager', 'editor')
  )
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_manual_trending_songs_type_active 
ON manual_trending_songs(trending_type, is_active) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_manual_trending_songs_country 
ON manual_trending_songs(country_code) 
WHERE trending_type = 'trending_near_you';

CREATE INDEX IF NOT EXISTS idx_manual_trending_songs_display_order 
ON manual_trending_songs(trending_type, display_order, is_active);

CREATE INDEX IF NOT EXISTS idx_manual_trending_songs_song_id 
ON manual_trending_songs(song_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_manual_trending_songs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
CREATE TRIGGER update_manual_trending_songs_updated_at
BEFORE UPDATE ON manual_trending_songs
FOR EACH ROW
EXECUTE FUNCTION update_manual_trending_songs_updated_at();

-- Add comment to table
COMMENT ON TABLE manual_trending_songs IS 'Stores manually curated songs for trending sections. Manual entries coexist with auto-trending logic.';

-- Verification query (run this to verify the migration was applied correctly)
-- SELECT 
--   table_name, 
--   column_name, 
--   data_type, 
--   is_nullable
-- FROM information_schema.columns 
-- WHERE table_name = 'manual_trending_songs'
-- ORDER BY ordinal_position;

