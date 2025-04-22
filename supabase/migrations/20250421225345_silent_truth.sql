/*
  # Fix tags table RLS policy

  1. Changes
    - Drop existing RLS policy for tags table
    - Create new policy that properly allows authenticated users to manage their tags
    - Ensure policy covers all CRUD operations
*/

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Users can manage their own tags" ON tags;

-- Create new policy
CREATE POLICY "Users can manage their own tags"
ON tags
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);