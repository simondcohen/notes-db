alter table public.tags
  add column if not exists slug text;

update public.tags
set    slug = lower(regexp_replace(name, '\s+', '_', 'g'))
where  slug is null;

create unique index if not exists tags_slug_user_id_key
  on public.tags (slug, user_id);

create or replace function public.tags_set_slug() returns trigger
language plpgsql as $$
begin
  new.slug := lower(regexp_replace(new.name, '\s+', '_', 'g'));
  return new;
end;
$$;

drop trigger if exists trg_tags_set_slug on public.tags;
create trigger trg_tags_set_slug
  before insert or update on public.tags
  for each row execute function public.tags_set_slug();

alter table public.notebooks
  add column if not exists slug text;

update public.notebooks
set    slug = lower(regexp_replace(title, '\s+', '_', 'g'))
where  slug is null;

create unique index if not exists notebooks_slug_user_id_key
  on public.notebooks (slug, user_id);

create or replace function public.notebooks_set_slug() returns trigger
language plpgsql as $$
begin
  new.slug := lower(regexp_replace(new.title, '\s+', '_', 'g'));
  return new;
end;
$$;

drop trigger if exists trg_notebooks_set_slug on public.notebooks;
create trigger trg_notebooks_set_slug
  before insert or update on public.notebooks
  for each row execute function public.notebooks_set_slug(); 