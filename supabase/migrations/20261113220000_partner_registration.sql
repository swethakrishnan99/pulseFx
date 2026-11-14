begin;

-- Server-only provisioning state. No invitation tokens or links are stored here.
create table public.partner_registrations (
  id uuid primary key default gen_random_uuid(),
  company text not null check (length(trim(company)) between 1 and 160),
  name text not null check (length(trim(name)) between 1 and 120),
  email text not null unique check (email = lower(trim(email))),
  user_id uuid unique references auth.users(id),
  partner_id text,
  ready boolean not null default false,
  lock_token uuid,
  locked_until timestamptz,
  created_at timestamptz not null default now()
);
create unique index partner_registration_company on public.partner_registrations (lower(trim(company)));
alter table public.partner_registrations enable row level security;
revoke all on public.partner_registrations from public, anon, authenticated;
grant select, insert, update on public.partner_registrations to service_role;
grant select, insert on public.partner_memberships to service_role;

-- Activation means the recipient has confirmed the email AND set a password.
-- Only the service role can call this function; no password/hash leaves SQL.
create function public.list_partner_admin_accounts()
returns table (id uuid, company text, name text, email text, user_id uuid,
  partner_id text, ready boolean, activated boolean, created_at timestamptz)
language sql stable security definer set search_path = '' as $$
  select r.id, r.company, r.name, r.email, r.user_id, r.partner_id, r.ready,
    coalesce(u.email_confirmed_at is not null and length(u.encrypted_password) > 0, false),
    r.created_at
  from public.partner_registrations r
  left join auth.users u on u.id = r.user_id
  order by r.created_at desc;
$$;
revoke all on function public.list_partner_admin_accounts() from public, anon, authenticated;
grant execute on function public.list_partner_admin_accounts() to service_role;

commit;
