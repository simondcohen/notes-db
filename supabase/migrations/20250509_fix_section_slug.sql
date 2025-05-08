-- Modify the sections_slug_notebook_id_key constraint to include folder_id
DROP INDEX IF EXISTS sections_slug_notebook_id_key;

-- Create the new index that considers folder_id in uniqueness
CREATE UNIQUE INDEX sections_slug_folder_constraint ON public.sections (
  slug, 
  notebook_id, 
  COALESCE(folder_id, '00000000-0000-0000-0000-000000000000')
);

-- Add a random suffix to section slugs when they're in folders to avoid collisions
CREATE OR REPLACE FUNCTION public.sections_set_slug() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  -- If title is 'New Section', add a random short suffix to ensure uniqueness
  IF new.title = 'New Section' AND new.folder_id IS NOT NULL THEN
    new.slug := lower(regexp_replace(new.title, '\s+', '_', 'g')) || '_' || substr(md5(random()::text), 1, 5);
  ELSE
    new.slug := lower(regexp_replace(new.title, '\s+', '_', 'g'));
  END IF;
  
  RETURN new;
END;
$$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS trg_sections_set_slug ON public.sections;
CREATE TRIGGER trg_sections_set_slug 
  BEFORE INSERT OR UPDATE ON public.sections 
  FOR EACH ROW EXECUTE FUNCTION public.sections_set_slug(); 