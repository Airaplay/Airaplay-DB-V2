/*
  # Fix Creator Request Notification Functions

  Cleans up and recreates the notification system for creator requests with:
  - Helper function for standardized notifications
  - Enhanced approve/reject/ban functions
  - Proper error handling and messaging
*/

-- Drop existing notification helper if it exists to recreate with correct signature
DROP FUNCTION IF EXISTS create_creator_request_notification(uuid, text, text, text, uuid) CASCADE;

-- Add creator_request_id column if missing
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS creator_request_id uuid REFERENCES creator_requests(id) ON DELETE SET NULL;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_notifications_creator_request_id ON notifications(creator_request_id);

-- Helper function to create standardized creator request notifications
CREATE FUNCTION create_creator_request_notification(
  p_user_id uuid,
  p_status text,
  p_artist_name text,
  p_reason text DEFAULT NULL,
  p_request_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_title text;
  v_message text;
  v_notification_metadata jsonb;
BEGIN
  v_notification_metadata := jsonb_build_object(
    'request_status', p_status,
    'artist_name', p_artist_name,
    'timestamp', now()
  );

  CASE p_status
    WHEN 'approved' THEN
      v_title := 'Creator Request Approved';
      v_message := 'Congratulations! Your artist profile "' || p_artist_name || '" has been approved! You now have creator privileges and a verified badge. Start uploading and earning!';
      v_notification_metadata := v_notification_metadata || jsonb_build_object('action_required', false);

    WHEN 'rejected' THEN
      v_title := 'Creator Request Review Complete';
      v_message := CASE 
        WHEN p_reason IS NOT NULL AND p_reason != '' 
        THEN 'Your artist profile "' || p_artist_name || '" was reviewed. Reason: ' || p_reason || '. You can resubmit your application after 7 days.'
        ELSE 'Your artist profile "' || p_artist_name || '" was reviewed and needs more information. Please contact support for details.'
      END;
      v_notification_metadata := v_notification_metadata || jsonb_build_object('action_required', true, 'reason', COALESCE(p_reason, ''));

    WHEN 'banned' THEN
      v_title := 'Account Suspended';
      v_message := CASE
        WHEN p_reason IS NOT NULL AND p_reason != ''
        THEN 'Your account has been suspended. Reason: ' || p_reason || '. Please contact support@airaplay.com for more information.'
        ELSE 'Your account has been suspended. Please contact support@airaplay.com for more information.'
      END;
      v_notification_metadata := v_notification_metadata || jsonb_build_object('action_required', true, 'reason', COALESCE(p_reason, ''));

    ELSE
      v_title := 'Creator Request Update';
      v_message := 'Your artist profile "' || p_artist_name || '" has been ' || p_status || '.';
  END CASE;

  INSERT INTO notifications (
    user_id, 
    title, 
    type, 
    message, 
    metadata,
    creator_request_id,
    is_read
  )
  VALUES (
    p_user_id,
    v_title,
    'creator_request',
    v_message,
    v_notification_metadata,
    p_request_id,
    false
  );
END;
$$;

-- Recreate approve_creator_request
DROP FUNCTION IF EXISTS approve_creator_request(uuid) CASCADE;

CREATE FUNCTION approve_creator_request(request_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_artist_name text;
  v_bio text;
  v_country text;
  v_genre text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can approve creator requests';
  END IF;

  SELECT user_id, artist_name, bio, country, genre
  INTO v_user_id, v_artist_name, v_bio, v_country, v_genre
  FROM creator_requests
  WHERE id = request_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Creator request not found';
  END IF;

  UPDATE creator_requests
  SET 
    status = 'approved',
    reviewed_at = now(),
    reviewed_by = auth.uid()
  WHERE creator_requests.id = request_id;

  UPDATE users
  SET 
    role = 'creator',
    show_artist_badge = true
  WHERE users.id = v_user_id;

  INSERT INTO artist_profiles (
    user_id,
    stage_name,
    bio,
    country,
    is_verified
  )
  VALUES (
    v_user_id,
    v_artist_name,
    v_bio,
    v_country,
    true
  )
  ON CONFLICT (user_id) DO UPDATE
  SET 
    is_verified = true,
    stage_name = COALESCE(artist_profiles.stage_name, v_artist_name),
    bio = COALESCE(artist_profiles.bio, v_bio),
    country = COALESCE(artist_profiles.country, v_country);

  PERFORM create_creator_request_notification(
    v_user_id,
    'approved',
    v_artist_name,
    NULL,
    request_id
  );
END;
$$;

-- Recreate reject_creator_request
DROP FUNCTION IF EXISTS reject_creator_request(uuid, text) CASCADE;

CREATE FUNCTION reject_creator_request(
  request_id uuid,
  reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_artist_name text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can reject creator requests';
  END IF;

  SELECT user_id, artist_name
  INTO v_user_id, v_artist_name
  FROM creator_requests
  WHERE id = request_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Creator request not found';
  END IF;

  UPDATE creator_requests
  SET 
    status = 'rejected',
    rejection_reason = reason,
    reviewed_at = now(),
    reviewed_by = auth.uid()
  WHERE creator_requests.id = request_id;

  PERFORM create_creator_request_notification(
    v_user_id,
    'rejected',
    v_artist_name,
    reason,
    request_id
  );
END;
$$;

-- Recreate ban_creator_request
DROP FUNCTION IF EXISTS ban_creator_request(uuid, text) CASCADE;

CREATE FUNCTION ban_creator_request(
  request_id uuid,
  reason text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_artist_name text;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role = 'admin'
  ) THEN
    RAISE EXCEPTION 'Only admins can ban creator requests';
  END IF;

  SELECT user_id, artist_name
  INTO v_user_id, v_artist_name
  FROM creator_requests
  WHERE id = request_id;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Creator request not found';
  END IF;

  UPDATE creator_requests
  SET 
    status = 'banned',
    rejection_reason = reason,
    reviewed_at = now(),
    reviewed_by = auth.uid()
  WHERE creator_requests.id = request_id;

  UPDATE users
  SET banned_until = now() + interval '100 years'
  WHERE users.id = v_user_id;

  PERFORM create_creator_request_notification(
    v_user_id,
    'banned',
    v_artist_name,
    reason,
    request_id
  );
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION create_creator_request_notification(uuid, text, text, text, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION approve_creator_request(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION reject_creator_request(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION ban_creator_request(uuid, text) TO authenticated;