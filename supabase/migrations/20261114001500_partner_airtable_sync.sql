begin;

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron with schema pg_catalog;

create table public.partner_airtable_sync (
  registration_id uuid primary key references public.partner_registrations(id) on delete cascade,
  revision bigint not null default 1,
  synced_revision bigint not null default 0,
  attempts integer not null default 0,
  next_attempt_at timestamptz not null default now(),
  lock_token uuid,
  locked_until timestamptz,
  last_error text,
  synced_at timestamptz
);
alter table public.partner_airtable_sync enable row level security;
revoke all on public.partner_airtable_sync from public, anon, authenticated;
grant select, insert, update on public.partner_airtable_sync to service_role;

create function public.dispatch_partner_airtable_sync()
returns bigint language plpgsql security definer set search_path = '' as $$
declare endpoint text; credential text; request_id bigint;
begin
  if not exists(select 1 from public.partner_airtable_sync
    where revision > synced_revision and next_attempt_at <= now()
      and (locked_until is null or locked_until < now())) then return null; end if;
  select decrypted_secret into endpoint from vault.decrypted_secrets where name = 'partner_sync_project_url';
  select decrypted_secret into credential from vault.decrypted_secrets where name = 'partner_sync_secret';
  if endpoint is null or credential is null then return null; end if;
  select net.http_post(url := endpoint || '/functions/v1/partner-sync',
    headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || credential),
    body := '{}'::jsonb, timeout_milliseconds := 60000) into request_id;
  return request_id;
exception when others then
  -- Delivery outages must never block Auth updates or partner access changes.
  -- The durable job remains pending and cron will dispatch it again.
  return null;
end;
$$;
revoke all on function public.dispatch_partner_airtable_sync() from public, anon, authenticated;
grant execute on function public.dispatch_partner_airtable_sync() to service_role;

create function public.enqueue_partner_airtable_sync(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  insert into public.partner_airtable_sync (registration_id) values (p_id)
  on conflict (registration_id) do update set
    revision = public.partner_airtable_sync.revision + 1,
    attempts = 0, next_attempt_at = now(), last_error = null;
  perform public.dispatch_partner_airtable_sync();
end;
$$;
revoke all on function public.enqueue_partner_airtable_sync(uuid) from public, anon, authenticated;
grant execute on function public.enqueue_partner_airtable_sync(uuid) to service_role;

create function public.partner_registration_sync_trigger()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    perform public.enqueue_partner_airtable_sync(new.id);
  elsif row(new.company,new.name,new.email,new.user_id,new.partner_id,new.ready,new.disabled,new.deleted_at,new.created_at)
    is distinct from row(old.company,old.name,old.email,old.user_id,old.partner_id,old.ready,old.disabled,old.deleted_at,old.created_at) then
    perform public.enqueue_partner_airtable_sync(new.id);
  end if;
  return new;
end;
$$;
revoke all on function public.partner_registration_sync_trigger() from public, anon, authenticated;
create trigger partner_registration_airtable_sync after insert or update on public.partner_registrations
  for each row execute function public.partner_registration_sync_trigger();

create function public.partner_auth_sync_trigger()
returns trigger language plpgsql security definer set search_path = '' as $$
declare registration_id uuid;
begin
  if tg_op = 'DELETE' then
    -- Capture the deletion before the FK clears user_id. Keep Airtable history.
    update public.partner_registrations set deleted_at = coalesce(deleted_at, now()), disabled = true, ready = false
      where user_id = old.id;
    return old;
  end if;
  if row(new.email_confirmed_at,new.encrypted_password,new.banned_until)
    is distinct from row(old.email_confirmed_at,old.encrypted_password,old.banned_until) then
    for registration_id in select r.id from public.partner_registrations r where r.user_id = new.id loop
      perform public.enqueue_partner_airtable_sync(registration_id);
    end loop;
  end if;
  return new;
end;
$$;
revoke all on function public.partner_auth_sync_trigger() from public, anon, authenticated;
create trigger partner_auth_airtable_sync after update on auth.users
  for each row execute function public.partner_auth_sync_trigger();
create trigger partner_auth_delete_airtable_sync before delete on auth.users
  for each row execute function public.partner_auth_sync_trigger();

create function public.claim_partner_airtable_sync(p_limit integer default 10)
returns table (registration_id uuid, revision bigint, lock_token uuid)
language sql security definer set search_path = '' as $$
  with candidates as (
    select q.registration_id from public.partner_airtable_sync q
    where q.revision > q.synced_revision and q.next_attempt_at <= now()
      and (q.locked_until is null or q.locked_until < now())
    order by q.next_attempt_at
    for update skip locked limit least(greatest(p_limit, 1), 10)
  )
  update public.partner_airtable_sync q set lock_token = gen_random_uuid(), locked_until = now() + interval '2 minutes'
    from candidates c where q.registration_id = c.registration_id
    returning q.registration_id, q.revision, q.lock_token;
$$;
revoke all on function public.claim_partner_airtable_sync(integer) from public, anon, authenticated;
grant execute on function public.claim_partner_airtable_sync(integer) to service_role;

-- Whitelist business fields only; Auth passwords/hashes/tokens never leave SQL.
create function public.partner_airtable_snapshots(p_ids uuid[])
returns table (id uuid, company text, name text, email text, user_id uuid, partner_id text,
  account_status text, created_at timestamptz, deleted_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.id, r.company, r.name, r.email, r.user_id, r.partner_id,
    case when r.deleted_at is not null then 'Deleted'
      when r.disabled or coalesce(u.banned_until > now(), false) then 'Deactivated'
      when u.email_confirmed_at is not null and coalesce(length(u.encrypted_password), 0) > 0 then 'Active'
      when r.ready then 'Awaiting activation' else 'Setup incomplete' end,
    r.created_at, r.deleted_at
  from public.partner_registrations r left join auth.users u on u.id = r.user_id
  where r.id = any(p_ids);
$$;
revoke all on function public.partner_airtable_snapshots(uuid[]) from public, anon, authenticated;
grant execute on function public.partner_airtable_snapshots(uuid[]) to service_role;

create function public.finish_partner_airtable_sync(p_id uuid, p_revision bigint, p_token uuid,
  p_partner_id text default null, p_error text default null, p_retry_seconds integer default 60)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  -- Match the registration-trigger lock order to avoid queue/registration deadlocks.
  perform 1 from public.partner_registrations where id = p_id for update;
  perform 1 from public.partner_airtable_sync where registration_id = p_id and lock_token = p_token for update;
  if not found then return false; end if;
  if p_error is null then
    if p_partner_id is null or p_partner_id !~ '^rec[A-Za-z0-9]{14}$' then raise exception 'Invalid Airtable record'; end if;
    -- Usually already provisioned; repair a previously interrupted setup safely.
    update public.partner_registrations set partner_id = p_partner_id where id = p_id and partner_id is null;
    update public.partner_airtable_sync set synced_revision = greatest(synced_revision, p_revision),
      lock_token = null, locked_until = null, attempts = 0, last_error = null, synced_at = now()
      where registration_id = p_id and lock_token = p_token;
  else
    update public.partner_airtable_sync set lock_token = null, locked_until = null,
      attempts = attempts + 1, last_error = left(p_error, 200),
      next_attempt_at = case when revision > p_revision then now() else now() + make_interval(secs =>
        greatest(least(p_retry_seconds, 3600), least(60 * power(2, least(attempts, 6))::integer, 3600))) end
      where registration_id = p_id and lock_token = p_token;
  end if;
  return true;
end;
$$;
revoke all on function public.finish_partner_airtable_sync(uuid,bigint,uuid,text,text,integer) from public, anon, authenticated;
grant execute on function public.finish_partner_airtable_sync(uuid,bigint,uuid,text,text,integer) to service_role;

-- Backfill the accounts that were created before synchronization was added.
insert into public.partner_airtable_sync(registration_id) select id from public.partner_registrations;
select cron.schedule('partner-airtable-sync', '* * * * *', 'select public.dispatch_partner_airtable_sync();');

commit;
