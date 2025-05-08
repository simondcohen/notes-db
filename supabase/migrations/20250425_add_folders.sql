-- Create folders table
CREATE TABLE IF NOT EXISTS folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  notebook_id uuid REFERENCES notebooks(id) ON DELETE CASCADE,
  parent_folder_id uuid REFERENCES folders(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT folders_parent_check CHECK (
    (notebook_id IS NOT NULL AND parent_folder_id IS NULL) OR
    (notebook_id IS NULL AND parent_folder_id IS NOT NULL)
  )
);

-- Add folder_id to sections
ALTER TABLE sections ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES folders(id) ON DELETE SET NULL;

-- Add folder_id to items
ALTER TABLE items ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES folders(id) ON DELETE SET NULL;

-- Add folder_id to subsections
ALTER TABLE subsections ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES folders(id) ON DELETE SET NULL;

-- Enable Row Level Security for folders
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;

-- Create policy for folders
CREATE POLICY "Users can manage their own folders"
  ON folders
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Update items constraint to allow folder_id
ALTER TABLE items DROP CONSTRAINT IF EXISTS items_parent_check;
ALTER TABLE items ADD CONSTRAINT items_parent_check CHECK (
  (section_id IS NOT NULL AND subsection_id IS NULL AND group_id IS NULL) OR
  (section_id IS NULL AND subsection_id IS NOT NULL AND group_id IS NULL) OR
  (section_id IS NULL AND subsection_id IS NULL AND group_id IS NOT NULL) OR
  (section_id IS NULL AND subsection_id IS NULL AND group_id IS NULL AND folder_id IS NOT NULL)
);

-- Tell PostgREST to refresh its schema cache
NOTIFY pgrst, 'reload schema'; 