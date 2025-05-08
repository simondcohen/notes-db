-- Folder support (adds table + references)
CREATE TABLE IF NOT EXISTS folders (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE IF EXISTS sections
  ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES folders(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS items
  ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES folders(id) ON DELETE CASCADE; 