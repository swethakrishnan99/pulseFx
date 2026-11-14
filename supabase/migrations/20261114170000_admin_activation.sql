begin;
-- Password setup must validate live sessions for both portal roles. Admins do
-- not have partner registrations or Airtable records; trust Auth metadata only.
create or replace function public.partner_portal_session_valid()
returns boolean language sql stable security definer set search_path='' as $$
  select exists (
    select 1 from auth.sessions s join auth.users u on u.id=s.user_id
    left join public.partner_registrations r on r.user_id=u.id
    where u.id=(select auth.uid()) and s.id::text=(select auth.jwt()->>'session_id')
      and lower(u.email)=lower((select auth.jwt()->>'email'))
      and not coalesce(u.banned_until>now(),false)
      and (
        u.raw_app_meta_data->>'role'='partner_admin'
        or (lower(u.email)=r.email and r.ready and not r.disabled
          and not r.profile_edit_pending and r.deleted_at is null)
      )
  );
$$;
revoke all on function public.partner_portal_session_valid() from public, anon;
grant execute on function public.partner_portal_session_valid() to authenticated;
commit;
