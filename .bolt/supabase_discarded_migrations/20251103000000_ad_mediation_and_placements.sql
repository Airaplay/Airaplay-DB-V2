/*
  # Ad Mediation and Placement Management
  
  1. New Tables
    - `ad_mediation_config` - Store mediation settings (AdMob primary, AppLovin secondary)
    - `ad_placements` - Store ad placement configurations for different screens
    - `ad_reward_logs` - Log reward completions and user retention
    - `ad_revenue_logs` - Log estimated revenue per ad
    - `ad_impression_logs` - Enhanced logging for impressions
  
  2. Updates
    - Add mediation fields to ad_networks table
    - Add eCPM floor settings to ad_units table
    - Add placement management
  
  3. Security
    - Enable RLS on all new tables
    - Only admins can manage configurations
*/

-- Add mediation fields to ad_networks table
ALTER TABLE ad_networks 
ADD COLUMN IF NOT EXISTS is_mediation_primary boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS is_mediation_secondary boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS ecpm_floor numeric(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS mediation_priority integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS sdk_key text,
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Add eCPM floor to ad_units table
ALTER TABLE ad_units
ADD COLUMN IF NOT EXISTS ecpm_floor numeric(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS auto_cpm_bidding boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;

-- Create ad_mediation_config table
CREATE TABLE IF NOT EXISTS ad_mediation_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_network_id uuid REFERENCES ad_networks(id) ON DELETE SET NULL,
  secondary_network_id uuid REFERENCES ad_networks(id) ON DELETE SET NULL,
  auto_cpm_bidding boolean DEFAULT true,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create partial unique index to ensure only one active mediation config
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_mediation ON ad_mediation_config (is_active) WHERE (is_active = true);

-- Create ad_placements table
CREATE TABLE IF NOT EXISTS ad_placements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  placement_key text NOT NULL UNIQUE, -- 'home_screen', 'before_song_play', etc.
  placement_name text NOT NULL,
  screen_name text NOT NULL, -- 'HomePlayer', 'MusicPlayerScreen', etc.
  ad_unit_id uuid REFERENCES ad_units(id) ON DELETE SET NULL,
  ad_type text NOT NULL, -- 'banner', 'interstitial', 'rewarded'
  position text, -- 'top', 'bottom', 'center', etc.
  is_enabled boolean DEFAULT true,
  display_priority integer DEFAULT 0,
  conditions jsonb DEFAULT '{}'::jsonb, -- Conditions for when to show
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create ad_reward_logs table
CREATE TABLE IF NOT EXISTS ad_reward_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ad_impression_id uuid REFERENCES ad_impressions(id) ON DELETE SET NULL,
  ad_unit_id uuid REFERENCES ad_units(id) ON DELETE SET NULL,
  placement_key text,
  reward_type text NOT NULL, -- 'treats', 'premium_access', etc.
  reward_amount numeric(10, 2),
  reward_currency text DEFAULT 'treats',
  completed boolean DEFAULT false,
  skipped boolean DEFAULT false,
  skip_reason text,
  completion_duration integer, -- seconds
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create ad_revenue_logs table
CREATE TABLE IF NOT EXISTS ad_revenue_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_impression_id uuid REFERENCES ad_impressions(id) ON DELETE SET NULL,
  ad_unit_id uuid REFERENCES ad_units(id) ON DELETE SET NULL,
  network_id uuid REFERENCES ad_networks(id) ON DELETE SET NULL,
  placement_key text,
  estimated_cpm numeric(10, 4),
  estimated_revenue numeric(10, 4),
  currency text DEFAULT 'USD',
  ecpm_floor_used numeric(10, 2),
  winning_network text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Create ad_impression_logs table (enhanced logging)
CREATE TABLE IF NOT EXISTS ad_impression_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_impression_id uuid REFERENCES ad_impressions(id) ON DELETE SET NULL,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  ad_unit_id uuid REFERENCES ad_units(id) ON DELETE SET NULL,
  placement_key text,
  network text,
  ad_type text,
  impression_count integer DEFAULT 1,
  view_duration integer DEFAULT 0,
  completed boolean DEFAULT false,
  failed boolean DEFAULT false,
  failure_reason text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE ad_mediation_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_reward_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_revenue_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ad_impression_logs ENABLE ROW LEVEL SECURITY;

-- RLS Policies for ad_mediation_config
CREATE POLICY "Admins can manage mediation config"
ON ad_mediation_config
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

-- RLS Policies for ad_placements
CREATE POLICY "Admins can manage placements"
ON ad_placements
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

-- Public can view active placements
CREATE POLICY "Public can view active placements"
ON ad_placements
FOR SELECT
TO authenticated
USING (is_enabled = true);

-- RLS Policies for ad_reward_logs
CREATE POLICY "Users can view own reward logs"
ON ad_reward_logs
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "System can insert reward logs"
ON ad_reward_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Admins can view all reward logs
CREATE POLICY "Admins can view all reward logs"
ON ad_reward_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

-- RLS Policies for ad_revenue_logs
CREATE POLICY "Admins can view revenue logs"
ON ad_revenue_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

CREATE POLICY "System can insert revenue logs"
ON ad_revenue_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- RLS Policies for ad_impression_logs
CREATE POLICY "Users can view own impression logs"
ON ad_impression_logs
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "System can insert impression logs"
ON ad_impression_logs
FOR INSERT
TO authenticated
WITH CHECK (true);

-- Admins can view all impression logs
CREATE POLICY "Admins can view all impression logs"
ON ad_impression_logs
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role = 'admin'
  )
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_ad_mediation_config_active ON ad_mediation_config(is_active);
CREATE INDEX IF NOT EXISTS idx_ad_placements_key ON ad_placements(placement_key);
CREATE INDEX IF NOT EXISTS idx_ad_placements_screen ON ad_placements(screen_name);
CREATE INDEX IF NOT EXISTS idx_ad_placements_enabled ON ad_placements(is_enabled);
CREATE INDEX IF NOT EXISTS idx_ad_reward_logs_user ON ad_reward_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ad_reward_logs_created ON ad_reward_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_ad_revenue_logs_created ON ad_revenue_logs(created_at);
CREATE INDEX IF NOT EXISTS idx_ad_impression_logs_user ON ad_impression_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ad_impression_logs_created ON ad_impression_logs(created_at);

-- Create function to get active placement configuration
CREATE OR REPLACE FUNCTION get_active_placement_config(placement_key_param text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  placement_record ad_placements%ROWTYPE;
  ad_unit_record ad_units%ROWTYPE;
  network_record ad_networks%ROWTYPE;
  result jsonb;
BEGIN
  -- Get placement configuration
  SELECT * INTO placement_record
  FROM ad_placements
  WHERE placement_key = placement_key_param
    AND is_enabled = true
  ORDER BY display_priority DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Get ad unit configuration
  IF placement_record.ad_unit_id IS NOT NULL THEN
    SELECT * INTO ad_unit_record
    FROM ad_units
    WHERE id = placement_record.ad_unit_id
      AND is_active = true;

    IF FOUND THEN
      -- Get network configuration
      SELECT * INTO network_record
      FROM ad_networks
      WHERE id = ad_unit_record.network_id
        AND is_active = true;

      IF FOUND THEN
        -- Build result
        result := jsonb_build_object(
          'placement', jsonb_build_object(
            'id', placement_record.id,
            'key', placement_record.placement_key,
            'name', placement_record.placement_name,
            'screen', placement_record.screen_name,
            'ad_type', placement_record.ad_type,
            'position', placement_record.position,
            'conditions', placement_record.conditions
          ),
          'ad_unit', jsonb_build_object(
            'id', ad_unit_record.id,
            'unit_id', ad_unit_record.unit_id,
            'unit_type', ad_unit_record.unit_type,
            'ecpm_floor', ad_unit_record.ecpm_floor,
            'auto_cpm_bidding', ad_unit_record.auto_cpm_bidding
          ),
          'network', jsonb_build_object(
            'id', network_record.id,
            'network', network_record.network,
            'app_id', network_record.app_id,
            'api_key', network_record.api_key,
            'ecpm_floor', network_record.ecpm_floor,
            'is_mediation_primary', network_record.is_mediation_primary,
            'is_mediation_secondary', network_record.is_mediation_secondary,
            'sdk_key', network_record.sdk_key
          )
        );
      END IF;
    END IF;
  END IF;

  RETURN result;
END;
$$;

-- Create function to log ad reward
CREATE OR REPLACE FUNCTION log_ad_reward(
  p_user_id uuid,
  p_ad_impression_id uuid,
  p_ad_unit_id uuid,
  p_placement_key text,
  p_reward_type text,
  p_reward_amount numeric,
  p_reward_currency text DEFAULT 'treats',
  p_completed boolean DEFAULT false,
  p_skipped boolean DEFAULT false,
  p_skip_reason text DEFAULT NULL,
  p_completion_duration integer DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  log_id uuid;
BEGIN
  INSERT INTO ad_reward_logs (
    user_id,
    ad_impression_id,
    ad_unit_id,
    placement_key,
    reward_type,
    reward_amount,
    reward_currency,
    completed,
    skipped,
    skip_reason,
    completion_duration,
    metadata
  ) VALUES (
    p_user_id,
    p_ad_impression_id,
    p_ad_unit_id,
    p_placement_key,
    p_reward_type,
    p_reward_amount,
    p_reward_currency,
    p_completed,
    p_skipped,
    p_skip_reason,
    p_completion_duration,
    p_metadata
  )
  RETURNING id INTO log_id;

  RETURN log_id;
END;
$$;

-- Create function to get user retention per reward type
CREATE OR REPLACE FUNCTION get_user_retention_by_reward_type(
  p_start_date timestamptz DEFAULT (now() - interval '30 days'),
  p_end_date timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role = 'admin'
  ) THEN
    RETURN jsonb_build_object('error', 'Access denied');
  END IF;

  SELECT jsonb_agg(
    jsonb_build_object(
      'reward_type', reward_type,
      'total_users', total_users,
      'completed_count', completed_count,
      'skipped_count', skipped_count,
      'completion_rate', completion_rate,
      'avg_completion_duration', avg_completion_duration,
      'retention_rate', retention_rate
    )
  )
  INTO result
  FROM (
    SELECT
      reward_type,
      COUNT(DISTINCT user_id) as total_users,
      COUNT(*) FILTER (WHERE completed = true) as completed_count,
      COUNT(*) FILTER (WHERE skipped = true) as skipped_count,
      CASE 
        WHEN COUNT(*) > 0 
        THEN ROUND((COUNT(*) FILTER (WHERE completed = true)::numeric / COUNT(*)::numeric) * 100, 2)
        ELSE 0
      END as completion_rate,
      AVG(completion_duration) FILTER (WHERE completed = true) as avg_completion_duration,
      CASE 
        WHEN COUNT(DISTINCT user_id) > 0
        THEN ROUND((COUNT(DISTINCT user_id) FILTER (WHERE completed = true)::numeric / COUNT(DISTINCT user_id)::numeric) * 100, 2)
        ELSE 0
      END as retention_rate
    FROM ad_reward_logs
    WHERE created_at BETWEEN p_start_date AND p_end_date
    GROUP BY reward_type
    ORDER BY total_users DESC
  ) as stats;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$;

-- Create function to get ad revenue summary
CREATE OR REPLACE FUNCTION get_ad_revenue_summary(
  p_start_date timestamptz DEFAULT (now() - interval '30 days'),
  p_end_date timestamptz DEFAULT now()
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result jsonb;
BEGIN
  -- Check if user is admin
  IF NOT EXISTS (
    SELECT 1 FROM users
    WHERE id = auth.uid()
    AND role = 'admin'
  ) THEN
    RETURN jsonb_build_object('error', 'Access denied');
  END IF;

  SELECT jsonb_build_object(
    'total_revenue', COALESCE(SUM(estimated_revenue), 0),
    'total_impressions', COUNT(*),
    'avg_cpm', COALESCE(AVG(estimated_cpm), 0),
    'by_network', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'network', winning_network,
          'revenue', revenue,
          'impressions', impressions,
          'avg_cpm', avg_cpm
        )
      )
      FROM (
        SELECT
          winning_network,
          SUM(estimated_revenue) as revenue,
          COUNT(*) as impressions,
          AVG(estimated_cpm) as avg_cpm
        FROM ad_revenue_logs
        WHERE created_at BETWEEN p_start_date AND p_end_date
        GROUP BY winning_network
      ) as network_stats
    ),
    'by_placement', (
      SELECT jsonb_agg(
        jsonb_build_object(
          'placement', placement_key,
          'revenue', revenue,
          'impressions', impressions
        )
      )
      FROM (
        SELECT
          placement_key,
          SUM(estimated_revenue) as revenue,
          COUNT(*) as impressions
        FROM ad_revenue_logs
        WHERE created_at BETWEEN p_start_date AND p_end_date
        GROUP BY placement_key
      ) as placement_stats
    )
  )
  INTO result
  FROM ad_revenue_logs
  WHERE created_at BETWEEN p_start_date AND p_end_date;

  RETURN COALESCE(result, '{}'::jsonb);
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION get_active_placement_config(text) TO authenticated;
GRANT EXECUTE ON FUNCTION log_ad_reward(uuid, uuid, uuid, text, text, numeric, text, boolean, boolean, text, integer, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_retention_by_reward_type(timestamptz, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION get_ad_revenue_summary(timestamptz, timestamptz) TO authenticated;

-- Create trigger to update updated_at
CREATE OR REPLACE FUNCTION update_ad_mediation_config_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_ad_mediation_config_updated_at
BEFORE UPDATE ON ad_mediation_config
FOR EACH ROW
EXECUTE FUNCTION update_ad_mediation_config_updated_at();

CREATE TRIGGER trigger_update_ad_placements_updated_at
BEFORE UPDATE ON ad_placements
FOR EACH ROW
EXECUTE FUNCTION update_ad_mediation_config_updated_at();


