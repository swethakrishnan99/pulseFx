begin;
create table public.banking_review_locks (
  partner_id text primary key check (partner_id ~ '^rec[A-Za-z0-9]{14}$'),
  token uuid not null,
  expires_at timestamptz not null
);
alter table public.banking_review_locks enable row level security;
revoke all on public.banking_review_locks from anon, authenticated;

create table public.banking_review_events (
  id uuid primary key default gen_random_uuid(),
  partner_id text not null,
  record_id text not null,
  action text not null check (action in ('approve', 'reject')),
  actor_id uuid not null,
  created_at timestamptz not null default now()
);
alter table public.banking_review_events enable row level security;
revoke all on public.banking_review_events from anon, authenticated;

create function public.claim_banking_review(p_partner_id text, p_token uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  insert into public.banking_review_locks(partner_id, token, expires_at)
  values (p_partner_id, p_token, now() + interval '5 minutes')
  on conflict (partner_id) do update set token = excluded.token, expires_at = excluded.expires_at
    where public.banking_review_locks.expires_at < now();
  return found;
end;
$$;
create function public.renew_banking_review(p_partner_id text, p_token uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  update public.banking_review_locks set expires_at = now() + interval '5 minutes'
  where partner_id = p_partner_id and token = p_token and expires_at > now();
  return found;
end;
$$;
create function public.release_banking_review(p_partner_id text, p_token uuid)
returns void language sql security definer set search_path = '' as $$
  delete from public.banking_review_locks where partner_id = p_partner_id and token = p_token;
$$;
create function public.complete_banking_review(p_partner_id text, p_token uuid, p_record_id text, p_action text, p_actor uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.banking_review_locks where partner_id = p_partner_id and token = p_token and expires_at > now() for update;
  if not found then return false; end if;
  insert into public.banking_review_events(partner_id, record_id, action, actor_id) values (p_partner_id, p_record_id, p_action, p_actor);
  delete from public.banking_review_locks where partner_id = p_partner_id and token = p_token;
  return true;
end;
$$;
revoke all on function public.claim_banking_review(text, uuid) from public, anon, authenticated;
revoke all on function public.renew_banking_review(text, uuid) from public, anon, authenticated;
revoke all on function public.release_banking_review(text, uuid) from public, anon, authenticated;
revoke all on function public.complete_banking_review(text, uuid, text, text, uuid) from public, anon, authenticated;
grant execute on function public.claim_banking_review(text, uuid) to service_role;
grant execute on function public.renew_banking_review(text, uuid) to service_role;
grant execute on function public.release_banking_review(text, uuid) to service_role;
grant execute on function public.complete_banking_review(text, uuid, text, text, uuid) to service_role;
commit;
