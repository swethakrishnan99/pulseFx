begin;
create table public.payout_admin_write_lease (
  singleton boolean primary key default true check(singleton), token uuid, expires_at timestamptz
);
insert into public.payout_admin_write_lease(singleton) values(true);
create table public.payout_admin_operations (
  request_id uuid primary key, actor_id uuid not null, action text not null check(action in ('create','edit','cancel')),
  input jsonb not null, result jsonb, created_at timestamptz not null default now(), completed_at timestamptz
);
alter table public.payout_admin_write_lease enable row level security;
alter table public.payout_admin_operations enable row level security;
revoke all on public.payout_admin_write_lease,public.payout_admin_operations from public,anon,authenticated;
grant select,insert,update on public.payout_admin_operations to service_role;
create function public.claim_payout_admin_write(p_token uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  update public.payout_admin_write_lease set token=p_token,expires_at=now()+interval '5 minutes'
    where singleton and (expires_at is null or expires_at<now());
  return found;
end;
$$;
create function public.renew_payout_admin_write(p_token uuid)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  update public.payout_admin_write_lease set expires_at=now()+interval '5 minutes'
    where singleton and token=p_token and expires_at>now();
  return found;
end;
$$;
create function public.release_payout_admin_write(p_token uuid)
returns void language sql security definer set search_path='' as $$
  update public.payout_admin_write_lease set token=null,expires_at=null where singleton and token=p_token;
$$;
revoke all on function public.claim_payout_admin_write(uuid),public.renew_payout_admin_write(uuid),public.release_payout_admin_write(uuid) from public,anon,authenticated;
grant execute on function public.claim_payout_admin_write(uuid),public.renew_payout_admin_write(uuid),public.release_payout_admin_write(uuid) to service_role;
commit;
