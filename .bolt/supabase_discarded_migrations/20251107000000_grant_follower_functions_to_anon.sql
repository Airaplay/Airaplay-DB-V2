/*
  # Grant follower/following count functions to anonymous users

  1. Changes
    - Grant EXECUTE permissions on get_follower_count to anon role
    - Grant EXECUTE permissions on get_following_count to anon role
    - Grant EXECUTE permissions on is_following to anon role
    - This allows public profiles to display follower/following counts even when viewed by anonymous users

  2. Security
    - Functions are SECURITY DEFINER, so they bypass RLS and can safely read follower counts
    - Only allows reading counts, not modifying follow relationships
    - Anonymous users still cannot insert/delete follow relationships due to RLS policies
*/

-- Grant execute permissions to anonymous users for follower/following count functions
GRANT EXECUTE ON FUNCTION get_follower_count(uuid) TO anon;
GRANT EXECUTE ON FUNCTION get_following_count(uuid) TO anon;
GRANT EXECUTE ON FUNCTION is_following(uuid, uuid) TO anon;

