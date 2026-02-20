/*
  # Create Promotion Fairness & Rotation System

  1. New Tables
    - `promotion_impressions`: Tracks every impression (view) of promoted content
    - `promotion_rotation_state`: Maintains rotation state for fair distribution
    - `promotion_performance_metrics`: Aggregated performance metrics for each promotion

  2. New Functions
    - `calculate_promotion_score`: Calculates fairness score based on performance and exposure
    - `get_fair_promoted_content`: Retrieves promoted content with fair rotation logic
    - `record_promotion_impression`: Records impression and updates metrics
    - `update_promotion_performance`: Updates aggregated performance metrics

  3. Changes
    - Add performance tracking fields to promotions table
    - Add rotation tracking fields to promotions table

  4. Security
    - Enable RLS on all new tables
    - Public can record impressions (for tracking)
    - Users can view their own metrics
    - Admins have full access

  5. Fairness Algorithm
    - Rotation-based: Ensures all active promotions get displayed
    - Performance-weighted: Higher CTR gets slight priority (max 20% boost)
    - Time-based: Recently shown promotions have lower priority
    - Balanced exposure: Tracks impressions to prevent over-exposure
*/

-- Create promotion_impressions table to track every view
CREATE TABLE IF NOT EXISTS promotion_impressions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  section_key text NOT NULL,
  clicked boolean DEFAULT false,
  impression_time timestamptz DEFAULT now(),
  session_id text,
  created_at timestamptz DEFAULT now()
);

-- Create promotion_rotation_state table
CREATE TABLE IF NOT EXISTS promotion_rotation_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  section_key text NOT NULL,
  total_impressions integer DEFAULT 0,
  total_clicks integer DEFAULT 0,
  click_through_rate numeric DEFAULT 0,
  last_shown_at timestamptz,
  rotation_priority numeric DEFAULT 1.0,
  performance_score numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(promotion_id, section_key)
);

-- Create promotion_performance_metrics table
CREATE TABLE IF NOT EXISTS promotion_performance_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
  section_key text NOT NULL,
  date date NOT NULL DEFAULT CURRENT_DATE,
  impressions integer DEFAULT 0,
  clicks integer DEFAULT 0,
  unique_viewers integer DEFAULT 0,
  click_through_rate numeric DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(promotion_id, section_key, date)
);

-- Add performance tracking columns to promotions table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'promotions' AND column_name = 'rotation_priority'
  ) THEN
    ALTER TABLE promotions ADD COLUMN rotation_priority numeric DEFAULT 1.0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'promotions' AND column_name = 'performance_score'
  ) THEN
    ALTER TABLE promotions ADD COLUMN performance_score numeric DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'promotions' AND column_name = 'last_shown_at'
  ) THEN
    ALTER TABLE promotions ADD COLUMN last_shown_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'promotions' AND column_name = 'click_through_rate'
  ) THEN
    ALTER TABLE promotions ADD COLUMN click_through_rate numeric DEFAULT 0;
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_promotion_impressions_promotion_id ON promotion_impressions(promotion_id);
CREATE INDEX IF NOT EXISTS idx_promotion_impressions_user_id ON promotion_impressions(user_id);
CREATE INDEX IF NOT EXISTS idx_promotion_impressions_section ON promotion_impressions(section_key);
CREATE INDEX IF NOT EXISTS idx_promotion_impressions_time ON promotion_impressions(impression_time);
CREATE INDEX IF NOT EXISTS idx_promotion_rotation_state_promotion ON promotion_rotation_state(promotion_id);
CREATE INDEX IF NOT EXISTS idx_promotion_rotation_state_section ON promotion_rotation_state(section_key);
CREATE INDEX IF NOT EXISTS idx_promotion_rotation_state_priority ON promotion_rotation_state(rotation_priority);
CREATE INDEX IF NOT EXISTS idx_promotion_performance_metrics_promotion ON promotion_performance_metrics(promotion_id);
CREATE INDEX IF NOT EXISTS idx_promotion_performance_metrics_date ON promotion_performance_metrics(date);
CREATE INDEX IF NOT EXISTS idx_promotions_rotation_priority ON promotions(rotation_priority);
CREATE INDEX IF NOT EXISTS idx_promotions_performance_score ON promotions(performance_score);
CREATE INDEX IF NOT EXISTS idx_promotions_last_shown ON promotions(last_shown_at);

-- Enable RLS
ALTER TABLE promotion_impressions ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_rotation_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE promotion_performance_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for promotion_impressions

-- Anyone can insert impressions (for tracking)
CREATE POLICY "Anyone can record promotion impressions"
  ON promotion_impressions
  FOR INSERT
  TO public
  WITH CHECK (true);

-- Users can view their own impressions
CREATE POLICY "Users can view own promotion impressions"
  ON promotion_impressions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Admins can view all impressions
CREATE POLICY "Admins can view all promotion impressions"
  ON promotion_impressions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  );

-- RLS Policies for promotion_rotation_state

-- Public can view rotation state (needed for fair distribution)
CREATE POLICY "Anyone can view promotion rotation state"
  ON promotion_rotation_state
  FOR SELECT
  TO public
  USING (true);

-- Service role can manage rotation state
CREATE POLICY "Service role can manage rotation state"
  ON promotion_rotation_state
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for promotion_performance_metrics

-- Users can view their own promotion metrics
CREATE POLICY "Users can view own promotion metrics"
  ON promotion_performance_metrics
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM promotions
      WHERE promotions.id = promotion_performance_metrics.promotion_id
      AND promotions.user_id = auth.uid()
    )
  );

-- Admins can view all metrics
CREATE POLICY "Admins can view all promotion metrics"
  ON promotion_performance_metrics
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('admin', 'manager')
    )
  );

-- Function to calculate promotion score based on fairness algorithm
CREATE OR REPLACE FUNCTION calculate_promotion_score(
  p_promotion_id uuid,
  p_section_key text
)
RETURNS numeric AS $$
DECLARE
  v_ctr numeric;
  v_impressions integer;
  v_last_shown_minutes numeric;
  v_performance_weight numeric;
  v_recency_weight numeric;
  v_exposure_weight numeric;
  v_final_score numeric;
BEGIN
  -- Get rotation state
  SELECT
    COALESCE(click_through_rate, 0),
    COALESCE(total_impressions, 0),
    COALESCE(EXTRACT(EPOCH FROM (now() - last_shown_at)) / 60, 9999)
  INTO v_ctr, v_impressions, v_last_shown_minutes
  FROM promotion_rotation_state
  WHERE promotion_id = p_promotion_id AND section_key = p_section_key;

  -- If no state exists, return default high priority
  IF NOT FOUND THEN
    RETURN 10.0;
  END IF;

  -- Performance weight (CTR boost, max 20% increase)
  -- CTR of 5% = 1.0, CTR of 10% = 1.2 (max)
  v_performance_weight := LEAST(1.0 + (v_ctr / 50.0), 1.2);

  -- Recency weight (time since last shown)
  -- 0-5 min = 0.2, 5-15 min = 0.5, 15-30 min = 0.8, 30+ min = 1.0
  v_recency_weight := CASE
    WHEN v_last_shown_minutes < 5 THEN 0.2
    WHEN v_last_shown_minutes < 15 THEN 0.5
    WHEN v_last_shown_minutes < 30 THEN 0.8
    ELSE 1.0
  END;

  -- Exposure weight (fewer impressions = higher priority)
  -- Normalize based on total impressions (fewer = higher weight)
  v_exposure_weight := CASE
    WHEN v_impressions = 0 THEN 1.5
    WHEN v_impressions < 10 THEN 1.3
    WHEN v_impressions < 50 THEN 1.1
    WHEN v_impressions < 100 THEN 1.0
    WHEN v_impressions < 500 THEN 0.9
    ELSE 0.8
  END;

  -- Calculate final score
  -- Base score of 10, multiplied by weights
  v_final_score := 10.0 * v_performance_weight * v_recency_weight * v_exposure_weight;

  RETURN v_final_score;
END;
$$ LANGUAGE plpgsql;

-- Function to get fairly rotated promoted content
CREATE OR REPLACE FUNCTION get_fair_promoted_content(
  p_section_key text,
  p_content_type text,
  p_limit integer DEFAULT 10
)
RETURNS TABLE (
  promotion_id uuid,
  target_id uuid,
  target_title text,
  user_id uuid,
  rotation_priority numeric,
  performance_score numeric
) AS $$
DECLARE
  v_section_id uuid;
BEGIN
  -- Get section ID
  SELECT id INTO v_section_id
  FROM promotion_sections
  WHERE section_key = p_section_key AND is_active = true;

  IF v_section_id IS NULL THEN
    RETURN;
  END IF;

  -- Return promoted content with fair rotation
  RETURN QUERY
  SELECT
    p.id as promotion_id,
    p.target_id,
    p.target_title,
    p.user_id,
    COALESCE(calculate_promotion_score(p.id, p_section_key), 10.0) as rotation_priority,
    COALESCE(p.performance_score, 0) as performance_score
  FROM promotions p
  WHERE
    p.promotion_section_id = v_section_id
    AND p.promotion_type = p_content_type
    AND p.status = 'active'
    AND p.start_date <= now()
    AND p.end_date >= now()
  ORDER BY
    COALESCE(calculate_promotion_score(p.id, p_section_key), 10.0) DESC,
    RANDOM()
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Function to record promotion impression
CREATE OR REPLACE FUNCTION record_promotion_impression(
  p_promotion_id uuid,
  p_section_key text,
  p_user_id uuid DEFAULT NULL,
  p_clicked boolean DEFAULT false,
  p_session_id text DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  -- Insert impression record
  INSERT INTO promotion_impressions (
    promotion_id,
    section_key,
    user_id,
    clicked,
    session_id
  ) VALUES (
    p_promotion_id,
    p_section_key,
    p_user_id,
    p_clicked,
    p_session_id
  );

  -- Update rotation state
  INSERT INTO promotion_rotation_state (
    promotion_id,
    section_key,
    total_impressions,
    total_clicks,
    last_shown_at,
    click_through_rate
  ) VALUES (
    p_promotion_id,
    p_section_key,
    1,
    CASE WHEN p_clicked THEN 1 ELSE 0 END,
    now(),
    CASE WHEN p_clicked THEN 100.0 ELSE 0 END
  )
  ON CONFLICT (promotion_id, section_key) DO UPDATE SET
    total_impressions = promotion_rotation_state.total_impressions + 1,
    total_clicks = promotion_rotation_state.total_clicks + CASE WHEN p_clicked THEN 1 ELSE 0 END,
    last_shown_at = now(),
    click_through_rate = CASE
      WHEN (promotion_rotation_state.total_impressions + 1) > 0
      THEN ((promotion_rotation_state.total_clicks + CASE WHEN p_clicked THEN 1 ELSE 0 END)::numeric / (promotion_rotation_state.total_impressions + 1)::numeric) * 100.0
      ELSE 0
    END,
    updated_at = now();

  -- Update promotion table metrics
  UPDATE promotions SET
    impressions_actual = COALESCE(impressions_actual, 0) + 1,
    clicks = COALESCE(clicks, 0) + CASE WHEN p_clicked THEN 1 ELSE 0 END,
    last_shown_at = now(),
    click_through_rate = CASE
      WHEN (COALESCE(impressions_actual, 0) + 1) > 0
      THEN ((COALESCE(clicks, 0) + CASE WHEN p_clicked THEN 1 ELSE 0 END)::numeric / (COALESCE(impressions_actual, 0) + 1)::numeric) * 100.0
      ELSE 0
    END
  WHERE id = p_promotion_id;

  -- Update daily performance metrics
  INSERT INTO promotion_performance_metrics (
    promotion_id,
    section_key,
    date,
    impressions,
    clicks,
    unique_viewers,
    click_through_rate
  ) VALUES (
    p_promotion_id,
    p_section_key,
    CURRENT_DATE,
    1,
    CASE WHEN p_clicked THEN 1 ELSE 0 END,
    CASE WHEN p_user_id IS NOT NULL THEN 1 ELSE 0 END,
    CASE WHEN p_clicked THEN 100.0 ELSE 0 END
  )
  ON CONFLICT (promotion_id, section_key, date) DO UPDATE SET
    impressions = promotion_performance_metrics.impressions + 1,
    clicks = promotion_performance_metrics.clicks + CASE WHEN p_clicked THEN 1 ELSE 0 END,
    click_through_rate = CASE
      WHEN (promotion_performance_metrics.impressions + 1) > 0
      THEN ((promotion_performance_metrics.clicks + CASE WHEN p_clicked THEN 1 ELSE 0 END)::numeric / (promotion_performance_metrics.impressions + 1)::numeric) * 100.0
      ELSE 0
    END,
    updated_at = now();
END;
$$ LANGUAGE plpgsql;

-- Function to update promotion performance scores (run periodically)
CREATE OR REPLACE FUNCTION update_promotion_performance()
RETURNS void AS $$
BEGIN
  UPDATE promotions p
  SET
    performance_score = COALESCE(
      (
        SELECT
          (rs.click_through_rate * 0.5) +
          (LEAST(rs.total_impressions / 100.0, 10.0) * 0.3) +
          (LEAST(rs.total_clicks / 10.0, 10.0) * 0.2)
        FROM promotion_rotation_state rs
        WHERE rs.promotion_id = p.id
        LIMIT 1
      ),
      0
    )
  WHERE p.status = 'active'
    AND p.start_date <= now()
    AND p.end_date >= now();
END;
$$ LANGUAGE plpgsql;

-- Create triggers for updated_at timestamps
CREATE OR REPLACE FUNCTION update_promotion_tables_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_promotion_rotation_state_timestamp ON promotion_rotation_state;
CREATE TRIGGER update_promotion_rotation_state_timestamp
  BEFORE UPDATE ON promotion_rotation_state
  FOR EACH ROW
  EXECUTE FUNCTION update_promotion_tables_updated_at();

DROP TRIGGER IF EXISTS update_promotion_performance_metrics_timestamp ON promotion_performance_metrics;
CREATE TRIGGER update_promotion_performance_metrics_timestamp
  BEFORE UPDATE ON promotion_performance_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_promotion_tables_updated_at();
