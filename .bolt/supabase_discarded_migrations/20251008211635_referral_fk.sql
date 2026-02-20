/*
  # Fix Referrals Referred ID Foreign Key Target

  1. Issue
    - The `referred_id` foreign key points to `auth.users` instead of `public.users`
    - This causes Supabase client queries using named relationships to fail
    - The `referrer_id` correctly points to `public.users`

  2. Solution
    - Drop the incorrect foreign key constraint
    - Recreate it pointing to the correct `public.users` table

  3. Security
    - No RLS changes needed
    - Maintains referential integrity
*/

-- Drop the incorrect foreign key constraint
ALTER TABLE referrals
DROP CONSTRAINT IF EXISTS referrals_referred_id_fkey;

-- Add the correct foreign key constraint pointing to public.users
ALTER TABLE referrals
ADD CONSTRAINT referrals_referred_id_fkey
FOREIGN KEY (referred_id)
REFERENCES public.users(id)
ON DELETE CASCADE;
