-- Verify administrator activation without partner or Airtable fixtures.
begin;
do $test$
declare
  uid uuid:=gen_random_uuid(); sid uuid:=gen_random_uuid();
  email text:=uid::text||'@admin-activation.example.invalid';
begin
  if has_function_privilege('anon','public.partner_portal_session_valid()','EXECUTE') then raise exception 'Anonymous validation permitted'; end if;
  insert into auth.users(id,email,aud,role,raw_app_meta_data,raw_user_meta_data)
    values(uid,email,'authenticated','authenticated','{"role":"partner_admin"}','{}');
  insert into auth.sessions(id,user_id) values(sid,uid);
  perform set_config('request.jwt.claim.sub',uid::text,true);
  perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'email',email,'session_id',sid)::text,true);
  if not public.partner_portal_session_valid() then raise exception 'Admin without partner cannot activate'; end if;
  update auth.users set raw_app_meta_data='{}',raw_user_meta_data='{"role":"partner_admin"}' where id=uid;
  if public.partner_portal_session_valid() then raise exception 'User metadata grants administrator access'; end if;
  update auth.users set raw_app_meta_data='{"role":"partner_admin"}',banned_until=now()+interval '1 day' where id=uid;
  if public.partner_portal_session_valid() then raise exception 'Banned administrator accepted'; end if;
  update auth.users set banned_until=null where id=uid;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'email','other@example.invalid','session_id',sid)::text,true);
  if public.partner_portal_session_valid() then raise exception 'Stale email accepted'; end if;
  perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'email',email,'session_id',sid)::text,true);
  delete from auth.sessions where id=sid;
  if public.partner_portal_session_valid() then raise exception 'Revoked session accepted'; end if;
  if exists(select 1 from public.partner_registrations where user_id=uid) then raise exception 'Admin gained partner registration'; end if;
end;
$test$;
rollback;
