begin;
-- Exercise the actual last-admin trigger body against isolated temporary rows.
create temporary table admin_action_test_users (like auth.users including defaults);
do $test$
declare definition text; first_id uuid:=gen_random_uuid(); second_id uuid:=gen_random_uuid(); rejected boolean:=false;
begin
  definition:=pg_get_functiondef('public.protect_last_portal_admin()'::regprocedure);
  definition:=replace(definition,'public.protect_last_portal_admin()','pg_temp.protect_last_portal_admin_fixture()');
  definition:=replace(definition,'auth.users','pg_temp.admin_action_test_users');
  execute definition;
  execute 'create trigger protect_test_admin before update or delete on pg_temp.admin_action_test_users for each row execute function pg_temp.protect_last_portal_admin_fixture()';
  insert into pg_temp.admin_action_test_users(id,email,raw_app_meta_data,email_confirmed_at,encrypted_password)
    values(first_id,'first@example.invalid','{"role":"partner_admin"}',now(),'fixture'),(second_id,'second@example.invalid','{"role":"partner_admin"}',now(),'fixture');
  update pg_temp.admin_action_test_users set banned_until=now()+interval '1 day' where id=first_id;
  begin update pg_temp.admin_action_test_users set banned_until=now()+interval '1 day' where id=second_id;
  exception when raise_exception then rejected:=true; end;
  if not rejected then raise exception 'Last active administrator could be disabled'; end if;
  rejected:=false;
  begin delete from pg_temp.admin_action_test_users where id=second_id;
  exception when raise_exception then rejected:=true; end;
  if not rejected then raise exception 'Last active administrator could be deleted'; end if;
  rejected:=false;
  begin update pg_temp.admin_action_test_users set raw_app_meta_data='{}' where id=second_id;
  exception when raise_exception then rejected:=true; end;
  if not rejected then raise exception 'Last admin could lose its role'; end if;
  -- Editing the last administrator's name must remain possible.
  update pg_temp.admin_action_test_users set raw_user_meta_data='{"full_name":"Updated"}' where id=second_id;
end;
$test$;
do $test$
declare uid uuid:=gen_random_uuid(); sid uuid:=gen_random_uuid(); lease uuid:=gen_random_uuid(); other_lease uuid:=gen_random_uuid(); denied boolean:=false;
begin
  if has_function_privilege('authenticated','public.claim_admin_account_action(uuid,uuid)','EXECUTE')
    or has_function_privilege('anon','public.portal_admin_session_valid(uuid,uuid)','EXECUTE') then raise exception 'Admin RPC exposed'; end if;
  insert into auth.users(id,email,raw_app_meta_data,recovery_token,confirmation_token)
    values(uid,uid::text||'@admin-action.example.invalid','{"role":"partner_admin"}','test-recovery','test-confirmation');
  insert into auth.sessions(id,user_id) values(sid,uid);
  if not public.portal_admin_session_valid(uid,sid) then raise exception 'Valid admin session rejected'; end if;
  if not public.claim_admin_account_action(uid,lease) then raise exception 'Cannot claim admin action'; end if;
  if public.claim_admin_account_action(uid,other_lease) then raise exception 'Concurrent admin action allowed'; end if;
  perform public.release_admin_account_action(other_lease);
  if public.claim_admin_account_action(uid,other_lease) then raise exception 'Wrong token released lock'; end if;
  begin perform public.invalidate_admin_credentials(uid,other_lease);
  exception when raise_exception then denied:=true; end;
  if not denied then raise exception 'Invalidation accepted wrong lease'; end if;
  perform public.invalidate_admin_credentials(uid,lease);
  if public.portal_admin_session_valid(uid,sid) then raise exception 'Revoked admin session accepted'; end if;
  if exists(select 1 from auth.users where id=uid and (recovery_token<>'' or confirmation_token<>'')) then raise exception 'Access links not revoked'; end if;
  perform public.release_admin_account_action(lease);
  update auth.users set banned_until=now()+interval '1 day' where id=uid;
  denied:=false;
  begin perform public.claim_admin_account_action(uid,lease);
  exception when raise_exception then denied:=true; end;
  if not denied then raise exception 'Banned admin acquired action lease'; end if;
end;
$test$;
rollback;
