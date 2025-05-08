-- Check if position column exists and add it if it doesn't
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'folders' AND column_name = 'position'
  ) THEN
    ALTER TABLE folders ADD COLUMN position integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Check if other required columns exist and add them if they don't
DO $$ 
BEGIN 
  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'folders' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE folders ADD COLUMN user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'folders' AND column_name = 'notebook_id'
  ) THEN
    ALTER TABLE folders ADD COLUMN notebook_id uuid REFERENCES notebooks(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'folders' AND column_name = 'parent_folder_id'
  ) THEN
    ALTER TABLE folders ADD COLUMN parent_folder_id uuid REFERENCES folders(id) ON DELETE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'folders' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE folders ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

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

-- Rename title column to name if it exists
DO $$ 
BEGIN 
  IF EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'folders' AND column_name = 'title'
  ) AND NOT EXISTS (
    SELECT FROM information_schema.columns 
    WHERE table_name = 'folders' AND column_name = 'name'
  ) THEN
    ALTER TABLE folders RENAME COLUMN title TO name;
  END IF;
END $$; 