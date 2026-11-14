begin;
do $$
declare
  registration record;
  profile jsonb;
  sid uuid:=gen_random_uuid();
begin
  if has_function_privilege('anon', 'public.get_partner_display_profile()', 'EXECUTE') then raise exception 'Anonymous profile access allowed'; end if;
  select r.user_id, r.company, r.partner_id, r.email into registration from public.partner_registrations r
    join public.partner_memberships m on m.user_id = r.user_id and m.partner_id = r.partner_id
    where m.enabled and r.ready and not r.disabled and r.deleted_at is null limit 1;
  if found then
    insert into auth.sessions(id,user_id) values(sid,registration.user_id);
    perform set_config('request.jwt.claim.sub', registration.user_id::text, true);
    perform set_config('request.jwt.claims',jsonb_build_object('sub',registration.user_id,'email',registration.email,'session_id',sid)::text,true);
    profile := public.get_partner_display_profile();
    if profile->>'name' is distinct from registration.company or profile->>'id' is distinct from registration.partner_id then raise exception 'Linked profile mismatch'; end if;
  end if;
  perform set_config('request.jwt.claim.sub', gen_random_uuid()::text, true);
  if public.get_partner_display_profile() is not null then raise exception 'Unlinked user received a partner profile'; end if;
end;
$$;
rollback;
