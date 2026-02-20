/*
  # Create promotion_performance_metrics Table
  
  ## Overview
  The promotion_performance_metrics table tracks daily aggregated performance metrics 
  for each promotion in each section. This is essential for the fairness system to work.
  
  ## 1. New Tables
    - `promotion_performance_metrics`: Daily aggregated metrics per promotion per section
  
  ## 2. Columns
    - id: Primary key
    - promotion_id: Reference to promotion
    - section_key: Section where metrics are tracked
    - date: Date for metrics
    - impressions: Number of impressions on this date
    - clicks: Number of clicks on this date
    - unique_viewers: Number of unique users who viewed
    - click_through_rate: Calculated CTR percentage
    - created_at: When record was created
    - updated_at: When record was last updated
  
  ## 3. Security
    - Enable RLS
    - Users can view their own promotion metrics
    - Admins can view all metrics
  
  ## 4. Constraints
    - Unique constraint on (promotion_id, section_key, date)
*/

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

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_promotion_performance_metrics_promotion 
  ON promotion_performance_metrics(promotion_id);
CREATE INDEX IF NOT EXISTS idx_promotion_performance_metrics_section 
  ON promotion_performance_metrics(section_key);
CREATE INDEX IF NOT EXISTS idx_promotion_performance_metrics_date 
  ON promotion_performance_metrics(date);
CREATE INDEX IF NOT EXISTS idx_promotion_performance_metrics_composite 
  ON promotion_performance_metrics(promotion_id, section_key, date);

-- Enable RLS
ALTER TABLE promotion_performance_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies

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

-- Service role can manage all metrics
CREATE POLICY "Service role can manage promotion metrics"
  ON promotion_performance_metrics
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Authenticated users can insert metrics (for tracking)
CREATE POLICY "Authenticated users can insert promotion metrics"
  ON promotion_performance_metrics
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create trigger for updated_at timestamp
CREATE OR REPLACE FUNCTION update_promotion_performance_metrics_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_promotion_performance_metrics_timestamp_trigger 
  ON promotion_performance_metrics;
CREATE TRIGGER update_promotion_performance_metrics_timestamp_trigger
  BEFORE UPDATE ON promotion_performance_metrics
  FOR EACH ROW
  EXECUTE FUNCTION update_promotion_performance_metrics_timestamp();

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON promotion_performance_metrics TO authenticated;
GRANT ALL ON promotion_performance_metrics TO service_role;
