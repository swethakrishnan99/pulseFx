-- Integration verification. All fixtures and queued HTTP requests are rolled back.
begin;
do $test$
declare
  test_registration_id uuid := gen_random_uuid();
  auth_id uuid := gen_random_uuid();
  lease uuid := gen_random_uuid();
  claimed_revision bigint;
  actual_status text;
begin
  insert into auth.users(id, email, aud, role, encrypted_password)
    values(auth_id, auth_id::text || '@sync-test.example.invalid', 'authenticated', 'authenticated', '');
  insert into public.partner_registrations(id, company, name, email, user_id, partner_id, ready)
    values(test_registration_id, 'Sync transaction ' || test_registration_id, 'Before activation',
      auth_id::text || '@sync-test.example.invalid', auth_id, 'rec12345678901234', true);
  select account_status into actual_status from public.partner_airtable_snapshots(array[test_registration_id]);
  if actual_status <> 'Awaiting activation' then raise exception 'Expected an unactivated account'; end if;
  select revision into claimed_revision from public.partner_airtable_sync where registration_id = test_registration_id;

  update auth.users set email_confirmed_at = now(), encrypted_password = 'transaction-only-test-value' where id = auth_id;
  select account_status into actual_status from public.partner_airtable_snapshots(array[test_registration_id]);
  if actual_status <> 'Active' then raise exception 'Activation was not reflected'; end if;
  if not exists(select 1 from public.partner_airtable_sync q where q.registration_id = test_registration_id and q.revision > claimed_revision) then
    raise exception 'Activation was not enqueued';
  end if;
  update auth.users set banned_until = now() + interval '1 day' where id = auth_id;
  select account_status into actual_status from public.partner_airtable_snapshots(array[test_registration_id]);
  if actual_status <> 'Deactivated' then raise exception 'Deactivation was not reflected'; end if;
  update auth.users set banned_until = null where id = auth_id;
  select account_status into actual_status from public.partner_airtable_snapshots(array[test_registration_id]);
  if actual_status <> 'Active' then raise exception 'Reactivation was not reflected'; end if;

  select q.revision into claimed_revision from public.partner_airtable_sync q where q.registration_id = test_registration_id;
  update public.partner_airtable_sync q set lock_token = lease, locked_until = now() + interval '2 minutes'
    where q.registration_id = test_registration_id;
  update public.partner_registrations set name = 'Changed during sync' where id = test_registration_id;
  perform public.finish_partner_airtable_sync(test_registration_id, claimed_revision, lease, 'rec12345678901234');
  if not exists(select 1 from public.partner_airtable_sync q where q.registration_id = test_registration_id and q.revision > q.synced_revision and q.lock_token is null) then
    raise exception 'A concurrent update was lost';
  end if;

  delete from auth.users where id = auth_id;
  select account_status into actual_status from public.partner_airtable_snapshots(array[test_registration_id]);
  if actual_status <> 'Deleted' then raise exception 'Deletion was not reflected'; end if;
  if not exists(select 1 from public.partner_registrations r where r.id = test_registration_id and r.user_id is null and r.partner_id = 'rec12345678901234' and r.deleted_at is not null) then
    raise exception 'Deletion did not preserve partner history';
  end if;
end;
$test$;
rollback;
