/*
  # User-to-User Messaging System
  
  This migration creates:
  1. `messages` table - Stores user-to-user messages
  2. `message_threads` table - Groups messages between two users
  3. Updates `notifications` table - Adds message notification support
  4. Real-time subscriptions for instant updates
  5. RLS policies for secure access
*/

-- Create message_threads table
CREATE TABLE IF NOT EXISTS message_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user1_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  user2_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_message_at timestamptz DEFAULT now(),
  last_message_id uuid,
  last_message_preview text,
  user1_unread_count integer DEFAULT 0,
  user2_unread_count integer DEFAULT 0,
  user1_deleted_at timestamptz,
  user2_deleted_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_thread UNIQUE (user1_id, user2_id),
  CONSTRAINT different_users CHECK (user1_id != user2_id)
);

-- Create messages table
CREATE TABLE IF NOT EXISTS messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES message_threads(id) ON DELETE CASCADE,
  sender_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  receiver_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  message_text text NOT NULL,
  is_deleted boolean DEFAULT false,
  deleted_at timestamptz,
  is_read boolean DEFAULT false,
  read_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT sender_receiver_different CHECK (sender_id != receiver_id)
);

-- Add message notification type to notifications table if not exists
DO $$ 
BEGIN
  -- Check if message notification type exists
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'notification_type_enum'
  ) THEN
    CREATE TYPE notification_type_enum AS ENUM (
      'like', 'comment', 'follow', 'share', 'mention', 
      'system', 'promotion', 'message', 'reply'
    );
  END IF;
END $$;

-- Update notifications table to support message notifications
DO $$
BEGIN
  -- Add message-related columns if they don't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' AND column_name = 'message_id'
  ) THEN
    ALTER TABLE notifications ADD COLUMN message_id uuid REFERENCES messages(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' AND column_name = 'thread_id'
  ) THEN
    ALTER TABLE notifications ADD COLUMN thread_id uuid REFERENCES message_threads(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' AND column_name = 'sender_id'
  ) THEN
    ALTER TABLE notifications ADD COLUMN sender_id uuid REFERENCES users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_message_threads_user1 ON message_threads(user1_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_user2 ON message_threads(user2_id);
CREATE INDEX IF NOT EXISTS idx_message_threads_last_message ON message_threads(last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_thread ON messages(thread_id);
CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_unread ON messages(receiver_id, is_read) WHERE is_read = false;
CREATE INDEX IF NOT EXISTS idx_notifications_message ON notifications(message_id);
CREATE INDEX IF NOT EXISTS idx_notifications_thread ON notifications(thread_id);

-- Enable RLS
ALTER TABLE message_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies for message_threads
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can view their own threads" ON message_threads;
  DROP POLICY IF EXISTS "Users can create threads" ON message_threads;
  DROP POLICY IF EXISTS "Users can update their own threads" ON message_threads;
END $$;

CREATE POLICY "Users can view their own threads"
ON message_threads
FOR SELECT
TO authenticated
USING (
  user1_id = auth.uid() OR user2_id = auth.uid()
);

CREATE POLICY "Users can create threads"
ON message_threads
FOR INSERT
TO authenticated
WITH CHECK (
  user1_id = auth.uid() OR user2_id = auth.uid()
);

CREATE POLICY "Users can update their own threads"
ON message_threads
FOR UPDATE
TO authenticated
USING (
  user1_id = auth.uid() OR user2_id = auth.uid()
)
WITH CHECK (
  user1_id = auth.uid() OR user2_id = auth.uid()
);

-- RLS Policies for messages
DO $$ 
BEGIN
  DROP POLICY IF EXISTS "Users can view messages in their threads" ON messages;
  DROP POLICY IF EXISTS "Users can send messages" ON messages;
  DROP POLICY IF EXISTS "Users can update their own messages" ON messages;
  DROP POLICY IF EXISTS "Receivers can mark messages as read" ON messages;
END $$;

CREATE POLICY "Users can view messages in their threads"
ON messages
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM message_threads
    WHERE id = messages.thread_id
    AND (user1_id = auth.uid() OR user2_id = auth.uid())
  )
);

CREATE POLICY "Users can send messages"
ON messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM message_threads
    WHERE id = messages.thread_id
    AND (user1_id = auth.uid() OR user2_id = auth.uid())
  )
);

CREATE POLICY "Users can update their own messages"
ON messages
FOR UPDATE
TO authenticated
USING (sender_id = auth.uid())
WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Receivers can mark messages as read"
ON messages
FOR UPDATE
TO authenticated
USING (receiver_id = auth.uid())
WITH CHECK (receiver_id = auth.uid());

-- Function to get or create thread between two users
DROP FUNCTION IF EXISTS get_or_create_thread(uuid, uuid);
CREATE OR REPLACE FUNCTION get_or_create_thread(p_user1_id uuid, p_user2_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  thread_id uuid;
  v_user1_id uuid;
  v_user2_id uuid;
BEGIN
  -- Ensure user1_id < user2_id for consistent ordering
  IF p_user1_id < p_user2_id THEN
    v_user1_id := p_user1_id;
    v_user2_id := p_user2_id;
  ELSE
    v_user1_id := p_user2_id;
    v_user2_id := p_user1_id;
  END IF;

  -- Try to find existing thread
  SELECT id INTO thread_id
  FROM message_threads
  WHERE user1_id = v_user1_id
    AND user2_id = v_user2_id;

  -- Create thread if it doesn't exist
  IF thread_id IS NULL THEN
    INSERT INTO message_threads (user1_id, user2_id)
    VALUES (v_user1_id, v_user2_id)
    RETURNING id INTO thread_id;
  END IF;

  RETURN thread_id;
END;
$$;

-- Function to send a message
DROP FUNCTION IF EXISTS send_message(uuid, text);
CREATE OR REPLACE FUNCTION send_message(
  p_receiver_id uuid,
  p_message_text text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_thread_id uuid;
  v_message_id uuid;
  v_sender_id uuid;
BEGIN
  -- Get current user
  v_sender_id := auth.uid();
  
  IF v_sender_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  IF v_sender_id = p_receiver_id THEN
    RAISE EXCEPTION 'Cannot send message to yourself';
  END IF;

  -- Get or create thread
  v_thread_id := get_or_create_thread(v_sender_id, p_receiver_id);

  -- Insert message
  INSERT INTO messages (thread_id, sender_id, receiver_id, message_text)
  VALUES (v_thread_id, v_sender_id, p_receiver_id, p_message_text)
  RETURNING id INTO v_message_id;

  -- Update thread
  UPDATE message_threads
  SET 
    last_message_at = now(),
    last_message_id = v_message_id,
    last_message_preview = LEFT(p_message_text, 100),
    user1_unread_count = CASE 
      WHEN user1_id = p_receiver_id THEN user1_unread_count + 1
      ELSE user1_unread_count
    END,
    user2_unread_count = CASE 
      WHEN user2_id = p_receiver_id THEN user2_unread_count + 1
      ELSE user2_unread_count
    END,
    user1_deleted_at = CASE 
      WHEN user1_id = p_receiver_id THEN NULL
      ELSE user1_deleted_at
    END,
    user2_deleted_at = CASE 
      WHEN user2_id = p_receiver_id THEN NULL
      ELSE user2_deleted_at
    END,
    updated_at = now()
  WHERE id = v_thread_id;

  -- Create notification
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    message_id,
    thread_id,
    sender_id,
    is_read
  )
  VALUES (
    p_receiver_id,
    'message',
    'New Message',
    LEFT(p_message_text, 100),
    v_message_id,
    v_thread_id,
    v_sender_id,
    false
  );

  RETURN v_message_id;
END;
$$;

-- Function to reply to a message
DROP FUNCTION IF EXISTS reply_to_message(uuid, text);
CREATE OR REPLACE FUNCTION reply_to_message(
  p_thread_id uuid,
  p_message_text text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_message_id uuid;
  v_sender_id uuid;
  v_receiver_id uuid;
  v_thread_record message_threads%ROWTYPE;
BEGIN
  -- Get current user
  v_sender_id := auth.uid();
  
  IF v_sender_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  -- Get thread info
  SELECT * INTO v_thread_record
  FROM message_threads
  WHERE id = p_thread_id
    AND (user1_id = v_sender_id OR user2_id = v_sender_id);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Thread not found or access denied';
  END IF;

  -- Determine receiver
  IF v_thread_record.user1_id = v_sender_id THEN
    v_receiver_id := v_thread_record.user2_id;
  ELSE
    v_receiver_id := v_thread_record.user1_id;
  END IF;

  -- Insert reply message
  INSERT INTO messages (thread_id, sender_id, receiver_id, message_text)
  VALUES (p_thread_id, v_sender_id, v_receiver_id, p_message_text)
  RETURNING id INTO v_message_id;

  -- Update thread
  UPDATE message_threads
  SET 
    last_message_at = now(),
    last_message_id = v_message_id,
    last_message_preview = LEFT(p_message_text, 100),
    user1_unread_count = CASE 
      WHEN user1_id = v_receiver_id THEN user1_unread_count + 1
      ELSE user1_unread_count
    END,
    user2_unread_count = CASE 
      WHEN user2_id = v_receiver_id THEN user2_unread_count + 1
      ELSE user2_unread_count
    END,
    user1_deleted_at = CASE 
      WHEN user1_id = v_receiver_id THEN NULL
      ELSE user1_deleted_at
    END,
    user2_deleted_at = CASE 
      WHEN user2_id = v_receiver_id THEN NULL
      ELSE user2_deleted_at
    END,
    updated_at = now()
  WHERE id = p_thread_id;

  -- Create notification
  INSERT INTO notifications (
    user_id,
    type,
    title,
    message,
    message_id,
    thread_id,
    sender_id,
    is_read
  )
  VALUES (
    v_receiver_id,
    'reply',
    'New Reply',
    LEFT(p_message_text, 100),
    v_message_id,
    p_thread_id,
    v_sender_id,
    false
  );

  RETURN v_message_id;
END;
$$;

-- Function to mark messages as read
DROP FUNCTION IF EXISTS mark_messages_as_read(uuid);
CREATE OR REPLACE FUNCTION mark_messages_as_read(p_thread_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  -- Mark messages as read
  UPDATE messages
  SET 
    is_read = true,
    read_at = now()
  WHERE thread_id = p_thread_id
    AND receiver_id = v_user_id
    AND is_read = false;

  -- Update thread unread count
  UPDATE message_threads
  SET 
    user1_unread_count = CASE 
      WHEN user1_id = v_user_id THEN 0
      ELSE user1_unread_count
    END,
    user2_unread_count = CASE 
      WHEN user2_id = v_user_id THEN 0
      ELSE user2_unread_count
    END,
    updated_at = now()
  WHERE id = p_thread_id;

  -- Mark related notifications as read
  UPDATE notifications
  SET is_read = true, read_at = now()
  WHERE thread_id = p_thread_id
    AND user_id = v_user_id
    AND is_read = false;
END;
$$;

-- Function to soft delete a message
DROP FUNCTION IF EXISTS delete_message(uuid);
CREATE OR REPLACE FUNCTION delete_message(p_message_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  -- Soft delete message (only sender can delete)
  UPDATE messages
  SET 
    is_deleted = true,
    deleted_at = now()
  WHERE id = p_message_id
    AND sender_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Message not found or you do not have permission to delete it';
  END IF;
END;
$$;

-- Function to soft delete a thread (for one user)
DROP FUNCTION IF EXISTS delete_thread(uuid);
CREATE OR REPLACE FUNCTION delete_thread(p_thread_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated';
  END IF;

  -- Soft delete thread for current user
  UPDATE message_threads
  SET 
    user1_deleted_at = CASE 
      WHEN user1_id = v_user_id THEN now()
      ELSE user1_deleted_at
    END,
    user2_deleted_at = CASE 
      WHEN user2_id = v_user_id THEN now()
      ELSE user2_deleted_at
    END,
    updated_at = now()
  WHERE id = p_thread_id
    AND (user1_id = v_user_id OR user2_id = v_user_id);

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Thread not found or access denied';
  END IF;
END;
$$;

-- Function to get user threads
DROP FUNCTION IF EXISTS get_user_threads();
CREATE OR REPLACE FUNCTION get_user_threads()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  result jsonb;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', t.id,
      'other_user', jsonb_build_object(
        'id', CASE WHEN t.user1_id = v_user_id THEN u2.id ELSE u1.id END,
        'display_name', CASE WHEN t.user1_id = v_user_id THEN u2.display_name ELSE u1.display_name END,
        'username', CASE WHEN t.user1_id = v_user_id THEN u2.username ELSE u1.username END,
        'avatar_url', CASE WHEN t.user1_id = v_user_id THEN u2.avatar_url ELSE u1.avatar_url END
      ),
      'last_message_at', t.last_message_at,
      'last_message_preview', t.last_message_preview,
      'unread_count', CASE WHEN t.user1_id = v_user_id THEN t.user1_unread_count ELSE t.user2_unread_count END,
      'created_at', t.created_at
    )
    ORDER BY t.last_message_at DESC
  )
  INTO result
  FROM message_threads t
  LEFT JOIN users u1 ON u1.id = t.user1_id
  LEFT JOIN users u2 ON u2.id = t.user2_id
  WHERE (t.user1_id = v_user_id OR t.user2_id = v_user_id)
    AND (t.user1_id = v_user_id AND t.user1_deleted_at IS NULL OR t.user1_id != v_user_id)
    AND (t.user2_id = v_user_id AND t.user2_deleted_at IS NULL OR t.user2_id != v_user_id);

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- Function to get thread messages
DROP FUNCTION IF EXISTS get_thread_messages(uuid);
CREATE OR REPLACE FUNCTION get_thread_messages(p_thread_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  result jsonb;
BEGIN
  v_user_id := auth.uid();
  
  IF v_user_id IS NULL THEN
    RETURN '[]'::jsonb;
  END IF;

  -- Verify user has access to thread
  IF NOT EXISTS (
    SELECT 1 FROM message_threads
    WHERE id = p_thread_id
      AND (user1_id = v_user_id OR user2_id = v_user_id)
  ) THEN
    RETURN '[]'::jsonb;
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'id', m.id,
      'sender_id', m.sender_id,
      'receiver_id', m.receiver_id,
      'message_text', CASE 
        WHEN m.is_deleted THEN 'Message deleted'
        ELSE m.message_text
      END,
      'is_deleted', m.is_deleted,
      'is_read', m.is_read,
      'created_at', m.created_at,
      'sender', jsonb_build_object(
        'id', u.id,
        'display_name', u.display_name,
        'username', u.username,
        'avatar_url', u.avatar_url
      )
    )
    ORDER BY m.created_at ASC
  )
  INTO result
  FROM messages m
  LEFT JOIN users u ON u.id = m.sender_id
  WHERE m.thread_id = p_thread_id;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_or_create_thread(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION send_message(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION reply_to_message(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION mark_messages_as_read(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_message(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION delete_thread(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_threads() TO authenticated;
GRANT EXECUTE ON FUNCTION get_thread_messages(uuid) TO authenticated;

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION update_message_threads_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_update_message_threads_updated_at ON message_threads;
CREATE TRIGGER trigger_update_message_threads_updated_at
BEFORE UPDATE ON message_threads
FOR EACH ROW
EXECUTE FUNCTION update_message_threads_updated_at();

DROP TRIGGER IF EXISTS trigger_update_messages_updated_at ON messages;
CREATE TRIGGER trigger_update_messages_updated_at
BEFORE UPDATE ON messages
FOR EACH ROW
EXECUTE FUNCTION update_message_threads_updated_at();

-- Enable real-time for tables (if publication exists)
DO $$
BEGIN
  -- Try to add tables to realtime publication
  BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE message_threads;
    ALTER PUBLICATION supabase_realtime ADD TABLE messages;
    ALTER PUBLICATION supabase_realtime ADD TABLE notifications;
  EXCEPTION
    WHEN OTHERS THEN
      -- Publication might not exist or tables already added
      NULL;
  END;
END $$;

