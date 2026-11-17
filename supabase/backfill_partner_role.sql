-- Run in the Supabase SQL Editor. Preserve every other app_metadata property.
-- Only registered/linked partners qualify; administrators and other roles remain unchanged.
begin;

update auth.users as u
set raw_app_meta_data = coalesce(u.raw_app_meta_data, '{}'::jsonb)
    || jsonb_build_object('role', 'partner'),
    updated_at = now()
where (u.raw_app_meta_data->>'role' is null or u.raw_app_meta_data->>'role' = '')
  and (
    exists (select 1 from public.partner_registrations r
            where r.user_id = u.id and r.deleted_at is null)
    or exists (select 1 from public.partner_memberships m where m.user_id = u.id)
  )
returning u.id, u.email, u.raw_app_meta_data->>'role' as role;

commit;
