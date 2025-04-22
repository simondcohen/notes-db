/*
  # Add tags and note_tags tables

  1. New Tables
    - `tags`: Store user-created tags
      - `id` (uuid, primary key)
      - `user_id` (uuid, references auth.users)
      - `name` (text)
      - `created_at` (timestamp)
    - `note_tags`: Junction table linking notes to tags
      - `note_id` (uuid, references notes)
      - `tag_id` (uuid, references tags)
      - Composite primary key (note_id, tag_id)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage their own tags
    - Add policies for users to manage tags on their own notes
*/

-- Drop existing tables if they exist
DROP TABLE IF EXISTS note_tags CASCADE;
DROP TABLE IF EXISTS tags CASCADE;

-- Create tags table
CREATE TABLE tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Create note_tags junction table
CREATE TABLE note_tags (
  note_id uuid NOT NULL REFERENCES notes(id) ON DELETE CASCADE,
  tag_id uuid NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, tag_id)
);

-- Enable Row Level Security
ALTER TABLE tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE note_tags ENABLE ROW LEVEL SECURITY;

-- Create policy for tags
CREATE POLICY "Users can manage their own tags"
ON tags
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Create policy for note_tags
CREATE POLICY "Users can manage tags on their own notes"
ON note_tags
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM notes
    JOIN items ON items.id = notes.item_id
    JOIN sections ON (
      items.section_id = sections.id
      OR items.subsection_id IN (
        SELECT id FROM subsections WHERE section_id = sections.id
      )
      OR items.group_id IN (
        SELECT id FROM groups 
        WHERE section_id = sections.id 
        OR subsection_id IN (
          SELECT id FROM subsections WHERE section_id = sections.id
        )
      )
    )
    WHERE notes.id = note_tags.note_id
    AND sections.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1
    FROM tags
    WHERE tags.id = note_tags.tag_id
    AND tags.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM notes
    JOIN items ON items.id = notes.item_id
    JOIN sections ON (
      items.section_id = sections.id
      OR items.subsection_id IN (
        SELECT id FROM subsections WHERE section_id = sections.id
      )
      OR items.group_id IN (
        SELECT id FROM groups 
        WHERE section_id = sections.id 
        OR subsection_id IN (
          SELECT id FROM subsections WHERE section_id = sections.id
        )
      )
    )
    WHERE notes.id = note_tags.note_id
    AND sections.user_id = auth.uid()
  )
  AND EXISTS (
    SELECT 1
    FROM tags
    WHERE tags.id = note_tags.tag_id
    AND tags.user_id = auth.uid()
  )
);