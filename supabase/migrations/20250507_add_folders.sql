CREATE TABLE folders (
id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
name text NOT NULL,
position integer NOT NULL DEFAULT 0,
user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE,
notebook_id uuid REFERENCES notebooks(id) ON DELETE CASCADE,
parent_folder_id uuid REFERENCES folders(id) ON DELETE CASCADE,
created_at timestamptz DEFAULT now(),
updated_at timestamptz DEFAULT now(),
CONSTRAINT folders_parent_check CHECK (
  (notebook_id IS NOT NULL AND parent_folder_id IS NULL) OR
  (notebook_id IS NULL AND parent_folder_id IS NOT NULL)
)
);

ALTER TABLE sections
ADD COLUMN folder_id uuid REFERENCES folders(id) ON DELETE SET NULL;

ALTER TABLE items
ADD COLUMN folder_id uuid REFERENCES folders(id) ON DELETE CASCADE;

-- Enable Row Level Security for folders
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;

-- Create policy for folders
CREATE POLICY "Users can manage their own folders"
  ON folders
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid()); 