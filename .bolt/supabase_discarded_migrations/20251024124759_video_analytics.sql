/*
  # Update Analytics Functions for Video Playback History

  1. Changes
    - Update admin_get_analytics_dashboard to use video_playback_history for video/clip stats
    - Update get_artist_analytics to use video_playback_history for video/clip stats
    - Keep listening_history for song-only stats
    - Combine both tables for total play statistics

  2. Purpose
    - Separate video/clip playback tracking from song listening tracking
    - Maintain accurate analytics for both content types
    - Enable proper "Watch Next" recommendations
*/

-- Update admin_get_analytics_dashboard function
CREATE OR REPLACE FUNCTION admin_get_analytics_dashboard(
  start_date timestamptz DEFAULT (now() - interval '30 days'),
  end_date timestamptz DEFAULT now(),
  role_filter text DEFAULT NULL,
  country_filter text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  user_stats jsonb;
  content_stats jsonb;
  play_stats jsonb;
  earnings_stats jsonb;
  ad_stats jsonb;
  country_growth jsonb;
  result jsonb;
BEGIN
  -- Check if the current user is an admin
  IF NOT EXISTS (
    SELECT 1 FROM users u 
    WHERE u.id = auth.uid() AND u.role = 'admin'
  ) THEN
    RETURN jsonb_build_object('error', 'Access denied. Admin privileges required.');
  END IF;

  -- Get user statistics
  SELECT jsonb_build_object(
    'total_users', COUNT(*),
    'new_users', COUNT(*) FILTER (WHERE u.created_at BETWEEN start_date AND end_date),
    'active_users', COUNT(*) FILTER (WHERE u.is_active = true),
    'by_role', jsonb_build_object(
      'listeners', COUNT(*) FILTER (WHERE u.role = 'listener'),
      'creators', COUNT(*) FILTER (WHERE u.role = 'creator'),
      'admins', COUNT(*) FILTER (WHERE u.role = 'admin')
    )
  )
  INTO user_stats
  FROM users u
  WHERE (role_filter IS NULL OR u.role = role_filter)
    AND (country_filter IS NULL OR u.country = country_filter);

  -- Get content statistics with proper table references
  SELECT jsonb_build_object(
    'total_content', (
      SELECT COUNT(*) 
      FROM content_uploads cu
      JOIN users u ON cu.user_id = u.id
      WHERE (role_filter IS NULL OR u.role = role_filter)
        AND (country_filter IS NULL OR u.country = country_filter)
    ),
    'new_content', (
      SELECT COUNT(*) 
      FROM content_uploads cu
      JOIN users u ON cu.user_id = u.id
      WHERE cu.created_at BETWEEN start_date AND end_date
        AND (role_filter IS NULL OR u.role = role_filter)
        AND (country_filter IS NULL OR u.country = country_filter)
    ),
    'by_type', jsonb_build_object(
      'songs', (
        SELECT COUNT(*) 
        FROM songs s
        JOIN artists a ON s.artist_id = a.id
        JOIN artist_profiles ap ON a.id = ap.artist_id
        JOIN users u ON ap.user_id = u.id
        WHERE (role_filter IS NULL OR u.role = role_filter)
          AND (country_filter IS NULL OR u.country = country_filter)
      ),
      'albums', (
        SELECT COUNT(*) 
        FROM albums al
        JOIN artists a ON al.artist_id = a.id
        JOIN artist_profiles ap ON a.id = ap.artist_id
        JOIN users u ON ap.user_id = u.id
        WHERE (role_filter IS NULL OR u.role = role_filter)
          AND (country_filter IS NULL OR u.country = country_filter)
      ),
      'videos', (
        SELECT COUNT(*) 
        FROM content_uploads cu
        JOIN users u ON cu.user_id = u.id
        WHERE cu.content_type = 'video'
          AND (role_filter IS NULL OR u.role = role_filter)
          AND (country_filter IS NULL OR u.country = country_filter)
      ),
      'short_clips', (
        SELECT COUNT(*) 
        FROM content_uploads cu
        JOIN users u ON cu.user_id = u.id
        WHERE cu.content_type = 'short_clip'
          AND (role_filter IS NULL OR u.role = role_filter)
          AND (country_filter IS NULL OR u.country = country_filter)
      )
    )
  )
  INTO content_stats;

  -- Get play statistics (combine song listening and video playback)
  SELECT jsonb_build_object(
    'total_plays', (
      SELECT (
        (SELECT COUNT(*) FROM listening_history WHERE song_id IS NOT NULL) +
        (SELECT COUNT(*) FROM video_playback_history)
      )
    ),
    'plays_in_period', (
      SELECT (
        (SELECT COUNT(*) FROM listening_history lh
         LEFT JOIN users u ON lh.user_id = u.id
         WHERE lh.listened_at BETWEEN start_date AND end_date
           AND lh.song_id IS NOT NULL
           AND (role_filter IS NULL OR u.role = role_filter)
           AND (country_filter IS NULL OR u.country = country_filter)
        ) +
        (SELECT COUNT(*) FROM video_playback_history vph
         LEFT JOIN users u ON vph.user_id = u.id
         WHERE vph.watched_at BETWEEN start_date AND end_date
           AND (role_filter IS NULL OR u.role = role_filter)
           AND (country_filter IS NULL OR u.country = country_filter)
        )
      )
    ),
    'by_content_type', jsonb_build_object(
      'songs', (
        SELECT COUNT(*) FROM listening_history lh
        LEFT JOIN users u ON lh.user_id = u.id
        WHERE lh.song_id IS NOT NULL
          AND lh.listened_at BETWEEN start_date AND end_date
          AND (role_filter IS NULL OR u.role = role_filter)
          AND (country_filter IS NULL OR u.country = country_filter)
      ),
      'videos', (
        SELECT COUNT(*) FROM video_playback_history vph
        LEFT JOIN users u ON vph.user_id = u.id
        LEFT JOIN content_uploads cu ON vph.content_id = cu.id
        WHERE cu.content_type = 'video'
          AND vph.watched_at BETWEEN start_date AND end_date
          AND (role_filter IS NULL OR u.role = role_filter)
          AND (country_filter IS NULL OR u.country = country_filter)
      ),
      'short_clips', (
        SELECT COUNT(*) FROM video_playback_history vph
        LEFT JOIN users u ON vph.user_id = u.id
        LEFT JOIN content_uploads cu ON vph.content_id = cu.id
        WHERE cu.content_type = 'short_clip'
          AND vph.watched_at BETWEEN start_date AND end_date
          AND (role_filter IS NULL OR u.role = role_filter)
          AND (country_filter IS NULL OR u.country = country_filter)
      )
    ),
    'avg_duration', (
      SELECT COALESCE(AVG(combined_duration), 0) FROM (
        SELECT duration_listened as combined_duration FROM listening_history 
        WHERE listened_at BETWEEN start_date AND end_date
        UNION ALL
        SELECT duration_watched as combined_duration FROM video_playback_history
        WHERE watched_at BETWEEN start_date AND end_date
      ) durations
    )
  )
  INTO play_stats;

  -- Get earnings statistics
  SELECT jsonb_build_object(
    'total_earnings', COALESCE(SUM(u.total_earnings), 0),
    'avg_earnings', COALESCE(AVG(u.total_earnings) FILTER (WHERE u.total_earnings > 0), 0),
    'users_with_earnings', COUNT(*) FILTER (WHERE u.total_earnings > 0),
    'by_role', jsonb_build_object(
      'listeners', COALESCE(SUM(u.total_earnings) FILTER (WHERE u.role = 'listener'), 0),
      'creators', COALESCE(SUM(u.total_earnings) FILTER (WHERE u.role = 'creator'), 0)
    ),
    'withdrawals', (
      SELECT jsonb_build_object(
        'total_requested', COALESCE(SUM(wr.amount), 0),
        'total_approved', COALESCE(SUM(wr.amount) FILTER (WHERE wr.status = 'approved'), 0),
        'total_pending', COALESCE(SUM(wr.amount) FILTER (WHERE wr.status = 'pending'), 0),
        'count', COUNT(*),
        'approved_count', COUNT(*) FILTER (WHERE wr.status = 'approved'),
        'pending_count', COUNT(*) FILTER (WHERE wr.status = 'pending')
      )
      FROM withdrawal_requests wr
      JOIN users u ON wr.user_id = u.id
      WHERE (role_filter IS NULL OR u.role = role_filter)
        AND (country_filter IS NULL OR u.country = country_filter)
        AND wr.request_date BETWEEN start_date AND end_date
    )
  )
  INTO earnings_stats
  FROM users u
  WHERE (role_filter IS NULL OR u.role = role_filter)
    AND (country_filter IS NULL OR u.country = country_filter);

  -- Get ad statistics
  SELECT jsonb_build_object(
    'total_impressions', COUNT(*),
    'completed_views', COUNT(*) FILTER (WHERE ai.completed = true),
    'completion_rate', CASE 
      WHEN COUNT(*) > 0 THEN 
        ROUND((COUNT(*) FILTER (WHERE ai.completed = true)::numeric / COUNT(*)) * 100, 2)
      ELSE 0
    END,
    'avg_duration_viewed', COALESCE(AVG(ai.duration_viewed), 0),
    'ad_to_stream_ratio', (
      SELECT 
        CASE 
          WHEN (
            (SELECT COUNT(*) FROM listening_history WHERE listened_at BETWEEN start_date AND end_date) +
            (SELECT COUNT(*) FROM video_playback_history WHERE watched_at BETWEEN start_date AND end_date)
          ) > 0 THEN 
            ROUND((SELECT COUNT(*) FROM ad_impressions WHERE impression_time BETWEEN start_date AND end_date)::numeric / 
                  ((SELECT COUNT(*) FROM listening_history WHERE listened_at BETWEEN start_date AND end_date) +
                   (SELECT COUNT(*) FROM video_playback_history WHERE watched_at BETWEEN start_date AND end_date)), 4)
          ELSE 0
        END
    )
  )
  INTO ad_stats
  FROM ad_impressions ai
  LEFT JOIN users u ON ai.user_id = u.id
  WHERE (role_filter IS NULL OR u.role = role_filter)
    AND (country_filter IS NULL OR u.country = country_filter)
    AND ai.impression_time BETWEEN start_date AND end_date;

  -- Get country-based user growth
  SELECT jsonb_agg(
    jsonb_build_object(
      'country', COALESCE(u.country, 'Unknown'),
      'total_users', COUNT(*),
      'new_users', COUNT(*) FILTER (WHERE u.created_at BETWEEN start_date AND end_date)
    )
    ORDER BY COUNT(*) DESC
  )
  INTO country_growth
  FROM users u
  WHERE (role_filter IS NULL OR u.role = role_filter)
  GROUP BY u.country
  LIMIT 10;

  -- Build result
  result := jsonb_build_object(
    'user_stats', COALESCE(user_stats, '{}'::jsonb),
    'content_stats', COALESCE(content_stats, '{}'::jsonb),
    'play_stats', COALESCE(play_stats, '{}'::jsonb),
    'earnings_stats', COALESCE(earnings_stats, '{}'::jsonb),
    'ad_stats', COALESCE(ad_stats, '{}'::jsonb),
    'country_growth', COALESCE(country_growth, '[]'::jsonb),
    'period', jsonb_build_object(
      'start_date', start_date,
      'end_date', end_date
    ),
    'filters', jsonb_build_object(
      'role', role_filter,
      'country', country_filter
    )
  );

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION admin_get_analytics_dashboard(timestamptz, timestamptz, text, text) TO authenticated;