-- 1. TAGS -----------------------------------------------------------------
alter table public.tags  add column if not exists slug text;
update public.tags set slug = lower(regexp_replace(name, '\s+', '_', 'g')) where slug is null;
create unique index if not exists tags_slug_user_id_key on public.tags (slug, user_id);
create or replace function public.tags_set_slug() returns trigger language plpgsql as $$
begin new.slug := lower(regexp_replace(new.name , '\s+', '_', 'g')); return new; end; $$;
drop trigger if exists trg_tags_set_slug on public.tags;
create trigger trg_tags_set_slug before insert or update on public.tags for each row execute function public.tags_set_slug();

-- 2. NOTEBOOKS ------------------------------------------------------------
alter table public.notebooks add column if not exists slug text;
update public.notebooks set slug = lower(regexp_replace(title, '\s+', '_', 'g')) where slug is null;
create unique index if not exists notebooks_slug_user_id_key on public.notebooks (slug, user_id);
create or replace function public.notebooks_set_slug() returns trigger language plpgsql as $$
begin new.slug := lower(regexp_replace(new.title, '\s+', '_', 'g')); return new; end; $$;
drop trigger if exists trg_notebooks_set_slug on public.notebooks;
create trigger trg_notebooks_set_slug before insert or update on public.notebooks for each row execute function public.notebooks_set_slug();

-- 3. SECTIONS -------------------------------------------------------------
alter table public.sections add column if not exists slug text;
update public.sections set slug = lower(regexp_replace(title, '\s+', '_', 'g')) where slug is null;
create unique index if not exists sections_slug_notebook_id_key on public.sections (slug, notebook_id);
create or replace function public.sections_set_slug() returns trigger language plpgsql as $$
begin new.slug := lower(regexp_replace(new.title, '\s+', '_', 'g')); return new; end; $$;
drop trigger if exists trg_sections_set_slug on public.sections;
create trigger trg_sections_set_slug before insert or update on public.sections for each row execute function public.sections_set_slug();

-- 4. ITEMS ----------------------------------------------------------------
alter table public.items add column if not exists slug text;
alter table public.items add column if not exists user_id uuid;
update public.items set slug = lower(regexp_replace(title, '\s+', '_', 'g')) where slug is null;
create unique index if not exists items_slug_section_id_key on public.items (slug, section_id);
create or replace function public.items_set_slug() returns trigger language plpgsql as $$
begin new.slug := lower(regexp_replace(new.title, '\s+', '_', 'g')); return new; end; $$;
drop trigger if exists trg_items_set_slug on public.items;
create trigger trg_items_set_slug before insert or update on public.items for each row execute function public.items_set_slug();

-- 5. NOTES ----------------------------------------------------------------
alter table public.notes add column if not exists user_id uuid; 