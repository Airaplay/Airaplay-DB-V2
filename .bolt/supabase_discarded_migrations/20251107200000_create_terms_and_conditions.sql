-- Create Terms and Conditions Management System
-- Allows admins to manage separate Terms & Conditions for user signup and artist registration

CREATE TABLE IF NOT EXISTS terms_and_conditions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('user_signup', 'artist_registration')),
  content text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id),
  updated_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create partial unique index for active terms (one active per type)
CREATE UNIQUE INDEX IF NOT EXISTS unique_active_terms_type 
ON terms_and_conditions (type) 
WHERE (is_active = true);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_terms_and_conditions_type_active ON terms_and_conditions(type, is_active);

-- Enable RLS
ALTER TABLE terms_and_conditions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Admins can manage all terms
CREATE POLICY "Admins can manage terms and conditions"
  ON terms_and_conditions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid() AND users.role = 'admin'
    )
  );

-- All authenticated users can read active terms
CREATE POLICY "Users can read active terms and conditions"
  ON terms_and_conditions
  FOR SELECT
  USING (is_active = true);

-- Anonymous users can read active terms (for signup screen)
CREATE POLICY "Anonymous users can read active terms and conditions"
  ON terms_and_conditions
  FOR SELECT
  USING (is_active = true);

-- Function to get active terms by type
CREATE OR REPLACE FUNCTION get_active_terms(terms_type text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  terms_content text;
BEGIN
  SELECT content INTO terms_content
  FROM terms_and_conditions
  WHERE type = terms_type AND is_active = true
  ORDER BY version DESC, created_at DESC
  LIMIT 1;
  
  RETURN COALESCE(terms_content, '');
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION get_active_terms(text) TO authenticated, anon;

-- Insert default terms (if none exist)
INSERT INTO terms_and_conditions (type, content, is_active, created_by)
SELECT 
  'user_signup',
  'By creating an account, you agree to comply with our Terms of Service and Privacy Policy. You are responsible for maintaining the confidentiality of your account and password.',
  true,
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM terms_and_conditions WHERE type = 'user_signup' AND is_active = true
);

INSERT INTO terms_and_conditions (type, content, is_active, created_by)
SELECT 
  'artist_registration',
  'By submitting this artist registration form, you agree to our Terms of Service for artists. You certify that all information provided is accurate and that you have the right to use any content you upload.',
  true,
  NULL
WHERE NOT EXISTS (
  SELECT 1 FROM terms_and_conditions WHERE type = 'artist_registration' AND is_active = true
);

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_terms_and_conditions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_terms_and_conditions_updated_at
  BEFORE UPDATE ON terms_and_conditions
  FOR EACH ROW
  EXECUTE FUNCTION update_terms_and_conditions_updated_at();

COMMENT ON TABLE terms_and_conditions IS 'Stores Terms and Conditions for different user flows (user signup, artist registration)';
COMMENT ON COLUMN terms_and_conditions.type IS 'Type of terms: user_signup or artist_registration';
COMMENT ON COLUMN terms_and_conditions.version IS 'Version number for tracking changes';
COMMENT ON COLUMN terms_and_conditions.is_active IS 'Only one active version per type allowed';

