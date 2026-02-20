-- ============================================
-- CREATE MANUAL BLOWING UP SONGS TABLE
-- ============================================
-- This migration creates the manual_blowing_up_songs table
-- required for the "Blowing Up" tab in Admin Dashboard
-- 
-- INSTRUCTIONS:
-- 1. Go to your Supabase Dashboard
-- 2. Navigate to SQL Editor
-- 3. Copy and paste this entire file
-- 4. Click "Run" to execute
-- ============================================

-- Create manual_blowing_up_songs table
CREATE TABLE IF NOT EXISTS manual_blowing_up_songs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  song_id uuid NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
  display_order integer NOT NULL DEFAULT 0,
  added_by uuid REFERENCES users(id) ON DELETE SET NULL,
  added_at timestamptz DEFAULT now(),
  is_active boolean DEFAULT true,
  notes text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE manual_blowing_up_songs ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- Allow public to view active entries
CREATE POLICY "Public can view active manual blowing up songs"
ON manual_blowing_up_songs
FOR SELECT
TO public
USING (is_active = true);

-- Allow authenticated users (admins, managers, editors) to view all entries
CREATE POLICY "Admins can view all manual blowing up songs"
ON manual_blowing_up_songs
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
CREATE POLICY "Admins can insert manual blowing up songs"
ON manual_blowing_up_songs
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
CREATE POLICY "Admins can update manual blowing up songs"
ON manual_blowing_up_songs
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
CREATE POLICY "Admins can delete manual blowing up songs"
ON manual_blowing_up_songs
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
CREATE INDEX IF NOT EXISTS idx_manual_blowing_up_songs_active 
ON manual_blowing_up_songs(is_active) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_manual_blowing_up_songs_display_order 
ON manual_blowing_up_songs(display_order, is_active);

CREATE INDEX IF NOT EXISTS idx_manual_blowing_up_songs_song_id 
ON manual_blowing_up_songs(song_id);

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_manual_blowing_up_songs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS update_manual_blowing_up_songs_updated_at ON manual_blowing_up_songs;
CREATE TRIGGER update_manual_blowing_up_songs_updated_at
BEFORE UPDATE ON manual_blowing_up_songs
FOR EACH ROW
EXECUTE FUNCTION update_manual_blowing_up_songs_updated_at();

-- Add comment to table
COMMENT ON TABLE manual_blowing_up_songs IS 'Stores manually curated songs for the "Tracks Blowing Up Right Now" section. Manual entries coexist with auto-calculated songs based on play counts.';

-- ============================================
-- VERIFICATION
-- ============================================
-- After running this migration, verify the table was created:
-- SELECT * FROM manual_blowing_up_songs LIMIT 1;
-- ============================================









