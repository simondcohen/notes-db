-- Migration to sync folders table schema with TypeScript expectations
--
-- In TypeScript, Folder has: id, title, items, sections, parentFolderId
-- In database, we have: id, name, position, user_id, notebook_id, parent_folder_id, created_at, updated_at
--
-- The main issue is that TypeScript uses "title" while the database uses "name"
-- We'll handle this with comments rather than a field name change to avoid breaking existing code

-- Add any missing columns - current TypeScript expects "title" but database has "name"
-- We won't rename columns but document the difference
COMMENT ON COLUMN folders.name IS 'Corresponds to "title" field in TypeScript Folder interface';

-- Ensure all needed columns exist
ALTER TABLE folders 
ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Add constraint if it doesn't exist
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'folders_parent_check'
  ) THEN
    ALTER TABLE folders ADD CONSTRAINT folders_parent_check CHECK (
      (notebook_id IS NOT NULL AND parent_folder_id IS NULL) OR
      (notebook_id IS NULL AND parent_folder_id IS NOT NULL)
    );
  END IF;
END $$;

-- Ensure RLS is enabled
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;

-- Ensure policy exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'folders' AND policyname = 'Users can manage their own folders'
  ) THEN
    CREATE POLICY "Users can manage their own folders"
      ON folders
      FOR ALL
      TO authenticated
      USING (user_id = auth.uid())
      WITH CHECK (user_id = auth.uid());
  END IF;
END $$;

-- Run this in the Supabase SQL editor
CREATE OR REPLACE POLICY "Users can manage their own items"
  ON items
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid()); 