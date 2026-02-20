/*
  # Enhance Verified Badge Public Access

  1. Changes
    - Add public SELECT policy for verified_badge_config so all users can view the badge
    - Keep admin-only INSERT, UPDATE, DELETE policies
    - This allows profile pages to display verified badges to all users

  2. Security
    - Public users can READ badge config (needed for display on profiles)
    - Only admins can CREATE, UPDATE, DELETE badge configurations

  3. Notes
    - The badge is a system-wide setting, so it's safe for public view
    - This doesn't expose sensitive data, only the badge image URL
*/

-- Create policy for public badge viewing
CREATE POLICY "Public can view verified badge config"
  ON verified_badge_config
  FOR SELECT
  TO anon
  USING (true);

-- Also ensure authenticated users can view it
CREATE POLICY "Authenticated users can view verified badge config"
  ON verified_badge_config
  FOR SELECT
  TO authenticated
  USING (true);
