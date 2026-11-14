begin;
create function public.get_partner_display_profile()
returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', r.partner_id, 'name', r.company)
  from public.partner_registrations r
  join public.partner_memberships m on m.user_id = r.user_id and m.partner_id = r.partner_id
  where r.user_id = (select auth.uid()) and m.enabled and r.ready and not r.disabled and r.deleted_at is null
  limit 1;
$$;
revoke all on function public.get_partner_display_profile() from public, anon;
grant execute on function public.get_partner_display_profile() to authenticated;
commit;
