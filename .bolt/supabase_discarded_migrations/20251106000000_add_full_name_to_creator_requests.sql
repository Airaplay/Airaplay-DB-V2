/*
  # Add full_name column to creator_requests table
  
  This migration adds a full_name column to store the user's full legal name
  separately from real_name (which was previously used for display_name).
*/

-- Add full_name column (nullable for backward compatibility with existing records)
ALTER TABLE creator_requests 
ADD COLUMN IF NOT EXISTS full_name text;

-- Update existing records to use real_name as full_name if full_name is null
UPDATE creator_requests 
SET full_name = real_name 
WHERE full_name IS NULL OR full_name = '';

-- Add comment to explain the column
COMMENT ON COLUMN creator_requests.full_name IS 'User''s full legal name as provided during registration';

