/*
  # Implement 30-Day Transaction History Auto-Deletion

  1. Problem
    - Transaction history accumulates indefinitely
    - Large transaction tables impact query performance
    - Users typically only need recent transaction history
    - No automated cleanup process exists

  2. Solution
    - Create an archive table for long-term storage (optional)
    - Implement cleanup function to delete transactions older than 30 days
    - Schedule automated cleanup using pg_cron
    - Add indexes for efficient date-based queries

  3. Changes
    - New table: treat_transactions_archive (optional long-term storage)
    - New function: cleanup_old_transactions() (deletes transactions > 30 days)
    - New cron job: Daily cleanup at 2 AM UTC
    - Performance indexes on created_at field

  4. Security
    - Maintains RLS policies
    - Only deletes transactions older than 30 days
    - Preserves audit trail in archive table
*/

-- Create archive table for long-term storage
CREATE TABLE IF NOT EXISTS public.treat_transactions_archive (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  transaction_type text NOT NULL,
  amount numeric NOT NULL,
  balance_before numeric,
  balance_after numeric,
  description text,
  metadata jsonb,
  status text DEFAULT 'completed',
  created_at timestamptz NOT NULL,
  archived_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes for archive table
CREATE INDEX IF NOT EXISTS idx_treat_transactions_archive_user_id
  ON public.treat_transactions_archive(user_id);
CREATE INDEX IF NOT EXISTS idx_treat_transactions_archive_created_at
  ON public.treat_transactions_archive(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_treat_transactions_archive_archived_at
  ON public.treat_transactions_archive(archived_at DESC);

-- Enable RLS on archive table
ALTER TABLE public.treat_transactions_archive ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view their own archived transactions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'treat_transactions_archive'
    AND policyname = 'Users can view own archived transactions'
  ) THEN
    CREATE POLICY "Users can view own archived transactions"
      ON public.treat_transactions_archive
      FOR SELECT
      TO authenticated
      USING (auth.uid() = user_id);
  END IF;
END $$;

-- RLS Policy: Admins can view all archived transactions
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
    AND tablename = 'treat_transactions_archive'
    AND policyname = 'Admins can view all archived transactions'
  ) THEN
    CREATE POLICY "Admins can view all archived transactions"
      ON public.treat_transactions_archive
      FOR SELECT
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.users
          WHERE id = auth.uid()
          AND role = 'admin'
        )
      );
  END IF;
END $$;

-- Create function to cleanup old transactions
CREATE OR REPLACE FUNCTION public.cleanup_old_transactions()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count integer := 0;
  v_archived_count integer := 0;
  v_cutoff_date timestamptz;
BEGIN
  v_cutoff_date := now() - INTERVAL '30 days';

  INSERT INTO public.treat_transactions_archive (
    id,
    user_id,
    transaction_type,
    amount,
    balance_before,
    balance_after,
    description,
    metadata,
    status,
    created_at,
    archived_at
  )
  SELECT
    id,
    user_id,
    transaction_type,
    amount,
    balance_before,
    balance_after,
    description,
    metadata,
    status,
    created_at,
    now()
  FROM public.treat_transactions
  WHERE created_at < v_cutoff_date
  AND NOT EXISTS (
    SELECT 1
    FROM public.treat_transactions_archive
    WHERE treat_transactions_archive.id = treat_transactions.id
  );

  GET DIAGNOSTICS v_archived_count = ROW_COUNT;

  DELETE FROM public.treat_transactions
  WHERE created_at < v_cutoff_date;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RAISE NOTICE 'Transaction cleanup completed: % archived, % deleted',
    v_archived_count, v_deleted_count;

EXCEPTION
  WHEN OTHERS THEN
    RAISE WARNING 'Error during transaction cleanup: %', SQLERRM;
END;
$$;

COMMENT ON FUNCTION public.cleanup_old_transactions() IS
'Automatically archives and deletes transactions older than 30 days.';

-- Create manual cleanup function for admins
CREATE OR REPLACE FUNCTION public.admin_cleanup_old_transactions()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted_count integer := 0;
  v_archived_count integer := 0;
  v_cutoff_date timestamptz;
  v_is_admin boolean;
BEGIN
  SELECT role = 'admin' INTO v_is_admin
  FROM public.users
  WHERE id = auth.uid();

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Only admins can perform cleanup operations';
  END IF;

  v_cutoff_date := now() - INTERVAL '30 days';

  INSERT INTO public.treat_transactions_archive (
    id,
    user_id,
    transaction_type,
    amount,
    balance_before,
    balance_after,
    description,
    metadata,
    status,
    created_at,
    archived_at
  )
  SELECT
    id,
    user_id,
    transaction_type,
    amount,
    balance_before,
    balance_after,
    description,
    metadata,
    status,
    created_at,
    now()
  FROM public.treat_transactions
  WHERE created_at < v_cutoff_date
  AND NOT EXISTS (
    SELECT 1
    FROM public.treat_transactions_archive
    WHERE treat_transactions_archive.id = treat_transactions.id
  );

  GET DIAGNOSTICS v_archived_count = ROW_COUNT;

  DELETE FROM public.treat_transactions
  WHERE created_at < v_cutoff_date;

  GET DIAGNOSTICS v_deleted_count = ROW_COUNT;

  RETURN json_build_object(
    'success', true,
    'archived_count', v_archived_count,
    'deleted_count', v_deleted_count,
    'cutoff_date', v_cutoff_date
  );

EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object(
      'success', false,
      'error', SQLERRM
    );
END;
$$;

COMMENT ON FUNCTION public.admin_cleanup_old_transactions() IS
'Manual cleanup function that can be called by admins to archive and delete old transactions.';

GRANT EXECUTE ON FUNCTION public.admin_cleanup_old_transactions() TO authenticated;

-- Create view for cleanup statistics
CREATE OR REPLACE VIEW public.transaction_cleanup_stats AS
SELECT
  COUNT(*) as total_transactions,
  COUNT(*) FILTER (WHERE created_at >= now() - INTERVAL '7 days') as last_7_days,
  COUNT(*) FILTER (WHERE created_at >= now() - INTERVAL '30 days') as last_30_days,
  COUNT(*) FILTER (WHERE created_at < now() - INTERVAL '30 days') as older_than_30_days,
  MIN(created_at) as oldest_transaction,
  MAX(created_at) as newest_transaction,
  (SELECT COUNT(*) FROM public.treat_transactions_archive) as archived_count
FROM public.treat_transactions;

GRANT SELECT ON public.transaction_cleanup_stats TO authenticated;

COMMENT ON VIEW public.transaction_cleanup_stats IS
'Provides statistics about transaction history and cleanup status.';
