-- Run against the existing portal database with password setup tracking configured.
-- No fixture or sync request is committed.
begin;
do $test$
declare
  uid uuid:=gen_random_uuid(); rid uuid:=gen_random_uuid();
  admin_id uuid:=gen_random_uuid();
  test_email text:=uid::text||'@password-setup.example.invalid';
begin
  if has_table_privilege('authenticated','public.portal_password_setup','UPDATE')
    or has_table_privilege('anon','public.portal_password_setup','SELECT') then
    raise exception 'Password completion is exposed to browser roles';
  end if;
  insert into auth.users(id,email,aud,role,encrypted_password)
    values(uid,test_email,'authenticated','authenticated','');
  insert into public.partner_registrations(id,company,name,email,user_id,partner_id,ready)
    values(rid,'Password setup fixture','Contact',test_email,uid,'rec12345678901234',true);

  -- Auth may hold a generated password before the recipient chooses their own.
  update auth.users set encrypted_password='generated-placeholder' where id=uid;
  update auth.users set email_confirmed_at=now(),last_sign_in_at=now() where id=uid;
  if public.portal_password_is_set(uid) then raise exception 'Opening invitation completed setup'; end if;
  if (select activated from public.list_partner_admin_accounts() where id=rid) then
    raise exception 'Partner list activated before password save';
  end if;
  if (select account_status from public.partner_airtable_snapshots(array[rid]))<>'Awaiting activation' then
    raise exception 'Airtable activated before password save';
  end if;
  -- User-editable metadata must not activate the account.
  update auth.users set raw_user_meta_data='{"password_setup_complete":true}' where id=uid;
  if public.portal_password_is_set(uid) then raise exception 'User metadata completed setup'; end if;

  update auth.users set encrypted_password='chosen-password-fixture' where id=uid;
  if not (select activated from public.list_partner_admin_accounts() where id=rid) then
    raise exception 'Password save did not activate partner';
  end if;
  if (select account_status from public.partner_airtable_snapshots(array[rid]))<>'Active' then
    raise exception 'Password save did not activate Airtable snapshot';
  end if;
  update auth.users set encrypted_password='reset-password-fixture' where id=uid;
  if not public.portal_password_is_set(uid) then raise exception 'Recovery lost activation'; end if;

  insert into auth.users(id,email,aud,role,raw_app_meta_data,encrypted_password)
    values(admin_id,admin_id::text||'@password-setup.example.invalid','authenticated','authenticated','{"role":"partner_admin"}','');
  update auth.users set encrypted_password='admin-generated-placeholder' where id=admin_id;
  update auth.users set email_confirmed_at=now() where id=admin_id;
  if (select activated from public.list_portal_administrators() where id=admin_id) then
    raise exception 'Opening admin invitation completed setup';
  end if;
  update auth.users set encrypted_password='admin-chosen-password' where id=admin_id;
  if not (select activated from public.list_portal_administrators() where id=admin_id) then
    raise exception 'Password save did not activate administrator';
  end if;
end;
$test$;
rollback;
