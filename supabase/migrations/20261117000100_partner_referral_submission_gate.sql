-- Private request reservations prevent duplicate writes and bound public traffic.
create table if not exists public.partner_referral_submission_gate (
  submission_id uuid primary key,
  partner_id text not null,
  client_hash text not null,
  created_at timestamptz not null default now()
);
alter table public.partner_referral_submission_gate enable row level security;
revoke all on public.partner_referral_submission_gate from anon, authenticated;
create index if not exists partner_referral_gate_created on public.partner_referral_submission_gate(created_at);
create or replace function public.claim_partner_referral_submission(p_submission_id uuid, p_partner_id text, p_client_hash text)
returns text language plpgsql security definer set search_path = public, pg_temp as $$
begin
  -- One short transaction serializes claims, including retries on different instances.
  perform pg_advisory_xact_lock(173112, 1701);
  if exists(select 1 from public.partner_referral_submission_gate where submission_id = p_submission_id) then return 'duplicate'; end if;
  if (select count(*) from public.partner_referral_submission_gate where client_hash = p_client_hash and created_at > now() - interval '10 minutes') >= 10
     or (select count(*) from public.partner_referral_submission_gate where partner_id = p_partner_id and created_at > now() - interval '1 hour') >= 100 then return 'limited'; end if;
  insert into public.partner_referral_submission_gate(submission_id, partner_id, client_hash) values(p_submission_id, p_partner_id, p_client_hash);
  return 'accepted';
end;
$$;
revoke all on function public.claim_partner_referral_submission(uuid,text,text) from public, anon, authenticated;
grant execute on function public.claim_partner_referral_submission(uuid,text,text) to service_role;
