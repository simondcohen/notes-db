/*
  # Fix Schema Relationships

  1. Changes
    - Drop existing tables and recreate them with proper relationships
    - Add missing user_id column to sections table
    - Update RLS policies to use proper joins
*/

-- Drop existing tables in reverse order to handle dependencies
DROP TABLE IF EXISTS notes CASCADE;
DROP TABLE IF EXISTS items CASCADE;
DROP TABLE IF EXISTS groups CASCADE;
DROP TABLE IF EXISTS subsections CASCADE;
DROP TABLE IF EXISTS sections CASCADE;
DROP TABLE IF EXISTS notebooks CASCADE;

-- Create notebooks table
CREATE TABLE notebooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_modified timestamptz DEFAULT now(),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create sections table
CREATE TABLE sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notebook_id uuid NOT NULL REFERENCES notebooks(id) ON DELETE CASCADE,
  title text NOT NULL,
  position integer NOT NULL,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create subsections table
CREATE TABLE subsections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id uuid NOT NULL REFERENCES sections(id) ON DELETE CASCADE,
  title text NOT NULL,
  position integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create groups table
CREATE TABLE groups (
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

-- Create items table
CREATE TABLE items (
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

-- Create notes table
CREATE TABLE notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid NOT NULL REFERENCES items(id) ON DELETE CASCADE,
  title text NOT NULL,
  content text NOT NULL DEFAULT '',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE notebooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE subsections ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE items ENABLE ROW LEVEL SECURITY;
ALTER TABLE notes ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Users can manage their own notebooks"
ON notebooks FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage their own sections"
ON sections FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage subsections through sections"
ON subsections FOR ALL TO authenticated
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
ON groups FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM sections
    WHERE (
      groups.section_id = sections.id OR
      groups.subsection_id IN (
        SELECT id FROM subsections WHERE section_id = sections.id
      )
    )
    AND sections.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM sections
    WHERE (
      groups.section_id = sections.id OR
      groups.subsection_id IN (
        SELECT id FROM subsections WHERE section_id = sections.id
      )
    )
    AND sections.user_id = auth.uid()
  )
);

CREATE POLICY "Users can manage items"
ON items FOR ALL TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM sections
    WHERE (
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
WITH CHECK (
  EXISTS (
    SELECT 1 FROM sections
    WHERE (
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
);

CREATE POLICY "Users can manage notes through items"
ON notes FOR ALL TO authenticated
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

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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