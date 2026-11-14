begin;
do $test$
declare
  uid uuid:=gen_random_uuid(); fake_uid uuid:=gen_random_uuid(); anchor_uid uuid:=gen_random_uuid();
  created timestamptz:='2026-11-14 12:34:56+00';
  item record;
begin
  if has_function_privilege('authenticated','public.list_portal_administrators()','EXECUTE') then raise exception 'Authenticated users can list Auth admins directly'; end if;
  if has_function_privilege('anon','public.list_portal_administrators()','EXECUTE') then raise exception 'Anonymous users can list admins'; end if;
  insert into auth.users(id,email,aud,role,created_at,email_confirmed_at,encrypted_password,raw_app_meta_data,raw_user_meta_data)
    values(uid,uid::text||'@list-admin.example.invalid','authenticated','authenticated',created,now(),'fixture-password','{"role":"partner_admin"}','{"full_name":"Manual Admin"}'),
      (fake_uid,fake_uid::text||'@list-admin.example.invalid','authenticated','authenticated',created,now(),'fixture-password','{}','{"role":"partner_admin"}'),
      (anchor_uid,anchor_uid::text||'@list-admin.example.invalid','authenticated','authenticated',created,now(),'fixture-password','{"role":"partner_admin"}','{}');
  select * into item from public.list_portal_administrators() where id=uid;
  if item.id is null or item.name<>'Manual Admin' or item.created_at<>created or not item.activated or item.disabled then raise exception 'Incorrect admin summary'; end if;
  if exists(select 1 from public.list_portal_administrators() where id=fake_uid) then raise exception 'User metadata counted as trusted admin'; end if;
  update auth.users set banned_until=now()+interval '1 day' where id=uid;
  if not (select disabled from public.list_portal_administrators() where id=uid) then raise exception 'Banned status missing'; end if;
  update auth.users set banned_until=null,email_confirmed_at=null where id=uid;
  if (select activated from public.list_portal_administrators() where id=uid) then raise exception 'Pending admin shown as active'; end if;
  if exists(select 1 from public.partner_registrations where user_id=uid) then raise exception 'Admin gained partner registration'; end if;
end;
$test$;
rollback;
