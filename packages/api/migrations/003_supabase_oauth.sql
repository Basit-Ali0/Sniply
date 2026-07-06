-- Snip.ly OAuth Migration
-- Drop the custom users table and reference auth.users instead.
-- Run this in Supabase SQL Editor after configuring OAuth providers.

-- 1. First, ensure all existing links.user_id values reference valid auth.users
--    (these will have been created during the sign-up flow, or are null for anonymous)

-- 2. Drop the foreign key from links → public.users
ALTER TABLE links
  DROP CONSTRAINT IF EXISTS links_user_id_fkey;

-- 3. Re-add it pointing to auth.users with cascade delete
ALTER TABLE links
  ADD CONSTRAINT links_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 4. Drop the custom users table (no longer needed — Supabase Auth manages users)
DROP TABLE IF EXISTS users;

-- 5. Remove the old API key index; we no longer look up by api_key_hash
DROP INDEX IF EXISTS idx_links_user_id;

-- 6. Re-create the user_id index (still useful for listing links by owner)
CREATE INDEX idx_links_user_id ON links(user_id);
