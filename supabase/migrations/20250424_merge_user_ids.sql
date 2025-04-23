-- Move all rows from the old user to the user you keep
update public.notebooks set user_id = '87cb98f0-cb83-427b-bcd1-077b06a8e640' where user_id = '67e7e63f-8be9-46b8-b3cd-8a917be281af';
update public.sections set user_id = '87cb98f0-cb83-427b-bcd1-077b06a8e640' where user_id = '67e7e63f-8be9-46b8-b3cd-8a917be281af';
update public.items set user_id = '87cb98f0-cb83-427b-bcd1-077b06a8e640' where user_id = '67e7e63f-8be9-46b8-b3cd-8a917be281af';
update public.notes set user_id = '87cb98f0-cb83-427b-bcd1-077b06a8e640' where user_id = '67e7e63f-8be9-46b8-b3cd-8a917be281af';
update public.tags set user_id = '87cb98f0-cb83-427b-bcd1-077b06a8e640' where user_id = '67e7e63f-8be9-46b8-b3cd-8a917be281af';

-- Make sure every row now has a user_id
alter table public.items alter column user_id set not null;
alter table public.notes alter column user_id set not null;

-- Tell PostgREST to refresh its schema cache
notify pgrst, 'reload schema'; 