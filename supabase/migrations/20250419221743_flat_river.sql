/*
  # Initial Schema Setup

  1. New Tables
    - `notebooks`: Store user notebooks
    - `sections`: Store sections within notebooks
    - `subsections`: Store subsections within sections
    - `groups`: Store groups within sections or subsections
    - `items`: Store items within sections, subsections, or groups
    - `notes`: Store notes within items

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users
*/

-- Create notebooks table if it doesn't exist
CREATE TABLE IF NOT EXISTS notebooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_modified timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create sections table if it doesn't exist
CREATE TABLE IF NOT EXISTS sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  position integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create subsections table if it doesn't exist
CREATE TABLE IF NOT EXISTS subsections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  title text NOT NULL,
  position integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create groups table if it doesn't exist
CREATE TABLE IF NOT EXISTS groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid REFERENCES sections(id) ON DELETE CASCADE,
  subsection_id uuid REFERENCES subsections(id) ON DELETE CASCADE,
  title text NOT NULL,
  position integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT groups_parent_check CHECK (
    (section_id IS NOT NULL AND subsection_id IS NULL) OR
    (section_id IS NULL AND subsection_id IS NOT NULL)
  )
);

-- Create items table if it doesn't exist
CREATE TABLE IF NOT EXISTS items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid REFERENCES sections(id) ON DELETE CASCADE,
  subsection_id uuid REFERENCES subsections(id) ON DELETE CASCADE,
  group_id uuid REFERENCES groups(id) ON DELETE CASCADE,
  title text NOT NULL,
  position integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT items_parent_check CHECK (
    (section_id IS NOT NULL AND subsection_id IS NULL AND group_id IS NULL) OR
    (section_id IS NULL AND subsection_id IS NOT NULL AND group_id IS NULL) OR
    (section_id IS NULL AND subsection_id IS NULL AND group_id IS NOT NULL)
  )
);

-- Create notes table if it doesn't exist
CREATE TABLE IF NOT EXISTS notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
DO $$ 
BEGIN
  EXECUTE 'ALTER TABLE notebooks ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE sections ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE subsections ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE groups ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE items ENABLE ROW LEVEL SECURITY';
  EXECUTE 'ALTER TABLE notes ENABLE ROW LEVEL SECURITY';
EXCEPTION 
  WHEN others THEN NULL;
END $$;

-- Drop existing policies if they exist
DO $$ 
BEGIN
  EXECUTE 'DROP POLICY IF EXISTS "Users can manage their own notebooks" ON notebooks';
  EXECUTE 'DROP POLICY IF EXISTS "Users can manage their own sections" ON sections';
  EXECUTE 'DROP POLICY IF EXISTS "Users can manage subsections through sections" ON subsections';
  EXECUTE 'DROP POLICY IF EXISTS "Users can manage groups" ON groups';
  EXECUTE 'DROP POLICY IF EXISTS "Users can manage items" ON items';
  EXECUTE 'DROP POLICY IF EXISTS "Users can manage notes through items" ON notes';
EXCEPTION 
  WHEN others THEN NULL;
END $$;

-- Create policies
CREATE POLICY "Users can manage their own notebooks"
  ON notebooks
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own sections"
  ON sections
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage subsections through sections"
  ON subsections
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sections
      WHERE sections.id = subsections.section_id
      AND sections.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sections
      WHERE sections.id = subsections.section_id
      AND sections.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage groups"
  ON groups
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sections
      WHERE (
        (groups.section_id = sections.id OR
         groups.subsection_id IN (
           SELECT id FROM subsections WHERE section_id = sections.id
         ))
        AND sections.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sections
      WHERE (
        (groups.section_id = sections.id OR
         groups.subsection_id IN (
           SELECT id FROM subsections WHERE section_id = sections.id
         ))
        AND sections.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage items"
  ON items
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sections
      WHERE (
        (items.section_id = sections.id OR
         items.subsection_id IN (
           SELECT id FROM subsections WHERE section_id = sections.id
         ) OR
         items.group_id IN (
           SELECT id FROM groups WHERE section_id = sections.id OR
           subsection_id IN (
             SELECT id FROM subsections WHERE section_id = sections.id
           )
         ))
        AND sections.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sections
      WHERE (
        (items.section_id = sections.id OR
         items.subsection_id IN (
           SELECT id FROM subsections WHERE section_id = sections.id
         ) OR
         items.group_id IN (
           SELECT id FROM groups WHERE section_id = sections.id OR
           subsection_id IN (
             SELECT id FROM subsections WHERE section_id = sections.id
           )
         ))
        AND sections.user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can manage notes through items"
  ON notes
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM sections
      WHERE EXISTS (
        SELECT 1 FROM items
        WHERE items.id = notes.item_id
        AND (
          items.section_id = sections.id OR
          items.subsection_id IN (
            SELECT id FROM subsections WHERE section_id = sections.id
          ) OR
          items.group_id IN (
            SELECT id FROM groups WHERE section_id = sections.id OR
            subsection_id IN (
              SELECT id FROM subsections WHERE section_id = sections.id
            )
          )
        )
        AND sections.user_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM sections
      WHERE EXISTS (
        SELECT 1 FROM items
        WHERE items.id = notes.item_id
        AND (
          items.section_id = sections.id OR
          items.subsection_id IN (
            SELECT id FROM subsections WHERE section_id = sections.id
          ) OR
          items.group_id IN (
            SELECT id FROM groups WHERE section_id = sections.id OR
            subsection_id IN (
              SELECT id FROM subsections WHERE section_id = sections.id
            )
          )
        )
        AND sections.user_id = auth.uid()
      )
    )
  );

-- Create or replace function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing triggers if they exist
DO $$ 
BEGIN
  EXECUTE 'DROP TRIGGER IF EXISTS update_notebooks_updated_at ON notebooks';
  EXECUTE 'DROP TRIGGER IF EXISTS update_sections_updated_at ON sections';
  EXECUTE 'DROP TRIGGER IF EXISTS update_subsections_updated_at ON subsections';
  EXECUTE 'DROP TRIGGER IF EXISTS update_groups_updated_at ON groups';
  EXECUTE 'DROP TRIGGER IF EXISTS update_items_updated_at ON items';
  EXECUTE 'DROP TRIGGER IF EXISTS update_notes_updated_at ON notes';
EXCEPTION 
  WHEN others THEN NULL;
END $$;

-- Create triggers for updated_at
CREATE TRIGGER update_notebooks_updated_at
  BEFORE UPDATE ON notebooks
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_sections_updated_at
  BEFORE UPDATE ON sections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_subsections_updated_at
  BEFORE UPDATE ON subsections
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_groups_updated_at
  BEFORE UPDATE ON groups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_items_updated_at
  BEFORE UPDATE ON items
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_notes_updated_at
  BEFORE UPDATE ON notes
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();